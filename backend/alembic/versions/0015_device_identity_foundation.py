"""add device identity foundation fields

Revision ID: 0015
Revises: 0014
Create Date: 2026-04-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("device_cookie_id", sa.String(length=64), nullable=True))
    op.add_column("devices", sa.Column("fingerprint_version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("devices", sa.Column("fingerprint_confidence", sa.Float(), nullable=False, server_default="0"))
    op.add_column("devices", sa.Column("stability_score", sa.Float(), nullable=False, server_default="1"))
    op.add_column("devices", sa.Column("fingerprint_snapshot", sa.Text(), nullable=True))
    op.create_index("ix_devices_device_cookie_id", "devices", ["device_cookie_id"], unique=True)

    op.alter_column("devices", "fingerprint_version", server_default=None)
    op.alter_column("devices", "fingerprint_confidence", server_default=None)
    op.alter_column("devices", "stability_score", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_devices_device_cookie_id", table_name="devices")
    op.drop_column("devices", "fingerprint_snapshot")
    op.drop_column("devices", "stability_score")
    op.drop_column("devices", "fingerprint_confidence")
    op.drop_column("devices", "fingerprint_version")
    op.drop_column("devices", "device_cookie_id")
