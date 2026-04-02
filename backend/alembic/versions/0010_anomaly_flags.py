"""create anomaly_flags table

Revision ID: 0010
Revises: 0009
Create Date: 2026-03-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _table_exists(inspector, "anomaly_flags"):
        return
    op.create_table(
        "anomaly_flags",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("external_user_id", sa.String(255), nullable=False),
        sa.Column("flag_type", sa.String(50), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("related_device_id", sa.String(36), nullable=True),
        sa.Column("related_visitor_id", sa.String(36), nullable=True),
        sa.Column("evidence", sa.Text, nullable=True),  # JSON blob
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_anomaly_flags_external_user_id", "anomaly_flags", ["external_user_id"])
    op.create_index("ix_anomaly_flags_status_severity", "anomaly_flags", ["status", "severity"])
    op.create_index("ix_anomaly_flags_detected_at", "anomaly_flags", ["detected_at"])


def downgrade() -> None:
    op.drop_index("ix_anomaly_flags_detected_at", table_name="anomaly_flags")
    op.drop_index("ix_anomaly_flags_status_severity", table_name="anomaly_flags")
    op.drop_index("ix_anomaly_flags_external_user_id", table_name="anomaly_flags")
    op.drop_table("anomaly_flags")
