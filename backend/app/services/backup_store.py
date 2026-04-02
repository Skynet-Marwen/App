from __future__ import annotations

from datetime import datetime, timezone
import gzip
import json
from pathlib import Path

from ..schemas.backup import BackupFileMetadata
from .backup_crypto import decode_bytes, decrypt_bytes, encode_bytes, encrypt_bytes, sha256_hex
from .backup_sections import archive_storage_root, collect_sections, ensure_known_services, restore_sections


ARCHIVE_FORMAT = "skynet-backup-v1"


async def create_backup_archive(
    session,
    *,
    services: list[str],
    password: str | None,
    note: str | None,
) -> BackupFileMetadata:
    selected = ensure_known_services(services)
    created_at = datetime.now(timezone.utc)
    payload, section_counts = await collect_sections(session, selected)
    payload_bytes = gzip.compress(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    salt = None
    encrypted = bool(password)
    if encrypted:
        payload_bytes, salt = encrypt_bytes(payload_bytes, password or "")
    wrapper = {
        "format": ARCHIVE_FORMAT,
        "created_at": created_at.isoformat(),
        "services": selected,
        "encrypted": encrypted,
        "note": (note.strip() or None) if note else None,
        "section_counts": section_counts,
        "sha256": sha256_hex(payload_bytes),
        "salt": encode_bytes(salt),
        "payload": encode_bytes(payload_bytes),
    }
    path = archive_storage_root() / _build_filename(created_at, selected)
    path.write_text(json.dumps(wrapper, separators=(",", ":")), encoding="utf-8")
    return _metadata_from_wrapper(path, wrapper)


def list_backup_archives() -> list[BackupFileMetadata]:
    items = []
    for path in sorted(archive_storage_root().glob("*.skynetbak"), reverse=True):
        try:
            items.append(read_backup_metadata(path))
        except (json.JSONDecodeError, ValueError):
            continue
    return items


def read_backup_metadata(path: Path) -> BackupFileMetadata:
    wrapper = _load_wrapper(path.read_bytes())
    _validate_wrapper(wrapper)
    return _metadata_from_wrapper(path, wrapper)


async def restore_backup_archive(
    session,
    *,
    raw_bytes: bytes,
    filename: str,
    mode: str,
    services: list[str],
    password: str | None,
) -> tuple[BackupFileMetadata, list[str]]:
    wrapper = _load_wrapper(raw_bytes)
    _validate_wrapper(wrapper)
    if mode not in {"full", "selective"}:
        raise ValueError("Restore mode must be 'full' or 'selective'.")
    archive_services = wrapper["services"]
    target_services = archive_services if mode == "full" else ensure_known_services(services)
    missing = [service for service in target_services if service not in archive_services]
    if missing:
        raise ValueError(f"Selected restore services are not present in the archive: {', '.join(missing)}")
    payload = _decode_payload(wrapper, password)
    await restore_sections(session, payload, target_services)
    return _metadata_from_wrapper(None, wrapper, filename=filename, raw_size=len(raw_bytes)), target_services


def backup_archive_path(filename: str) -> Path:
    safe_name = Path(filename).name
    if safe_name != filename or not safe_name.endswith(".skynetbak"):
        raise ValueError("Invalid backup filename.")
    path = archive_storage_root() / safe_name
    if not path.exists():
        raise ValueError("Backup archive not found.")
    return path


def _decode_payload(wrapper: dict, password: str | None) -> dict:
    payload_bytes = decode_bytes(wrapper.get("payload"))
    if payload_bytes is None:
        raise ValueError("Backup archive payload is missing.")
    if sha256_hex(payload_bytes) != wrapper.get("sha256"):
        raise ValueError("Backup archive integrity check failed.")
    if wrapper.get("encrypted"):
        payload_bytes = decrypt_bytes(payload_bytes, password or "", decode_bytes(wrapper.get("salt")))
    elif password and wrapper.get("salt"):
        raise ValueError("Unexpected password metadata on unencrypted backup.")
    try:
        return json.loads(gzip.decompress(payload_bytes).decode("utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("Backup archive payload is corrupted.") from exc


def _metadata_from_wrapper(
    path: Path | None,
    wrapper: dict,
    *,
    filename: str | None = None,
    raw_size: int | None = None,
) -> BackupFileMetadata:
    size_bytes = path.stat().st_size if path is not None else int(raw_size or 0)
    return BackupFileMetadata(
        filename=filename or path.name,
        created_at=datetime.fromisoformat(wrapper["created_at"].replace("Z", "+00:00")),
        services=wrapper["services"],
        encrypted=bool(wrapper.get("encrypted")),
        note=wrapper.get("note"),
        size_bytes=size_bytes,
        sha256=wrapper["sha256"],
        section_counts=wrapper.get("section_counts", {}),
    )


def _build_filename(created_at: datetime, services: list[str]) -> str:
    suffix = "full" if len(services) == 3 else "-".join(services)
    return f"skynet_{created_at.strftime('%Y%m%d_%H%M%S')}_{suffix}.skynetbak"


def _validate_wrapper(wrapper: dict) -> None:
    if wrapper.get("format") != ARCHIVE_FORMAT:
        raise ValueError("Unsupported backup archive format.")
    if not isinstance(wrapper.get("services"), list) or not wrapper["services"]:
        raise ValueError("Backup archive is missing its service manifest.")
    ensure_known_services(wrapper["services"])
    if not wrapper.get("created_at") or not wrapper.get("payload") or not wrapper.get("sha256"):
        raise ValueError("Backup archive metadata is incomplete.")


def _load_wrapper(raw_bytes: bytes) -> dict:
    try:
        return json.loads(raw_bytes.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("Backup archive file is invalid.") from exc
