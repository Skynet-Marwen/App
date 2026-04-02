"""add runtime config store

Revision ID: 0014
Revises: 0013
Create Date: 2026-04-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _table_exists(inspector, "runtime_config"):
        return
    op.create_table(
        "runtime_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("runtime_settings", sa.JSON(), nullable=False),
        sa.Column("anti_evasion_config", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("runtime_config")
