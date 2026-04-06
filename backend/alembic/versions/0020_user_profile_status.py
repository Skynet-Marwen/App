"""add status column to user_profiles

Revision ID: 0020
Revises: 0019
Create Date: 2026-04-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    return column in [c["name"] for c in inspect(bind).get_columns(table)]


def upgrade() -> None:
    if not _column_exists("user_profiles", "status"):
        op.add_column(
            "user_profiles",
            sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        )
        op.create_index("ix_user_profiles_status", "user_profiles", ["status"])


def downgrade() -> None:
    if _column_exists("user_profiles", "status"):
        op.drop_index("ix_user_profiles_status", table_name="user_profiles")
        op.drop_column("user_profiles", "status")
