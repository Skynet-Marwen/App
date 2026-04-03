"""High-level deployment orchestration."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import PurePosixPath
import shlex
import time
from urllib import error as urlerror
from urllib import request

from tools.skynet_deploy.deploy.executor import TargetExecutor, join_posix
from tools.skynet_deploy.deploy.runtime import deploy_release, restart_release, status_release
from tools.skynet_deploy.targets.config import TargetConfig
from tools.skynet_deploy.utils.errors import DeployError
from tools.skynet_deploy.utils.logging import ConsoleLogger


class DeploymentEngine:
    """Coordinates sync, restart, health, and rollback steps."""

    def __init__(self, target: TargetConfig, logger: ConsoleLogger, dry_run: bool = False):
        self.target = target
        self.logger = logger
        self.executor = TargetExecutor(target, logger, dry_run=dry_run)
        self.dry_run = dry_run

    def deploy(self) -> None:
        release_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        paths = self._paths()
        current_release = self._read_link(paths["current"])
        release_path = join_posix(paths["releases"], release_id)
        self.logger.banner(f"SKYNET Deploy -> {self.target.name}")
        with self.logger.step("Preparing deployment directories"):
            self.executor.run(["mkdir", "-p", paths["root"], paths["releases"], paths["shared"]], capture_output=False)
        with self.logger.step(f"Syncing source into release {release_id}"):
            sync_excludes = list(dict.fromkeys([*self.target.sync_excludes, *self.target.shared_paths]))
            self.executor.sync_release(str(self.target.source_path), release_path, current_release, sync_excludes)
        with self.logger.step("Linking persistent shared paths"):
            self._materialize_shared_paths(release_path)
        try:
            with self.logger.step("Starting release runtime"):
                deploy_release(self.executor, self.target, release_path)
            with self.logger.step("Running health checks"):
                self._health_check()
        except Exception as exc:
            self.logger.error(f"Deployment failed for {self.target.name}: {exc}")
            if self.target.rollback_on_health_failure and current_release:
                self.logger.warn("Restoring previous release automatically")
                self._activate_release(current_release)
                with self.logger.step("Re-running health checks after rollback"):
                    self._health_check()
            raise
        with self.logger.step("Promoting release"):
            if current_release:
                self.executor.run(["ln", "-sfn", current_release, paths["previous"]], capture_output=False)
            self.executor.run(["ln", "-sfn", release_path, paths["current"]], capture_output=False)
        with self.logger.step("Pruning old releases"):
            self._prune_releases(current_release=current_release, new_release=release_path)

    def restart(self) -> None:
        current_release = self.current_release_path()
        self.logger.banner(f"SKYNET Restart -> {self.target.name}")
        with self.logger.step("Restarting active release"):
            restart_release(self.executor, self.target, current_release)
        if self.target.health_check:
            with self.logger.step("Running health checks"):
                self._health_check()

    def rollback(self, release_id: str | None = None) -> None:
        self.logger.banner(f"SKYNET Rollback -> {self.target.name}")
        target_release = self._resolve_rollback_release(release_id)
        current_release = self._read_link(self._paths()["current"])
        with self.logger.step(f"Activating rollback release {PurePosixPath(target_release).name}"):
            if current_release and current_release != target_release:
                self.executor.run(["ln", "-sfn", current_release, self._paths()["previous"]], capture_output=False)
            self._activate_release(target_release)
        if self.target.health_check:
            with self.logger.step("Running health checks"):
                self._health_check()

    def status(self) -> str:
        current_release = self.current_release_path()
        previous_release = self._read_link(self._paths()["previous"]) or "none"
        runtime_status = status_release(self.executor, self.target, current_release)
        return "\n".join(
            [
                f"target:   {self.target.name}",
                f"current:  {current_release}",
                f"previous: {previous_release}",
                "",
                runtime_status,
            ]
        ).strip()

    def current_release_path(self) -> str:
        current_release = self._read_link(self._paths()["current"])
        if not current_release:
            raise DeployError(f"Target '{self.target.name}' has no active release yet.")
        return current_release

    def _activate_release(self, release_path: str) -> None:
        restart_release(
            self.executor,
            self.target,
            release_path,
            rebuild=self.target.runtime["type"] == "docker",
        )
        self.executor.run(["ln", "-sfn", release_path, self._paths()["current"]], capture_output=False)

    def _materialize_shared_paths(self, release_path: str) -> None:
        paths = self._paths()
        for relative_path in self.target.shared_paths:
            shared_path = join_posix(paths["shared"], relative_path)
            release_item = join_posix(release_path, relative_path)
            self.executor.run(["mkdir", "-p", str(PurePosixPath(shared_path).parent)], capture_output=False)
            if not self._path_exists(shared_path):
                if self._path_exists(release_item):
                    self.executor.run(["mv", release_item, shared_path], capture_output=False)
                elif _looks_like_file(relative_path):
                    self.executor.run(["touch", shared_path], capture_output=False)
                else:
                    self.executor.run(["mkdir", "-p", shared_path], capture_output=False)
            self.executor.run(["mkdir", "-p", str(PurePosixPath(release_item).parent)], capture_output=False)
            self.executor.run(["rm", "-rf", release_item], capture_output=False)
            self.executor.run(["ln", "-sfn", shared_path, release_item], capture_output=False)

    def _prune_releases(self, current_release: str | None, new_release: str) -> None:
        active = {path for path in {current_release, new_release, self._read_link(self._paths()["previous"])} if path}
        releases = self._list_releases()
        stale = [item for item in releases[:-self.target.keep_releases] if item not in active]
        for release_path in stale:
            if not release_path.startswith(f"{self._paths()['releases']}/"):
                raise DeployError(f"Refusing to delete unexpected path: {release_path}")
            self.executor.run(["rm", "-rf", release_path], capture_output=False)

    def _resolve_rollback_release(self, release_id: str | None) -> str:
        if release_id:
            release_path = join_posix(self._paths()["releases"], release_id)
            if not self._path_exists(release_path):
                raise DeployError(f"Release '{release_id}' was not found for target '{self.target.name}'.")
            return release_path
        previous = self._read_link(self._paths()["previous"])
        if previous:
            return previous
        releases = self._list_releases()
        if len(releases) < 2:
            raise DeployError(f"Target '{self.target.name}' has no rollback candidate.")
        return releases[-2]

    def _health_check(self) -> None:
        if not self.target.health_check:
            return
        check = self.target.health_check
        last_error = "health check failed"
        for attempt in range(1, check.retries + 1):
            try:
                body = self._fetch_health(check.url, check.timeout_sec, check.execute_on)
                payload = json.loads(body)
                if payload.get("status") != check.expected_status:
                    raise DeployError(f"Unexpected health payload: {body}")
                self.logger.success(f"Health check passed on attempt {attempt}: {check.url}")
                return
            except (DeployError, json.JSONDecodeError, urlerror.URLError) as exc:
                last_error = str(exc)
                self.logger.warn(f"Health attempt {attempt}/{check.retries} failed: {last_error}")
                if attempt < check.retries and not self.dry_run:
                    time.sleep(check.delay_sec)
        raise DeployError(last_error)

    def _fetch_health(self, url: str, timeout_sec: int, execute_on: str) -> str:
        if self.dry_run:
            return '{"status":"ok"}'
        if execute_on == "target":
            quoted_url = json.dumps(url)
            script = (
                "if command -v curl >/dev/null 2>&1; then "
                f"curl -fsS {quoted_url}; "
                "elif command -v wget >/dev/null 2>&1; then "
                f"wget -qO- {quoted_url}; "
                "else echo 'curl or wget is required' >&2; exit 1; fi"
            )
            return self.executor.run_script(script)
        with request.urlopen(url, timeout=timeout_sec) as response:
            return response.read().decode("utf-8")

    def _paths(self) -> dict[str, str]:
        root = self.target.deploy_path
        return {
            "root": root,
            "releases": join_posix(root, "releases"),
            "shared": join_posix(root, "shared"),
            "current": join_posix(root, "current"),
            "previous": join_posix(root, "previous"),
        }

    def _path_exists(self, path: str) -> bool:
        output = self.executor.run_script(
            f"if [ -e {shlex.quote(path)} ]; then echo yes; fi",
            check=False,
        )
        return output.strip() == "yes"

    def _read_link(self, path: str) -> str | None:
        result = self.executor.run_script(
            f"if [ -L {shlex.quote(path)} ]; then readlink {shlex.quote(path)}; fi",
            check=False,
        )
        return result or None

    def _list_releases(self) -> list[str]:
        releases_dir = self._paths()["releases"]
        output = self.executor.run_script(
            f"mkdir -p {shlex.quote(releases_dir)}; for d in {shlex.quote(releases_dir)}/*; do "
            "if [ -d \"$d\" ]; then printf '%s\n' \"$d\"; fi; done | sort",
            check=False,
        )
        return [line for line in output.splitlines() if line.strip()]


def _looks_like_file(path: str) -> bool:
    name = PurePosixPath(path).name
    return "." in name
