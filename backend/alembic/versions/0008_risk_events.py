"""create risk_events table

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _table_exists(inspector, "risk_events"):
        return
    op.create_table(
        "risk_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("external_user_id", sa.String(255), nullable=False),
        sa.Column("score", sa.Float, nullable=False),
        sa.Column("delta", sa.Float, nullable=False),
        sa.Column("trigger_type", sa.String(50), nullable=False),
        sa.Column("trigger_detail", sa.Text, nullable=True),  # JSON blob
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_risk_events_user_created", "risk_events", ["external_user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_risk_events_user_created", table_name="risk_events")
    op.drop_table("risk_events")
