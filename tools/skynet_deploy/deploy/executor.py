"""Local and SSH command execution helpers."""

from __future__ import annotations

import os
from pathlib import Path
from pathlib import PurePosixPath
import shlex
import subprocess
from typing import Sequence
from urllib.parse import urlparse

from tools.skynet_deploy.targets.config import TargetConfig
from tools.skynet_deploy.utils.errors import DeployError
from tools.skynet_deploy.utils.logging import ConsoleLogger


class TargetExecutor:
    """Executes commands against local or SSH-backed targets."""

    def __init__(self, target: TargetConfig, logger: ConsoleLogger, dry_run: bool = False):
        self.target = target
        self.logger = logger
        self.dry_run = dry_run

    def run(
        self,
        command: Sequence[str],
        *,
        cwd: str | None = None,
        env: dict[str, str] | None = None,
        capture_output: bool = True,
        check: bool = True,
    ) -> str:
        rendered = shlex.join(command)
        if self.target.connection.type == "local":
            completed = self._run_local_command(
                command,
                cwd=cwd,
                env=self.target.environment | (env or {}),
                capture_output=capture_output,
            )
        else:
            script = _build_script(rendered, cwd, self.target.environment | (env or {}))
            ssh_command = self._ssh_command(script)
            self.logger.command(f"ssh {self._remote_host()} {rendered}")
            if self.dry_run:
                return ""
            completed = subprocess.run(
                ssh_command,
                text=True,
                capture_output=capture_output,
                check=False,
            )
        output = _combined_output(completed)
        if output:
            print(output, end="" if output.endswith("\n") else "\n")
        if check and completed.returncode != 0:
            raise DeployError(f"Command failed ({completed.returncode}): {rendered}")
        return output.strip()

    def run_local(
        self,
        command: Sequence[str],
        *,
        cwd: str | None = None,
        env: dict[str, str] | None = None,
        capture_output: bool = True,
        check: bool = True,
    ) -> str:
        rendered = shlex.join(command)
        completed = self._run_local_command(command, cwd=cwd, env=env or {}, capture_output=capture_output)
        output = _combined_output(completed)
        if output:
            print(output, end="" if output.endswith("\n") else "\n")
        if check and completed.returncode != 0:
            raise DeployError(f"Local command failed ({completed.returncode}): {rendered}")
        return output.strip()

    def run_script(self, script: str, *, capture_output: bool = True, check: bool = True) -> str:
        self.logger.command(script)
        if self.dry_run:
            return ""
        if self.target.connection.type == "local":
            completed = subprocess.run(
                ["bash", "-lc", script],
                text=True,
                capture_output=capture_output,
                check=False,
                env=os.environ | self.target.environment,
            )
        else:
            completed = subprocess.run(
                self._ssh_command(f"set -euo pipefail; {script}"),
                text=True,
                capture_output=capture_output,
                check=False,
            )
        output = _combined_output(completed)
        if output:
            print(output, end="" if output.endswith("\n") else "\n")
        if check and completed.returncode != 0:
            raise DeployError(f"Remote script failed ({completed.returncode}).")
        return output.strip()

    def sync_release(self, source_path: str, release_path: str, current_release: str | None, excludes: list[str]) -> None:
        if self.target.sync.get("type") == "smb":
            self._sync_release_with_smb(source_path, release_path, current_release, excludes)
            return
        self._require_local_command("rsync")
        if self.target.connection.type == "ssh":
            self._require_local_command("ssh")
            self.run(["mkdir", "-p", release_path], capture_output=False)
        else:
            self.run(["mkdir", "-p", release_path], capture_output=False)
        command = ["rsync", "-az", "--delete", "--safe-links"]
        if current_release:
            command.append(f"--link-dest={current_release}")
        command.extend(f"--exclude={item}" for item in excludes)
        if self.dry_run:
            command.append("--dry-run")
        if self.target.connection.type == "ssh":
            command.extend(["-e", " ".join(self._ssh_transport_prefix())])
            destination = f"{self._remote_host()}:{release_path}/"
            command.extend([f"{source_path}/", destination])
        else:
            command.extend([f"{source_path}/", f"{release_path}/"])
        self.logger.command(shlex.join(command))
        if self.dry_run:
            return
        completed = subprocess.run(command, text=True, capture_output=True, check=False)
        output = _combined_output(completed)
        if output:
            print(output, end="" if output.endswith("\n") else "\n")
        if completed.returncode != 0:
            if self.target.connection.type == "ssh" and not self.dry_run:
                self.logger.warn("rsync failed on the SSH target, falling back to tar stream sync")
                self._sync_release_with_tar(source_path, release_path, excludes)
                return
            raise DeployError(f"rsync failed ({completed.returncode})")

    def write_text(self, path: str, content: str) -> None:
        self.logger.command(f"write {path}")
        if self.dry_run:
            return
        if self.target.connection.type == "local":
            file_path = Path(path)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(content, encoding="utf-8")
            return
        marker = "__SKYNET_EOF__"
        parent = str(PurePosixPath(path).parent)
        script = (
            f"mkdir -p {shlex.quote(parent)}; "
            f"cat > {shlex.quote(path)} <<'{marker}'\n{content}\n{marker}"
        )
        self.run_script(script, capture_output=False)

    def path_exists(self, path: str) -> bool:
        output = self.run_script(f"if [ -e {shlex.quote(path)} ]; then echo yes; fi", check=False)
        return output.strip() == "yes"

    def stream_local_to_target(self, local_command: Sequence[str], remote_command: Sequence[str]) -> None:
        if self.target.connection.type != "ssh":
            raise DeployError("Streaming local command output requires an SSH target.")
        rendered_local = shlex.join(local_command)
        rendered_remote = shlex.join(remote_command)
        remote_script = _build_script(rendered_remote, None, self.target.environment)
        ssh_command = self._ssh_command(remote_script)
        self.logger.command(f"{rendered_local} | {' '.join(shlex.quote(part) for part in ssh_command)}")
        if self.dry_run:
            return
        local_process = subprocess.Popen(list(local_command), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        ssh_process = subprocess.Popen(ssh_command, stdin=local_process.stdout, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if local_process.stdout is not None:
            local_process.stdout.close()
        ssh_stdout, ssh_stderr = ssh_process.communicate()
        local_stderr = b""
        if local_process.stderr is not None:
            local_stderr = local_process.stderr.read()
        local_return = local_process.wait()
        if ssh_stdout:
            print(ssh_stdout.decode("utf-8", errors="replace"), end="")
        if ssh_stderr:
            print(ssh_stderr.decode("utf-8", errors="replace"), end="")
        if local_stderr:
            print(local_stderr.decode("utf-8", errors="replace"), end="")
        if local_return != 0 or ssh_process.returncode != 0:
            raise DeployError(
                f"Streaming command failed (local={local_return}, remote={ssh_process.returncode})"
            )

    def _ssh_command(self, script: str) -> list[str]:
        return [*self._ssh_transport_prefix(), self._remote_host(), script]

    def _ssh_transport_prefix(self) -> list[str]:
        prefix = ["ssh", "-o", "BatchMode=yes", "-p", str(self.target.connection.port)]
        if self.target.connection.identity_file:
            prefix.extend(["-i", self.target.connection.identity_file])
        return prefix

    def _remote_host(self) -> str:
        return f"{self.target.connection.user}@{self.target.connection.host}"

    def _require_local_command(self, name: str) -> None:
        if self.dry_run:
            return
        completed = subprocess.run(["bash", "-lc", f"command -v {shlex.quote(name)}"], check=False)
        if completed.returncode != 0:
            raise DeployError(f"Required local command not found: {name}")

    def _run_local_command(
        self,
        command: Sequence[str],
        *,
        cwd: str | None,
        env: dict[str, str],
        capture_output: bool,
    ) -> subprocess.CompletedProcess[str]:
        rendered = shlex.join(command)
        self.logger.command(rendered if cwd is None else f"(cd {cwd} && {rendered})")
        if self.dry_run:
            return subprocess.CompletedProcess(list(command), 0, "", "")
        local_env = os.environ.copy()
        local_env.update(env)
        return subprocess.run(
            list(command),
            cwd=cwd,
            env=local_env,
            text=True,
            capture_output=capture_output,
            check=False,
        )

    def _sync_release_with_tar(self, source_path: str, release_path: str, excludes: list[str]) -> None:
        self._require_local_command("tar")
        tar_command = ["tar", "--ignore-failed-read", "-C", source_path, "-czf", "-"]
        tar_command.extend(f"--exclude={item}" for item in excludes)
        tar_command.append(".")
        ssh_command = self._ssh_command(f"mkdir -p {shlex.quote(release_path)} && tar -xzf - -C {shlex.quote(release_path)}")
        self.logger.command(f"{shlex.join(tar_command)} | {' '.join(shlex.quote(part) for part in ssh_command)}")
        tar_process = subprocess.Popen(tar_command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=False)
        ssh_process = subprocess.Popen(ssh_command, stdin=tar_process.stdout, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if tar_process.stdout is not None:
            tar_process.stdout.close()
        ssh_stdout, ssh_stderr = ssh_process.communicate()
        tar_stderr = b""
        if tar_process.stderr is not None:
            tar_stderr = tar_process.stderr.read()
        tar_return = tar_process.wait()
        if ssh_stdout:
            print(ssh_stdout.decode("utf-8", errors="replace"), end="")
        if ssh_stderr:
            print(ssh_stderr.decode("utf-8", errors="replace"), end="")
        if tar_stderr:
            print(tar_stderr.decode("utf-8", errors="replace"), end="")
        if tar_return != 0 or ssh_process.returncode != 0:
            raise DeployError(
                f"tar sync failed (tar={tar_return}, ssh={ssh_process.returncode})"
            )

    def _sync_release_with_smb(
        self,
        source_path: str,
        release_path: str,
        current_release: str | None,
        excludes: list[str],
    ) -> None:
        self._require_local_command("rsync")
        mount_root = self._ensure_smb_mount()
        local_release_path = self._map_remote_path_to_sync_root(release_path, mount_root)
        Path(local_release_path).mkdir(parents=True, exist_ok=True)
        command = ["rsync", "-a", "--delete", "--safe-links"]
        command.extend(f"--exclude={item}" for item in excludes)
        if self.dry_run:
            command.append("--dry-run")
        command.extend([f"{source_path}/", f"{local_release_path}/"])
        self.logger.command(shlex.join(command))
        if self.dry_run:
            return
        completed = subprocess.run(command, text=True, capture_output=True, check=False)
        output = _combined_output(completed)
        if output:
            print(output, end="" if output.endswith("\n") else "\n")
        if completed.returncode != 0:
            raise DeployError(f"SMB rsync failed ({completed.returncode})")

    def _ensure_smb_mount(self) -> str:
        sync = self.target.sync
        mount_path = sync.get("mount_path")
        if mount_path:
            mount_root = Path(mount_path).expanduser()
            if mount_root.exists():
                return str(mount_root)
            raise DeployError(
                f"Configured SMB mount_path does not exist: {mount_root}. "
                "Mount the Synology share first or remove mount_path so SKYNET can use gio."
            )
        mount_root = self._expected_gvfs_mount_path(sync["uri"])
        if mount_root.exists():
            return str(mount_root)
        self._require_local_command("gio")
        mount_uri = self._smb_mount_uri(sync)
        self.logger.command(f"gio mount {shlex.quote(mount_uri)}")
        if self.dry_run:
            return str(mount_root)
        completed = subprocess.run(["gio", "mount", mount_uri], text=True, capture_output=True, check=False)
        output = _combined_output(completed)
        if output:
            print(output, end="" if output.endswith("\n") else "\n")
        if completed.returncode != 0 and not mount_root.exists():
            raise DeployError(
                "Failed to mount the SMB share automatically. "
                "Mount it once with your desktop file manager or configure sync.mount_path."
            )
        if mount_root.exists():
            return str(mount_root)
        raise DeployError(
            f"SMB share mounted but the GVFS path was not found: {mount_root}. "
            "Set sync.mount_path explicitly for this target."
        )

    def _expected_gvfs_mount_path(self, uri: str) -> Path:
        parsed = urlparse(uri if "://" in uri else f"smb://{uri}")
        host = (parsed.hostname or "").lower()
        share = parsed.path.strip("/").split("/", 1)[0].lower()
        uid = os.getuid()
        return Path(f"/run/user/{uid}/gvfs/smb-share:server={host},share={share}")

    def _smb_mount_uri(self, sync: dict[str, str]) -> str:
        parsed = urlparse(sync["uri"])
        username = sync.get("username") or parsed.username
        host = parsed.hostname or ""
        share = parsed.path.strip("/").split("/", 1)[0]
        if not host or not share:
            raise DeployError("SMB sync.uri must point to a share, for example smb://nas/docker")
        if username:
            return f"smb://{username}@{host}/{share}"
        return f"smb://{host}/{share}"

    def _map_remote_path_to_sync_root(self, remote_path: str, mount_root: str) -> str:
        remote_root = self.target.sync["remote_root"]
        normalized_remote_root = remote_root.rstrip("/")
        normalized_remote_path = remote_path.rstrip("/")
        if normalized_remote_path == normalized_remote_root:
            relative = ""
        elif normalized_remote_path.startswith(f"{normalized_remote_root}/"):
            relative = normalized_remote_path[len(normalized_remote_root) + 1 :]
        else:
            raise DeployError(
                f"Remote path {remote_path} is outside sync.remote_root {remote_root} for target '{self.target.name}'."
            )
        return str(Path(mount_root) / relative)


def _build_script(command: str, cwd: str | None, env: dict[str, str]) -> str:
    exports = " ".join(f"{key}={shlex.quote(value)}" for key, value in sorted(env.items()))
    prefix = f"export {exports}; " if exports else ""
    change_dir = f"cd {shlex.quote(cwd)}; " if cwd else ""
    return f"set -euo pipefail; {prefix}{change_dir}{command}"


def _combined_output(completed: subprocess.CompletedProcess[str]) -> str:
    parts = []
    if completed.stdout:
        parts.append(completed.stdout)
    if completed.stderr:
        parts.append(completed.stderr)
    return "".join(parts)


def join_posix(*parts: str) -> str:
    return str(PurePosixPath(*parts))
