"""create activity_events table

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _table_exists(inspector, "activity_events"):
        return
    op.create_table(
        "activity_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("external_user_id", sa.String(255), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("platform", sa.String(20), nullable=True),
        sa.Column("site_id", sa.String(36), sa.ForeignKey("sites.id", ondelete="SET NULL"), nullable=True),
        sa.Column("fingerprint_id", sa.String(36), sa.ForeignKey("devices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("country", sa.String(2), nullable=True),
        sa.Column("page_url", sa.String(2048), nullable=True),
        sa.Column("properties", sa.Text, nullable=True),  # JSON blob
        sa.Column("session_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_activity_events_user_created", "activity_events", ["external_user_id", "created_at"])
    op.create_index("ix_activity_events_event_type", "activity_events", ["event_type"])
    op.create_index("ix_activity_events_session_id", "activity_events", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_activity_events_session_id", table_name="activity_events")
    op.drop_index("ix_activity_events_event_type", table_name="activity_events")
    op.drop_index("ix_activity_events_user_created", table_name="activity_events")
    op.drop_table("activity_events")
