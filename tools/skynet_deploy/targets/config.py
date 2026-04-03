"""Target configuration loading and validation."""

from __future__ import annotations

from dataclasses import dataclass, field
import json
import os
from pathlib import Path
import re
from typing import Any
from urllib.parse import urlparse

from tools.skynet_deploy.utils.errors import DeployError


ENV_PATTERN = re.compile(r"\$\{([^}]+)\}")
DEFAULT_EXCLUDES = [
    ".git/",
    ".github/",
    ".idea/",
    ".pytest_cache/",
    ".venv/",
    "__pycache__/",
    "node_modules/",
    "backups/",
    ".skynet-deploy/",
]


@dataclass(frozen=True)
class ConnectionConfig:
    type: str
    host: str | None = None
    user: str | None = None
    port: int = 22
    identity_file: str | None = None


@dataclass(frozen=True)
class HealthCheckConfig:
    url: str
    execute_on: str = "local"
    expected_status: str = "ok"
    timeout_sec: int = 10
    retries: int = 10
    delay_sec: int = 3


@dataclass(frozen=True)
class TargetConfig:
    name: str
    source_path: Path
    deploy_path: str
    connection: ConnectionConfig
    runtime: dict[str, Any]
    restart_strategy: str
    environment: dict[str, str] = field(default_factory=dict)
    shared_paths: list[str] = field(default_factory=list)
    sync_excludes: list[str] = field(default_factory=list)
    sync: dict[str, Any] = field(default_factory=dict)
    prepare_commands: list[list[str]] = field(default_factory=list)
    post_restart_commands: list[list[str]] = field(default_factory=list)
    health_check: HealthCheckConfig | None = None
    keep_releases: int = 5
    rollback_on_health_failure: bool = True


def default_config_paths(root: Path) -> list[Path]:
    return [
        root / "infra" / "targets.json",
        root / "infra" / "targets.example.json",
    ]


def load_targets(repo_root: Path, config_path: Path | None = None) -> dict[str, TargetConfig]:
    selected_path = config_path or _first_existing_path(default_config_paths(repo_root))
    if selected_path is None:
        raise DeployError("No targets config found. Expected infra/targets.json.")
    payload = json.loads(selected_path.read_text(encoding="utf-8"))
    payload = _expand_env(payload)
    defaults = payload.get("defaults", {})
    targets = payload.get("targets", {})
    if not isinstance(targets, dict) or not targets:
        raise DeployError(f"{selected_path} does not define any targets.")
    loaded = {
        name: _build_target(repo_root, name, defaults, raw)
        for name, raw in targets.items()
    }
    return loaded


def parse_target_selector(selector: str, available: dict[str, TargetConfig]) -> list[TargetConfig]:
    if selector == "all":
        return [available[name] for name in sorted(available)]
    names = [item.strip() for item in selector.split(",") if item.strip()]
    missing = [name for name in names if name not in available]
    if missing:
        available_names = ", ".join(sorted(available))
        raise DeployError(f"Unknown target(s): {', '.join(missing)}. Available: {available_names}")
    return [available[name] for name in names]


def _first_existing_path(paths: list[Path]) -> Path | None:
    for path in paths:
        if path.exists():
            return path
    return None


def _expand_env(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _expand_env(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_expand_env(item) for item in value]
    if isinstance(value, str):
        return ENV_PATTERN.sub(lambda match: os.environ.get(match.group(1), match.group(0)), value)
    return value


def _build_target(repo_root: Path, name: str, defaults: dict[str, Any], raw: dict[str, Any]) -> TargetConfig:
    if not isinstance(raw, dict):
        raise DeployError(f"Target '{name}' must be an object.")
    merged = _merge(defaults, raw)
    unresolved = _find_unresolved_placeholders(merged)
    if unresolved:
        details = ", ".join(f"{path}={value}" for path, value in unresolved)
        raise DeployError(
            f"Target '{name}' has unresolved environment placeholders: {details}. "
            "Export the referenced variables or replace them in infra/targets.json."
        )
    connection_raw = merged.get("connection", {})
    runtime = merged.get("runtime", {})
    health_raw = merged.get("health_check")
    source_path = (repo_root / merged.get("source_path", ".")).resolve()
    if not source_path.exists():
        raise DeployError(f"Target '{name}' source_path does not exist: {source_path}")
    deploy_path = merged.get("deploy_path")
    if not deploy_path:
        raise DeployError(f"Target '{name}' is missing deploy_path.")
    connection = ConnectionConfig(
        type=connection_raw.get("type", "local"),
        host=connection_raw.get("host"),
        user=connection_raw.get("user"),
        port=int(connection_raw.get("port", 22)),
        identity_file=connection_raw.get("identity_file"),
    )
    if connection.type not in {"local", "ssh"}:
        raise DeployError(f"Target '{name}' has unsupported connection.type: {connection.type}")
    if connection.type == "ssh" and (not connection.host or not connection.user):
        raise DeployError(f"Target '{name}' ssh connections require host and user.")
    if connection.type == "local" and not Path(str(deploy_path)).is_absolute():
        deploy_path = str((repo_root / str(deploy_path)).resolve())
    runtime_type = runtime.get("type")
    if runtime_type not in {"docker", "python"}:
        raise DeployError(f"Target '{name}' runtime.type must be 'docker' or 'python'.")
    restart_strategy = merged.get("restart_strategy") or _default_restart_strategy(runtime_type)
    _validate_runtime(name, runtime, restart_strategy)
    health = None
    if health_raw:
        health = HealthCheckConfig(
            url=health_raw.get("url", ""),
            execute_on=health_raw.get("execute_on", "local"),
            expected_status=health_raw.get("expected_status", "ok"),
            timeout_sec=int(health_raw.get("timeout_sec", 10)),
            retries=int(health_raw.get("retries", 10)),
            delay_sec=int(health_raw.get("delay_sec", 3)),
        )
        if health.execute_on not in {"local", "target"}:
            raise DeployError(f"Target '{name}' health_check.execute_on must be local or target.")
        if not health.url:
            raise DeployError(f"Target '{name}' health_check.url is required.")
    prepare_commands = [_command_list(item) for item in merged.get("prepare_commands", [])]
    post_restart_commands = [_command_list(item) for item in merged.get("post_restart_commands", [])]
    shared_paths = _string_list(merged.get("shared_paths", []))
    if any(Path(path).is_absolute() for path in shared_paths):
        raise DeployError(f"Target '{name}' shared_paths must be repo-relative.")
    sync_excludes = list(dict.fromkeys(DEFAULT_EXCLUDES + _string_list(merged.get("sync_excludes", []))))
    sync = _normalize_sync_config(name, merged.get("sync", {}))
    environment = {str(key): str(value) for key, value in merged.get("environment", {}).items()}
    keep_releases = int(merged.get("keep_releases", 5))
    return TargetConfig(
        name=name,
        source_path=source_path,
        deploy_path=str(deploy_path),
        connection=connection,
        runtime=runtime,
        restart_strategy=restart_strategy,
        environment=environment,
        shared_paths=shared_paths,
        sync_excludes=sync_excludes,
        sync=sync,
        prepare_commands=prepare_commands,
        post_restart_commands=post_restart_commands,
        health_check=health,
        keep_releases=max(2, keep_releases),
        rollback_on_health_failure=bool(merged.get("rollback_on_health_failure", True)),
    )


def _merge(defaults: dict[str, Any], raw: dict[str, Any]) -> dict[str, Any]:
    merged = dict(defaults)
    for key, value in raw.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _string_list(value: Any) -> list[str]:
    if not value:
        return []
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise DeployError("Expected a list of strings in targets config.")
    return list(value)


def _command_list(value: Any) -> list[str]:
    if not isinstance(value, list) or not value or not all(isinstance(item, str) for item in value):
        raise DeployError("Commands in targets config must be non-empty string arrays.")
    return list(value)


def _default_restart_strategy(runtime_type: str) -> str:
    return "compose_up" if runtime_type == "docker" else "systemd"


def _validate_runtime(name: str, runtime: dict[str, Any], restart_strategy: str) -> None:
    if runtime["type"] == "docker":
        compose_files = runtime.get("compose_files", ["docker-compose.yml"])
        if not isinstance(compose_files, list) or not all(isinstance(item, str) for item in compose_files):
            raise DeployError(f"Target '{name}' docker runtime requires compose_files as string array.")
        if restart_strategy not in {"compose_up", "compose_down_up", "compose_restart"}:
            raise DeployError(f"Target '{name}' has invalid docker restart_strategy: {restart_strategy}")
        if "docker_command" in runtime:
            _command_list(runtime["docker_command"])
        if "migrate_command" in runtime:
            _command_list(runtime["migrate_command"])
        if "registry" in runtime and "prebuilt_images" in runtime:
            raise DeployError(f"Target '{name}' cannot define both runtime.registry and runtime.prebuilt_images.")
        if "registry" in runtime:
            _validate_registry_runtime(name, runtime["registry"], restart_strategy)
        if "prebuilt_images" in runtime:
            _validate_prebuilt_runtime(name, runtime["prebuilt_images"], restart_strategy)
    if runtime["type"] == "python":
        if restart_strategy == "systemd" and not runtime.get("service_unit"):
            raise DeployError(f"Target '{name}' python/systemd runtime requires service_unit.")
        if restart_strategy == "command":
            _command_list(runtime.get("restart_command"))
        if "status_command" in runtime:
            _command_list(runtime["status_command"])


def _validate_registry_runtime(name: str, registry: Any, restart_strategy: str) -> None:
    if restart_strategy == "compose_restart":
        raise DeployError(f"Target '{name}' cannot use compose_restart with registry-backed Docker deploys.")
    if not isinstance(registry, dict):
        raise DeployError(f"Target '{name}' runtime.registry must be an object.")
    url = str(registry.get("url", "")).strip()
    parsed = urlparse(url if "://" in url else f"http://{url}")
    host = parsed.netloc or parsed.path
    if not host:
        raise DeployError(f"Target '{name}' runtime.registry.url is required.")
    services = registry.get("services")
    if not isinstance(services, dict) or not services:
        raise DeployError(f"Target '{name}' runtime.registry.services must define at least one service.")
    for service_name, service in services.items():
        if not isinstance(service, dict):
            raise DeployError(f"Target '{name}' registry service '{service_name}' must be an object.")
        for field_name in ("repository", "context", "dockerfile"):
            value = service.get(field_name)
            if not isinstance(value, str) or not value.strip():
                raise DeployError(
                    f"Target '{name}' registry service '{service_name}' requires '{field_name}'."
                )


def _validate_prebuilt_runtime(name: str, images: Any, restart_strategy: str) -> None:
    if restart_strategy == "compose_restart":
        raise DeployError(f"Target '{name}' cannot use compose_restart with prebuilt Docker deploys.")
    if not isinstance(images, dict):
        raise DeployError(f"Target '{name}' runtime.prebuilt_images must be an object.")
    services = images.get("services")
    if not isinstance(services, dict) or not services:
        raise DeployError(f"Target '{name}' runtime.prebuilt_images.services must define at least one service.")
    for service_name, service in services.items():
        if not isinstance(service, dict):
            raise DeployError(f"Target '{name}' prebuilt service '{service_name}' must be an object.")
        for field_name in ("repository", "context", "dockerfile"):
            value = service.get(field_name)
            if not isinstance(value, str) or not value.strip():
                raise DeployError(
                    f"Target '{name}' prebuilt service '{service_name}' requires '{field_name}'."
                )


def _normalize_sync_config(name: str, sync: Any) -> dict[str, Any]:
    if not sync:
        return {}
    if not isinstance(sync, dict):
        raise DeployError(f"Target '{name}' sync must be an object.")
    sync_type = str(sync.get("type", "")).strip()
    if sync_type not in {"smb"}:
        raise DeployError(f"Target '{name}' has unsupported sync.type: {sync_type}")
    uri = str(sync.get("uri", "")).strip()
    remote_root = str(sync.get("remote_root", "")).strip()
    if not uri:
        raise DeployError(f"Target '{name}' sync.uri is required for SMB sync.")
    parsed = urlparse(uri)
    if parsed.scheme.lower() != "smb":
        raise DeployError(f"Target '{name}' sync.uri must use smb://.")
    if not remote_root.startswith("/"):
        raise DeployError(f"Target '{name}' sync.remote_root must be an absolute path.")
    normalized = {
        "type": "smb",
        "uri": uri,
        "remote_root": remote_root.rstrip("/") or "/",
    }
    username = str(sync.get("username", "")).strip()
    if username:
        normalized["username"] = username
    mount_path = str(sync.get("mount_path", "")).strip()
    if mount_path:
        normalized["mount_path"] = str(Path(mount_path).expanduser().resolve())
    return normalized


def _find_unresolved_placeholders(value: Any, path: str = "") -> list[tuple[str, str]]:
    if isinstance(value, dict):
        found: list[tuple[str, str]] = []
        for key, item in value.items():
            next_path = f"{path}.{key}" if path else str(key)
            found.extend(_find_unresolved_placeholders(item, next_path))
        return found
    if isinstance(value, list):
        found = []
        for index, item in enumerate(value):
            next_path = f"{path}[{index}]"
            found.extend(_find_unresolved_placeholders(item, next_path))
        return found
    if isinstance(value, str) and ENV_PATTERN.search(value):
        return [(path or "value", value)]
    return []
