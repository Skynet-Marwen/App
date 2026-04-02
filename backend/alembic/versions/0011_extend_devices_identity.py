"""extend devices table with identity fields

Revision ID: 0011
Revises: 0010
Create Date: 2026-03-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    return column_name in {c["name"] for c in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not _has_column(inspector, "devices", "owner_user_id"):
        op.add_column("devices", sa.Column("owner_user_id", sa.String(255), nullable=True))
    if not _has_column(inspector, "devices", "shared_user_count"):
        op.add_column("devices", sa.Column("shared_user_count", sa.Integer, nullable=False, server_default="0"))
    if not _has_column(inspector, "devices", "last_known_platform"):
        op.add_column("devices", sa.Column("last_known_platform", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("devices", "last_known_platform")
    op.drop_column("devices", "shared_user_count")
    op.drop_column("devices", "owner_user_id")
