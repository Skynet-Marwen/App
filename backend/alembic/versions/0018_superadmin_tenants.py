"""add superadmin role and tenant accounts

Revision ID: 0018
Revises: 0017
Create Date: 2026-04-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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

    if bind.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin'")

    if not _table_exists(inspector, "tenants"):
        op.create_table(
            "tenants",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("slug", sa.String(length=80), nullable=False),
            sa.Column("primary_host", sa.String(length=255), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("default_theme_id", sa.String(length=100), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["default_theme_id"], ["themes.id"], name="fk_tenants_default_theme_id_themes", ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_tenants_name", "tenants", ["name"], unique=True)
        op.create_index("ix_tenants_slug", "tenants", ["slug"], unique=True)
        op.create_index("ix_tenants_primary_host", "tenants", ["primary_host"], unique=False)
        op.create_index("ix_tenants_default_theme_id", "tenants", ["default_theme_id"], unique=False)
        op.alter_column("tenants", "is_active", server_default=None)

    inspector = inspect(bind)
    if not _column_exists(inspector, "users", "tenant_id"):
        op.add_column("users", sa.Column("tenant_id", sa.String(length=36), nullable=True))

    inspector = inspect(bind)
    if not _index_exists(inspector, "users", "ix_users_tenant_id"):
        op.create_index("ix_users_tenant_id", "users", ["tenant_id"], unique=False)
    if not _fk_exists(inspector, "users", "fk_users_tenant_id_tenants"):
        op.create_foreign_key(
            "fk_users_tenant_id_tenants",
            "users",
            "tenants",
            ["tenant_id"],
            ["id"],
            ondelete="SET NULL",
        )

    has_superadmin = bind.execute(sa.text("SELECT id FROM users WHERE role = 'superadmin' LIMIT 1")).scalar()
    if not has_superadmin:
        oldest_admin_id = bind.execute(
            sa.text("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC NULLS LAST, id ASC LIMIT 1")
        ).scalar()
        if oldest_admin_id:
            bind.execute(sa.text("UPDATE users SET role = 'superadmin' WHERE id = :user_id"), {"user_id": oldest_admin_id})


def downgrade() -> None:
    inspector = inspect(op.get_bind())

    if _fk_exists(inspector, "users", "fk_users_tenant_id_tenants"):
        op.drop_constraint("fk_users_tenant_id_tenants", "users", type_="foreignkey")
    if _index_exists(inspector, "users", "ix_users_tenant_id"):
        op.drop_index("ix_users_tenant_id", table_name="users")
    if _column_exists(inspector, "users", "tenant_id"):
        op.drop_column("users", "tenant_id")

    inspector = inspect(op.get_bind())
    if _table_exists(inspector, "tenants"):
        if _index_exists(inspector, "tenants", "ix_tenants_default_theme_id"):
            op.drop_index("ix_tenants_default_theme_id", table_name="tenants")
        if _index_exists(inspector, "tenants", "ix_tenants_primary_host"):
            op.drop_index("ix_tenants_primary_host", table_name="tenants")
        if _index_exists(inspector, "tenants", "ix_tenants_slug"):
            op.drop_index("ix_tenants_slug", table_name="tenants")
        if _index_exists(inspector, "tenants", "ix_tenants_name"):
            op.drop_index("ix_tenants_name", table_name="tenants")
        op.drop_table("tenants")
