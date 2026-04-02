"""add theme registry and per-user theme assignment

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-01
"""
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_THEME_ID = "skynet-default"


def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def _column_exists(inspector, table: str, column: str) -> bool:
    return column in {entry["name"] for entry in inspector.get_columns(table)}


def _index_exists(inspector, table: str, name: str) -> bool:
    return any(entry["name"] == name for entry in inspector.get_indexes(table))


def _fk_exists(inspector, table: str, name: str) -> bool:
    return any(entry["name"] == name for entry in inspector.get_foreign_keys(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _table_exists(inspector, "themes"):
        op.create_table(
            "themes",
            sa.Column("id", sa.String(length=100), primary_key=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("colors", sa.JSON(), nullable=False),
            sa.Column("layout", sa.JSON(), nullable=False),
            sa.Column("widgets", sa.JSON(), nullable=False),
            sa.Column("branding", sa.JSON(), nullable=True),
            sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_themes_name", "themes", ["name"], unique=True)

    inspector = inspect(bind)
    if not _column_exists(inspector, "users", "theme_id"):
        op.add_column("users", sa.Column("theme_id", sa.String(length=100), nullable=True))
    if not _column_exists(inspector, "users", "theme_source"):
        op.add_column("users", sa.Column("theme_source", sa.String(length=20), nullable=True))

    inspector = inspect(bind)
    if not _index_exists(inspector, "users", "ix_users_theme_id"):
        op.create_index("ix_users_theme_id", "users", ["theme_id"], unique=False)
    if not _fk_exists(inspector, "users", "fk_users_theme_id_themes"):
        op.create_foreign_key(
            "fk_users_theme_id_themes",
            "users",
            "themes",
            ["theme_id"],
            ["id"],
            ondelete="SET NULL",
        )

    theme_table = sa.table(
        "themes",
        sa.column("id", sa.String),
        sa.column("name", sa.String),
        sa.column("colors", sa.JSON),
        sa.column("layout", sa.JSON),
        sa.column("widgets", sa.JSON),
        sa.column("branding", sa.JSON),
        sa.column("is_default", sa.Boolean),
        sa.column("is_active", sa.Boolean),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    existing_default = bind.execute(
        sa.text("SELECT id FROM themes WHERE id = :theme_id"),
        {"theme_id": DEFAULT_THEME_ID},
    ).scalar()
    if not existing_default:
        now = datetime.now(timezone.utc)
        op.bulk_insert(
            theme_table,
            [
                {
                    "id": DEFAULT_THEME_ID,
                    "name": "SkyNet Default",
                    "colors": {
                        "primary": "#22d3ee",
                        "secondary": "#0f172a",
                        "accent": "#06b6d4",
                        "background": "#030712",
                        "surface": "#111827",
                        "text": "#e5e7eb",
                        "muted": "#94a3b8",
                        "success": "#10b981",
                        "warning": "#f59e0b",
                        "danger": "#ef4444",
                    },
                    "layout": {
                        "density": "comfortable",
                        "sidebar": "expanded",
                        "panel_style": "glass",
                    },
                    "widgets": [],
                    "branding": {
                        "logo_text": "SkyNet",
                        "tagline": "Security Dashboard",
                    },
                    "is_default": True,
                    "is_active": True,
                    "created_at": now,
                    "updated_at": now,
                }
            ],
        )

    bind.execute(sa.text("UPDATE themes SET is_default = false WHERE id != :theme_id"), {"theme_id": DEFAULT_THEME_ID})
    bind.execute(
        sa.text(
            "UPDATE users "
            "SET theme_id = :theme_id, theme_source = COALESCE(theme_source, 'default') "
            "WHERE theme_id IS NULL"
        ),
        {"theme_id": DEFAULT_THEME_ID},
    )
    bind.execute(
        sa.text("UPDATE users SET theme_source = 'default' WHERE theme_source IS NULL"),
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_theme_id_themes", "users", type_="foreignkey")
    op.drop_index("ix_users_theme_id", table_name="users")
    op.drop_column("users", "theme_source")
    op.drop_column("users", "theme_id")
    op.drop_index("ix_themes_name", table_name="themes")
    op.drop_table("themes")
