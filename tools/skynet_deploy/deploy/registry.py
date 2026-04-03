"""Registry-backed Docker deploy helpers."""

from __future__ import annotations

import json
from pathlib import PurePosixPath
from urllib import error as urlerror
from urllib import request
from urllib.parse import urlparse

from tools.skynet_deploy.deploy.executor import TargetExecutor, join_posix
from tools.skynet_deploy.targets.config import TargetConfig
from tools.skynet_deploy.utils.errors import DeployError


OVERRIDE_FILE = ".skynet.registry.compose.yml"


def uses_registry(target: TargetConfig) -> bool:
    return bool(target.runtime.get("registry"))


def assert_registry_ready(executor: TargetExecutor, target: TargetConfig) -> None:
    if executor.dry_run:
        return
    registry = target.runtime["registry"]
    url = registry["url"]
    registry_host = registry_host_name(url)
    probe_url = registry_probe_url(url)
    _probe_registry_from_local(probe_url)
    _assert_http_registry_is_trusted_locally(executor, url, registry_host)
    if target.connection.type == "ssh":
        _probe_registry_from_target(executor, probe_url)
        _assert_http_registry_is_trusted_on_target(executor, target, url, registry_host)


def prepare_registry_release(executor: TargetExecutor, target: TargetConfig, release_path: str) -> None:
    registry = target.runtime["registry"]
    registry_host = registry_host_name(registry["url"])
    release_tag = PurePosixPath(release_path).name
    services = registry["services"]
    for service_config in services.values():
        release_image = image_ref(registry_host, registry, service_config, release_tag)
        context_root = (target.source_path / service_config["context"]).resolve()
        dockerfile_path = context_root / service_config["dockerfile"]
        executor.run_local(
            ["docker", "build", "-t", release_image, "-f", str(dockerfile_path), str(context_root)],
            capture_output=False,
        )
        executor.run_local(["docker", "push", release_image], capture_output=False)
        if registry.get("push_latest", False):
            latest_ref = image_ref(registry_host, registry, service_config, "latest")
            executor.run_local(["docker", "tag", release_image, latest_ref], capture_output=False)
            executor.run_local(["docker", "push", latest_ref], capture_output=False)
    executor.write_text(registry_override_path(release_path), override_content(registry_host, registry, release_tag))


def registry_host_name(url: str) -> str:
    parsed = urlparse(url if "://" in url else f"http://{url}")
    host = parsed.netloc or parsed.path
    host = host.rstrip("/")
    if not host:
        raise DeployError("Registry url is empty.")
    return host


def registry_probe_url(url: str) -> str:
    parsed = urlparse(url if "://" in url else f"http://{url}")
    scheme = parsed.scheme or "http"
    host = parsed.netloc or parsed.path
    if not host:
        raise DeployError("Registry url is empty.")
    base_path = parsed.path if parsed.netloc else ""
    base_path = base_path.rstrip("/")
    if base_path.endswith("/v2"):
        probe_path = f"{base_path}/"
    elif not base_path:
        probe_path = "/v2/"
    else:
        probe_path = f"{base_path}/v2/"
    return f"{scheme}://{host}{probe_path}"


def registry_override_path(release_path: str) -> str:
    return join_posix(release_path, OVERRIDE_FILE)


def override_content(registry_host: str, registry: dict, release_tag: str) -> str:
    lines = ["services:"]
    for service_name, service_config in registry["services"].items():
        lines.append(f"  {service_name}:")
        lines.append(f"    image: {image_ref(registry_host, registry, service_config, release_tag)}")
    return "\n".join(lines) + "\n"


def image_ref(registry_host: str, registry: dict, service_config: dict, tag: str) -> str:
    repository = service_config.get("repository", "").strip()
    namespace = registry.get("namespace", "").strip().strip("/")
    if namespace and "/" not in repository:
        repository = f"{namespace}/{repository}"
    if not repository:
        raise DeployError("Registry repository is required.")
    return f"{registry_host}/{repository}:{tag}"


def _probe_registry_from_local(probe_url: str) -> None:
    try:
        with request.urlopen(probe_url, timeout=5) as response:
            response.read(1)
    except urlerror.HTTPError as exc:
        if exc.code == 401:
            return
        raise DeployError(f"Registry probe failed for {probe_url}: HTTP {exc.code}") from exc
    except urlerror.URLError as exc:
        raise DeployError(
            f"Registry {probe_url} is not reachable from the deployment host. "
            "Check that the registry is running and that the configured host/port is correct."
        ) from exc


def _probe_registry_from_target(executor: TargetExecutor, probe_url: str) -> None:
    quoted_url = json.dumps(probe_url)
    script = (
        "if command -v curl >/dev/null 2>&1; then "
        f"curl -fsS --max-time 5 {quoted_url} >/dev/null; "
        "elif command -v wget >/dev/null 2>&1; then "
        f"wget -qO- -T 5 {quoted_url} >/dev/null; "
        "else echo 'curl or wget is required to validate registry reachability' >&2; exit 1; fi"
    )
    try:
        executor.run_script(script)
    except DeployError as exc:
        raise DeployError(
            f"Registry {probe_url} is not reachable from target '{executor.target.name}'. "
            "Check that the remote host can access the configured registry URL."
        ) from exc


def _assert_http_registry_is_trusted_locally(executor: TargetExecutor, url: str, registry_host: str) -> None:
    parsed = urlparse(url if "://" in url else f"http://{url}")
    if parsed.scheme not in ("http", ""):
        return
    output = executor.run_local(["docker", "info"], check=False)
    if _docker_info_has_insecure_registry(output, registry_host):
        return
    raise DeployError(
        f"Local Docker does not trust HTTP registry '{registry_host}'. "
        "Add it to Docker's insecure registries and restart Docker."
    )


def _assert_http_registry_is_trusted_on_target(
    executor: TargetExecutor,
    target: TargetConfig,
    url: str,
    registry_host: str,
) -> None:
    parsed = urlparse(url if "://" in url else f"http://{url}")
    if parsed.scheme not in ("http", ""):
        return
    docker_command = list(target.runtime.get("docker_command", ["docker"]))
    output = executor.run(docker_command + ["info"], check=False)
    if _docker_info_has_insecure_registry(output, registry_host):
        return
    raise DeployError(
        f"Target '{target.name}' Docker daemon does not trust HTTP registry '{registry_host}'. "
        "Add it to the target Docker insecure registries and restart the daemon."
    )


def _docker_info_has_insecure_registry(output: str, registry_host: str) -> bool:
    needle = registry_host.strip()
    if not needle:
        return False
    for line in output.splitlines():
        if line.strip() == needle:
            return True
    return False
