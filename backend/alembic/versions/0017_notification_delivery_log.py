"""add notification delivery log

Revision ID: 0017
Revises: 0016
Create Date: 2026-04-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notification_deliveries",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("channel", sa.String(length=20), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("target", sa.String(length=255), nullable=False),
        sa.Column("subject", sa.String(length=200), nullable=True),
        sa.Column("response_status", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("payload_excerpt", sa.Text(), nullable=True),
        sa.Column("incident_id", sa.String(length=36), nullable=True),
        sa.Column("escalation_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notification_deliveries_channel", "notification_deliveries", ["channel"], unique=False)
    op.create_index("ix_notification_deliveries_event_type", "notification_deliveries", ["event_type"], unique=False)
    op.create_index("ix_notification_deliveries_status", "notification_deliveries", ["status"], unique=False)
    op.create_index("ix_notification_deliveries_incident_id", "notification_deliveries", ["incident_id"], unique=False)
    op.create_index("ix_notification_deliveries_created_at", "notification_deliveries", ["created_at"], unique=False)
    op.alter_column("notification_deliveries", "escalation_level", server_default=None)
    op.alter_column("notification_deliveries", "attempt_count", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_notification_deliveries_created_at", table_name="notification_deliveries")
    op.drop_index("ix_notification_deliveries_incident_id", table_name="notification_deliveries")
    op.drop_index("ix_notification_deliveries_status", table_name="notification_deliveries")
    op.drop_index("ix_notification_deliveries_event_type", table_name="notification_deliveries")
    op.drop_index("ix_notification_deliveries_channel", table_name="notification_deliveries")
    op.drop_table("notification_deliveries")
