"""add visitor external user ownership

Revision ID: 0019
Revises: 0018
Create Date: 2026-04-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(inspector, table: str, column: str) -> bool:
    return column in {entry["name"] for entry in inspector.get_columns(table)}


def _index_exists(inspector, table: str, name: str) -> bool:
    return any(entry["name"] == name for entry in inspector.get_indexes(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _column_exists(inspector, "visitors", "external_user_id"):
        op.add_column("visitors", sa.Column("external_user_id", sa.String(length=255), nullable=True))

    inspector = inspect(bind)
    if not _index_exists(inspector, "visitors", "ix_visitors_external_user_id"):
        op.create_index("ix_visitors_external_user_id", "visitors", ["external_user_id"], unique=False)

    bind.execute(
        sa.text(
            """
            UPDATE visitors
            SET external_user_id = (
                SELECT devices.owner_user_id
                FROM devices
                WHERE devices.id = visitors.device_id
            )
            WHERE visitors.external_user_id IS NULL
              AND visitors.device_id IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM devices
                  WHERE devices.id = visitors.device_id
                    AND devices.owner_user_id IS NOT NULL
                    AND COALESCE(devices.shared_user_count, 0) = 0
              )
            """
        )
    )


def downgrade() -> None:
    inspector = inspect(op.get_bind())
    if _index_exists(inspector, "visitors", "ix_visitors_external_user_id"):
        op.drop_index("ix_visitors_external_user_id", table_name="visitors")
    if _column_exists(inspector, "visitors", "external_user_id"):
        op.drop_column("visitors", "external_user_id")
