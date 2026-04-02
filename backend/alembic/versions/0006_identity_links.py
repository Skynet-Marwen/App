"""create identity_links table

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _table_exists(inspector, "identity_links"):
        return
    op.create_table(
        "identity_links",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("external_user_id", sa.String(255), nullable=False),
        sa.Column("id_provider", sa.String(50), nullable=False, server_default="keycloak"),
        sa.Column("fingerprint_id", sa.String(36), sa.ForeignKey("devices.id", ondelete="SET NULL"), nullable=True),
        sa.Column("visitor_id", sa.String(36), sa.ForeignKey("visitors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("platform", sa.String(20), nullable=False, server_default="web"),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("linked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("external_user_id", "fingerprint_id", name="uq_identity_link_user_device"),
    )
    op.create_index("ix_identity_links_external_user_id", "identity_links", ["external_user_id"])
    op.create_index("ix_identity_links_fingerprint_id", "identity_links", ["fingerprint_id"])


def downgrade() -> None:
    op.drop_index("ix_identity_links_fingerprint_id", table_name="identity_links")
    op.drop_index("ix_identity_links_external_user_id", table_name="identity_links")
    op.drop_table("identity_links")
