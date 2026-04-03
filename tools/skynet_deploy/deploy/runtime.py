"""Runtime-specific deploy/restart/status handlers."""

from __future__ import annotations

from pathlib import PurePosixPath
from typing import Sequence

from tools.skynet_deploy.deploy.executor import TargetExecutor
from tools.skynet_deploy.deploy.prebuilt import (
    prepare_prebuilt_release,
    prebuilt_override_path,
    uses_prebuilt_images,
)
from tools.skynet_deploy.deploy.registry import (
    assert_registry_ready,
    prepare_registry_release,
    registry_override_path,
    uses_registry,
)
from tools.skynet_deploy.targets.config import TargetConfig
from tools.skynet_deploy.utils.errors import DeployError


def deploy_release(executor: TargetExecutor, target: TargetConfig, release_path: str) -> None:
    for command in target.prepare_commands:
        executor.run(command, cwd=release_path, capture_output=False)
    if target.runtime["type"] == "docker":
        _deploy_docker(executor, target, release_path)
    else:
        _deploy_python(executor, target, release_path)
    for command in target.post_restart_commands:
        executor.run(command, cwd=release_path, capture_output=False)


def restart_release(
    executor: TargetExecutor,
    target: TargetConfig,
    release_path: str,
    *,
    rebuild: bool = False,
) -> None:
    if target.runtime["type"] == "docker":
        _restart_docker(executor, target, release_path, rebuild=rebuild)
        return
    _restart_python(executor, target, release_path)


def status_release(executor: TargetExecutor, target: TargetConfig, release_path: str) -> str:
    if target.runtime["type"] == "docker":
        return executor.run(_docker_compose_args(target, executor, release_path, "ps"))
    if target.restart_strategy == "systemd":
        return executor.run(["systemctl", "status", "--no-pager", target.runtime["service_unit"]], check=False)
    status_command = target.runtime.get("status_command")
    if status_command:
        return executor.run(status_command, cwd=_python_workdir(target, release_path), check=False)
    return "No native status command configured."


def _deploy_docker(executor: TargetExecutor, target: TargetConfig, release_path: str) -> None:
    registry_mode = uses_registry(target)
    prebuilt_mode = uses_prebuilt_images(target)
    if registry_mode:
        assert_registry_ready(executor, target)
        prepare_registry_release(executor, target, release_path)
    elif prebuilt_mode:
        prepare_prebuilt_release(executor, target, release_path)
    should_pull = registry_mode or (target.runtime.get("pull", False) and not prebuilt_mode)
    if should_pull:
        executor.run(_docker_compose_args(target, executor, release_path, "pull"), capture_output=False)
    if target.runtime.get("build", True) and not registry_mode and not prebuilt_mode:
        executor.run(_docker_compose_args(target, executor, release_path, "build"), capture_output=False)
    migrate_service = target.runtime.get("migrate_service")
    if migrate_service:
        migrate_command = target.runtime.get("migrate_command", ["alembic", "upgrade", "head"])
        executor.run(
            _docker_compose_args(target, executor, release_path, "run", "--rm", migrate_service, *migrate_command),
            capture_output=False,
        )
    _restart_docker(executor, target, release_path, rebuild=False)


def _restart_docker(
    executor: TargetExecutor,
    target: TargetConfig,
    release_path: str,
    *,
    rebuild: bool,
) -> None:
    strategy = target.restart_strategy
    registry_mode = uses_registry(target) and executor.path_exists(registry_override_path(release_path))
    prebuilt_mode = uses_prebuilt_images(target) and executor.path_exists(prebuilt_override_path(release_path))
    override_mode = registry_mode or prebuilt_mode
    up_args = ["up", "-d", "--remove-orphans"]
    if rebuild and not override_mode:
        up_args.append("--build")
    if strategy == "compose_down_up":
        executor.run(_docker_compose_args(target, executor, release_path, "down"), capture_output=False)
        should_pull = registry_mode or (target.runtime.get("pull", False) and not prebuilt_mode)
        if should_pull:
            executor.run(_docker_compose_args(target, executor, release_path, "pull"), capture_output=False)
        executor.run(_docker_compose_args(target, executor, release_path, *up_args), capture_output=False)
        return
    if strategy == "compose_restart":
        if rebuild:
            executor.run(_docker_compose_args(target, executor, release_path, "build"), capture_output=False)
        executor.run(_docker_compose_args(target, executor, release_path, "restart"), capture_output=False)
        return
    should_pull = registry_mode or (target.runtime.get("pull", False) and not prebuilt_mode)
    if should_pull:
        executor.run(_docker_compose_args(target, executor, release_path, "pull"), capture_output=False)
    executor.run(_docker_compose_args(target, executor, release_path, *up_args), capture_output=False)


def _docker_compose_args(
    target: TargetConfig,
    executor: TargetExecutor,
    release_path: str,
    *extra: str,
) -> list[str]:
    project_name = target.runtime.get("project_name", f"skynet-{target.name}")
    command = [*_docker_command(target), "compose", "--project-name", project_name]
    for compose_file in target.runtime.get("compose_files", ["docker-compose.yml"]):
        command.extend(["-f", str(PurePosixPath(release_path, compose_file))])
    registry_path = registry_override_path(release_path)
    if uses_registry(target) and (executor.dry_run or executor.path_exists(registry_path)):
        command.extend(["-f", registry_path])
    prebuilt_path = prebuilt_override_path(release_path)
    if uses_prebuilt_images(target) and (executor.dry_run or executor.path_exists(prebuilt_path)):
        command.extend(["-f", prebuilt_path])
    command.extend(extra)
    return command


def _deploy_python(executor: TargetExecutor, target: TargetConfig, release_path: str) -> None:
    workdir = _python_workdir(target, release_path)
    prestart = target.runtime.get("prestart_command")
    if prestart:
        executor.run(_command(prestart), cwd=workdir, capture_output=False)
    _restart_python(executor, target, release_path)


def _restart_python(executor: TargetExecutor, target: TargetConfig, release_path: str) -> None:
    workdir = _python_workdir(target, release_path)
    if target.restart_strategy == "systemd":
        executor.run(["systemctl", "restart", target.runtime["service_unit"]], capture_output=False)
        return
    if target.restart_strategy == "command":
        executor.run(_command(target.runtime["restart_command"]), cwd=workdir, capture_output=False)
        return
    raise DeployError(f"Unsupported python restart strategy: {target.restart_strategy}")


def _python_workdir(target: TargetConfig, release_path: str) -> str:
    relative = target.runtime.get("workdir", "")
    return str(PurePosixPath(release_path, relative))


def _command(value: Sequence[str]) -> list[str]:
    return list(value)


def _docker_command(target: TargetConfig) -> list[str]:
    command = target.runtime.get("docker_command", ["docker"])
    return list(command)
