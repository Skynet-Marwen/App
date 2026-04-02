"""create user_profiles table

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _table_exists(inspector, "user_profiles"):
        return
    op.create_table(
        "user_profiles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("external_user_id", sa.String(255), unique=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("current_risk_score", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("trust_level", sa.String(20), nullable=False, server_default="normal"),
        sa.Column("total_devices", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_sessions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_ip", sa.String(45), nullable=True),
        sa.Column("last_country", sa.String(2), nullable=True),
        sa.Column("enhanced_audit", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("profile_data", sa.Text, nullable=True),  # JSON blob
    )
    op.create_index("ix_user_profiles_external_user_id", "user_profiles", ["external_user_id"])
    op.create_index("ix_user_profiles_trust_level", "user_profiles", ["trust_level"])
    op.create_index("ix_user_profiles_risk_score", "user_profiles", ["current_risk_score"])


def downgrade() -> None:
    op.drop_index("ix_user_profiles_risk_score", table_name="user_profiles")
    op.drop_index("ix_user_profiles_trust_level", table_name="user_profiles")
    op.drop_index("ix_user_profiles_external_user_id", table_name="user_profiles")
    op.drop_table("user_profiles")
