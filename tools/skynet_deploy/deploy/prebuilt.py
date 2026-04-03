"""Prebuilt image deploy helpers."""

from __future__ import annotations

from pathlib import PurePosixPath

from tools.skynet_deploy.deploy.executor import TargetExecutor, join_posix
from tools.skynet_deploy.targets.config import TargetConfig
from tools.skynet_deploy.utils.errors import DeployError


OVERRIDE_FILE = ".skynet.prebuilt.compose.yml"


def uses_prebuilt_images(target: TargetConfig) -> bool:
    return bool(target.runtime.get("prebuilt_images"))


def prepare_prebuilt_release(executor: TargetExecutor, target: TargetConfig, release_path: str) -> None:
    images = target.runtime["prebuilt_images"]
    release_tag = PurePosixPath(release_path).name
    for service_config in images["services"].values():
        image = image_ref(images, service_config, release_tag)
        context_root = (target.source_path / service_config["context"]).resolve()
        dockerfile_path = context_root / service_config["dockerfile"]
        executor.run_local(
            ["docker", "build", "-t", image, "-f", str(dockerfile_path), str(context_root)],
            capture_output=False,
        )
        executor.stream_local_to_target(["docker", "save", image], [*_docker_command(target), "load"])
        if images.get("tag_latest", False):
            latest_image = image_ref(images, service_config, "latest")
            executor.run_local(["docker", "tag", image, latest_image], capture_output=False)
            executor.stream_local_to_target(["docker", "save", latest_image], [*_docker_command(target), "load"])
    executor.write_text(prebuilt_override_path(release_path), override_content(images, release_tag))


def prebuilt_override_path(release_path: str) -> str:
    return join_posix(release_path, OVERRIDE_FILE)


def override_content(images: dict, release_tag: str) -> str:
    lines = ["services:"]
    for service_name, service_config in images["services"].items():
        lines.append(f"  {service_name}:")
        lines.append(f"    image: {image_ref(images, service_config, release_tag)}")
    return "\n".join(lines) + "\n"


def image_ref(images: dict, service_config: dict, tag: str) -> str:
    repository = service_config.get("repository", "").strip().strip("/")
    namespace = images.get("namespace", "").strip().strip("/")
    if namespace and "/" not in repository:
        repository = f"{namespace}/{repository}"
    if not repository:
        raise DeployError("Prebuilt image repository is required.")
    return f"{repository}:{tag}"


def _docker_command(target: TargetConfig) -> list[str]:
    return list(target.runtime.get("docker_command", ["docker"]))
