"""add strict device match grouping

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-30
"""
import hashlib
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MATCH_VERSION = 1


def _normalize_language(language: str | None) -> str | None:
    if not language:
        return None
    head = language.split(",")[0].strip()
    if not head:
        return None
    primary = head.replace("_", "-").split("-")[0].strip().lower()
    return primary or None


def _build_match_key(webgl_hash: str | None, screen_resolution: str | None, timezone_name: str | None, language: str | None) -> str | None:
    normalized_language = _normalize_language(language)
    if not all([webgl_hash, screen_resolution, timezone_name, normalized_language]):
        return None
    raw = "||".join([webgl_hash, screen_resolution, timezone_name, normalized_language])
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f"strict:v{MATCH_VERSION}:{digest}"


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not _has_column(inspector, "devices", "match_key"):
        op.add_column("devices", sa.Column("match_key", sa.String(length=80), nullable=True))
    if not _has_column(inspector, "devices", "match_version"):
        op.add_column("devices", sa.Column("match_version", sa.Integer(), nullable=True))
    indexes = {index["name"] for index in inspector.get_indexes("devices")}
    if "ix_devices_match_key" not in indexes:
        op.create_index("ix_devices_match_key", "devices", ["match_key"])
    visitor_indexes = {index["name"] for index in inspector.get_indexes("visitors")}
    if "ix_visitors_site_device_ip" not in visitor_indexes:
        op.create_index("ix_visitors_site_device_ip", "visitors", ["site_id", "device_id", "ip"])

    rows = bind.execute(
        sa.text(
            "SELECT id, webgl_hash, screen_resolution, timezone, language FROM devices"
        )
    ).mappings().all()
    for row in rows:
        match_key = _build_match_key(
            row["webgl_hash"],
            row["screen_resolution"],
            row["timezone"],
            row["language"],
        )
        bind.execute(
            sa.text(
                "UPDATE devices SET match_key = :match_key, match_version = :match_version WHERE id = :id"
            ),
            {
                "id": row["id"],
                "match_key": match_key,
                "match_version": MATCH_VERSION if match_key else None,
            },
        )


def downgrade() -> None:
    op.drop_index("ix_visitors_site_device_ip", table_name="visitors")
    op.drop_index("ix_devices_match_key", table_name="devices")
    op.drop_column("devices", "match_version")
    op.drop_column("devices", "match_key")
