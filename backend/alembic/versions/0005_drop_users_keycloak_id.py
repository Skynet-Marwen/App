"""drop users.keycloak_id — Keycloak no longer used for operator auth

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    return column_name in {c["name"] for c in inspector.get_columns(table_name)}


def _has_index(inspector, table_name: str, index_name: str) -> bool:
    return index_name in {i["name"] for i in inspector.get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _has_index(inspector, "users", "ix_users_keycloak_id"):
        op.drop_index("ix_users_keycloak_id", table_name="users")
    if _has_column(inspector, "users", "keycloak_id"):
        op.drop_column("users", "keycloak_id")


def downgrade() -> None:
    op.add_column("users", sa.Column("keycloak_id", sa.String(length=100), nullable=True))
    op.create_index("ix_users_keycloak_id", "users", ["keycloak_id"])
