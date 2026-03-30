"""add block_page_config table

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if "block_page_config" not in inspector.get_table_names():
        op.create_table(
            "block_page_config",
            sa.Column("id",             sa.Integer(),     primary_key=True),
            sa.Column("title",          sa.String(120),   nullable=False, server_default="ACCESS RESTRICTED"),
            sa.Column("subtitle",       sa.String(240),   nullable=False, server_default="Your access to this site has been blocked."),
            sa.Column("message",        sa.Text(),        nullable=False, server_default="This action was taken automatically for security reasons."),
            sa.Column("bg_color",       sa.String(20),    nullable=False, server_default="#050505"),
            sa.Column("accent_color",   sa.String(20),    nullable=False, server_default="#ef4444"),
            sa.Column("logo_url",       sa.String(512),   nullable=True),
            sa.Column("contact_email",  sa.String(255),   nullable=True),
            sa.Column("show_request_id", sa.Boolean(),    nullable=False, server_default=sa.true()),
            sa.Column("show_contact",   sa.Boolean(),     nullable=False, server_default=sa.true()),
        )
        # Insert the default config row
        op.execute(
            "INSERT INTO block_page_config (id, title, subtitle, message, bg_color, accent_color, show_request_id, show_contact) "
            "VALUES (1, 'ACCESS RESTRICTED', 'Your access to this site has been blocked.', "
            "'This action was taken automatically for security reasons. If you believe this is a mistake, contact the site administrator.', "
            "'#050505', '#ef4444', TRUE, TRUE)"
        )


def downgrade() -> None:
    op.drop_table("block_page_config")
