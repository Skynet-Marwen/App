from __future__ import annotations

import base64
from datetime import date, datetime
from pathlib import Path
import shutil

from sqlalchemy import DateTime, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import Base
from ..models import activity_event, anomaly_flag, audit_log, blocking  # noqa: F401
from ..models import device, event, identity_link, incident, risk_event  # noqa: F401
from ..models import site, user, user_profile, visitor  # noqa: F401
from ..models.block_page_config import BlockPageConfig
from .anti_evasion_config import DEFAULT_ANTI_EVASION_CONFIG
from .runtime_config import (
    replace_anti_evasion_settings,
    replace_runtime_settings,
    runtime_settings_snapshot,
    anti_evasion_settings_snapshot,
)


BACKUP_SERVICES = ("database", "settings", "assets")
_EXCLUDED_TABLES = {"block_page_config"}


def asset_root() -> Path:
    root = Path(__file__).resolve().parents[2] / "data"
    root.mkdir(parents=True, exist_ok=True)
    return root


async def collect_sections(
    session: AsyncSession,
    services: list[str],
) -> tuple[dict[str, dict], dict[str, int]]:
    payload: dict[str, dict] = {}
    counts: dict[str, int] = {}
    if "database" in services:
        database = await _snapshot_database(session)
        payload["database"] = database
        counts["database"] = sum(len(rows) for rows in database.values())
    if "settings" in services:
        settings_payload = await _snapshot_settings(session)
        payload["settings"] = settings_payload
        counts["settings"] = (
            len(settings_payload["runtime"])
            + len(settings_payload["anti_evasion"])
            + int(settings_payload["block_page"] is not None)
        )
    if "assets" in services:
        assets = _snapshot_assets()
        payload["assets"] = assets
        counts["assets"] = len(assets["files"])
    return payload, counts


async def restore_sections(
    session: AsyncSession,
    payload: dict[str, dict],
    services: list[str],
) -> dict[str, int]:
    counts: dict[str, int] = {}
    if "database" in services:
        await _restore_database(session, payload.get("database", {}))
        counts["database"] = sum(len(rows) for rows in payload.get("database", {}).values())
    if "settings" in services:
        await _restore_settings(session, payload.get("settings", {}))
        counts["settings"] = (
            len(payload.get("settings", {}).get("runtime", {}))
            + len(payload.get("settings", {}).get("anti_evasion", {}))
        )
    if "assets" in services:
        _restore_assets(payload.get("assets", {}))
        counts["assets"] = len(payload.get("assets", {}).get("files", {}))
    return counts


def ensure_known_services(services: list[str]) -> list[str]:
    unique = list(dict.fromkeys(services))
    invalid = [service for service in unique if service not in BACKUP_SERVICES]
    if invalid:
        raise ValueError(f"Unknown backup services: {', '.join(invalid)}")
    if not unique:
        raise ValueError("Select at least one backup service.")
    return unique


def archive_storage_root() -> Path:
    root = asset_root() / "backups"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _database_tables():
    return [table for table in Base.metadata.sorted_tables if table.name not in _EXCLUDED_TABLES]


async def _snapshot_database(session: AsyncSession) -> dict[str, list[dict]]:
    payload: dict[str, list[dict]] = {}
    for table in _database_tables():
        result = await session.execute(select(table))
        payload[table.name] = [
            {key: _serialize_value(value) for key, value in row.items()}
            for row in result.mappings().all()
        ]
    return payload


async def _restore_database(session: AsyncSession, payload: dict[str, list[dict]]) -> None:
    for table in reversed(_database_tables()):
        await session.execute(delete(table))
    for table in _database_tables():
        rows = payload.get(table.name, [])
        if not rows:
            continue
        await session.execute(table.insert(), [_coerce_row(table, row) for row in rows])
    await session.flush()


async def _snapshot_settings(session: AsyncSession) -> dict[str, dict]:
    block_page = await session.get(BlockPageConfig, 1)
    return {
        "runtime": runtime_settings_snapshot(),
        "anti_evasion": anti_evasion_settings_snapshot(),
        "block_page": None if not block_page else {
            "id": block_page.id,
            "title": block_page.title,
            "subtitle": block_page.subtitle,
            "message": block_page.message,
            "bg_color": block_page.bg_color,
            "accent_color": block_page.accent_color,
            "logo_url": block_page.logo_url,
            "contact_email": block_page.contact_email,
            "show_request_id": block_page.show_request_id,
            "show_contact": block_page.show_contact,
        },
    }


async def _restore_settings(session: AsyncSession, payload: dict[str, dict]) -> None:
    runtime = payload.get("runtime")
    if not isinstance(runtime, dict):
        raise ValueError("Backup archive does not contain settings data.")
    anti_evasion = payload.get("anti_evasion", DEFAULT_ANTI_EVASION_CONFIG)
    if not isinstance(anti_evasion, dict):
        raise ValueError("Backup archive anti-evasion config is invalid.")
    await replace_runtime_settings(session, runtime)
    await replace_anti_evasion_settings(session, anti_evasion)
    block_page_payload = payload.get("block_page")
    current = await session.get(BlockPageConfig, 1)
    if not block_page_payload:
        if current is not None:
            await session.delete(current)
        await session.flush()
        return
    if current is None:
        current = BlockPageConfig(id=1)
        session.add(current)
    for key, value in block_page_payload.items():
        if key != "id":
            setattr(current, key, value)
    await session.flush()


def _snapshot_assets() -> dict[str, dict[str, str]]:
    files: dict[str, str] = {}
    root = asset_root()
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel_path = path.relative_to(root).as_posix()
        if rel_path.startswith("backups/"):
            continue
        files[rel_path] = base64.b64encode(path.read_bytes()).decode("ascii")
    return {"files": files}


def _restore_assets(payload: dict[str, dict[str, str]]) -> None:
    files = payload.get("files")
    if not isinstance(files, dict):
        raise ValueError("Backup archive does not contain assets data.")
    root = asset_root()
    for path in sorted(root.rglob("*"), reverse=True):
        if path == root:
            continue
        rel_path = path.relative_to(root).as_posix()
        if rel_path == "backups" or rel_path.startswith("backups/"):
            continue
        if path.is_file():
            path.unlink()
        elif path.is_dir():
            shutil.rmtree(path)
    for rel_path, content in files.items():
        destination = root / rel_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(base64.b64decode(content.encode("ascii")))


def _serialize_value(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _coerce_row(table, row: dict) -> dict:
    coerced = {}
    for column in table.columns:
        if column.name not in row:
            continue
        value = row[column.name]
        if value is None:
            coerced[column.name] = None
        elif isinstance(column.type, DateTime):
            coerced[column.name] = datetime.fromisoformat(value.replace("Z", "+00:00"))
        else:
            coerced[column.name] = value
    return coerced
