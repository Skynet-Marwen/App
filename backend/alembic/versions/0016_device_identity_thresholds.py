"""add composite fingerprint and clock skew fields

Revision ID: 0016
Revises: 0015
Create Date: 2026-04-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("composite_fingerprint", sa.String(length=64), nullable=True))
    op.add_column("devices", sa.Column("composite_score", sa.Float(), nullable=False, server_default="0"))
    op.add_column("devices", sa.Column("timezone_offset_minutes", sa.Integer(), nullable=True))
    op.add_column("devices", sa.Column("clock_skew_minutes", sa.Integer(), nullable=True))
    op.create_index("ix_devices_composite_fingerprint", "devices", ["composite_fingerprint"], unique=False)
    op.alter_column("devices", "composite_score", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_devices_composite_fingerprint", table_name="devices")
    op.drop_column("devices", "clock_skew_minutes")
    op.drop_column("devices", "timezone_offset_minutes")
    op.drop_column("devices", "composite_score")
    op.drop_column("devices", "composite_fingerprint")
