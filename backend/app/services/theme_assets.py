from __future__ import annotations

import shutil
from pathlib import Path


ALLOWED_IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_LOGO_BYTES = 2 * 1024 * 1024


def theme_assets_root() -> Path:
    return Path(__file__).resolve().parents[2] / "data" / "theme-assets"


def _theme_logo_dir(theme_id: str) -> Path:
    return theme_assets_root() / theme_id


def find_theme_logo_path(theme_id: str) -> Path | None:
    directory = _theme_logo_dir(theme_id)
    if not directory.exists():
        return None

    for extension in ALLOWED_IMAGE_TYPES.values():
        candidate = directory / f"logo{extension}"
        if candidate.exists():
            return candidate
    return None


def save_theme_logo(theme_id: str, content_type: str | None, payload: bytes) -> dict:
    if not payload:
        raise ValueError("Logo file is empty")
    if len(payload) > MAX_LOGO_BYTES:
        raise ValueError("Logo file exceeds 2 MB")
    extension = ALLOWED_IMAGE_TYPES.get(content_type or "")
    if not extension:
        raise ValueError("Unsupported logo format. Use PNG, JPEG, WEBP, or GIF")

    directory = _theme_logo_dir(theme_id)
    if directory.exists():
        shutil.rmtree(directory)
    directory.mkdir(parents=True, exist_ok=True)

    target = directory / f"logo{extension}"
    target.write_bytes(payload)
    return {
        "logo_url": f"/theme-assets/{theme_id}/{target.name}",
        "content_type": content_type,
        "size_bytes": len(payload),
    }


def delete_theme_logo(theme_id: str) -> None:
    directory = _theme_logo_dir(theme_id)
    if directory.exists():
        shutil.rmtree(directory)
