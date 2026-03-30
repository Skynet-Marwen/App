"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-30

Creates all tables from the v1.0.0 schema.
Each table creation is guarded by an existence check so this migration
is safe to run against a database that was bootstrapped by create_all().
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _exists(conn, table: str) -> bool:
    return inspect(conn).has_table(table)


def upgrade() -> None:
    conn = op.get_bind()

    # ── PostgreSQL enum types — no-op if already exist ──────────────────────
    conn.execute(sa.text(
        "DO $$ BEGIN "
        "  CREATE TYPE user_role AS ENUM ('admin', 'moderator', 'user'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$"
    ))
    conn.execute(sa.text(
        "DO $$ BEGIN "
        "  CREATE TYPE user_status AS ENUM ('active', 'blocked', 'pending'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$"
    ))

    # ── users ────────────────────────────────────────────────────────────────
    if not _exists(conn, "users"):
        op.create_table(
            "users",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("email", sa.String(255), nullable=False),
            sa.Column("username", sa.String(100), nullable=False),
            sa.Column("hashed_password", sa.String(255), nullable=True),
            sa.Column("role",
                sa.Enum("admin", "moderator", "user", name="user_role", create_type=False),
                nullable=False, server_default="user"),
            sa.Column("status",
                sa.Enum("active", "blocked", "pending", name="user_status", create_type=False),
                nullable=False, server_default="active"),
            sa.Column("keycloak_id", sa.String(100), nullable=True),
            sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_users_email",       "users", ["email"],       unique=True)
        op.create_index("ix_users_username",    "users", ["username"],    unique=True)
        op.create_index("ix_users_keycloak_id", "users", ["keycloak_id"])

    # ── sites ────────────────────────────────────────────────────────────────
    if not _exists(conn, "sites"):
        op.create_table(
            "sites",
            sa.Column("id",          sa.String(36),  primary_key=True),
            sa.Column("name",        sa.String(200), nullable=False),
            sa.Column("url",         sa.String(500), nullable=False),
            sa.Column("description", sa.Text,        nullable=True),
            sa.Column("api_key",     sa.String(64),  nullable=False),
            sa.Column("active",      sa.Boolean,     nullable=False, server_default="true"),
            sa.Column("created_at",  sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_sites_api_key", "sites", ["api_key"], unique=True)

    # ── devices ──────────────────────────────────────────────────────────────
    if not _exists(conn, "devices"):
        op.create_table(
            "devices",
            sa.Column("id",                sa.String(36),  primary_key=True),
            sa.Column("fingerprint",       sa.String(128), nullable=False),
            sa.Column("type",              sa.String(50),  nullable=True),
            sa.Column("browser",           sa.String(100), nullable=True),
            sa.Column("os",                sa.String(100), nullable=True),
            sa.Column("screen_resolution", sa.String(20),  nullable=True),
            sa.Column("language",          sa.String(20),  nullable=True),
            sa.Column("timezone",          sa.String(50),  nullable=True),
            sa.Column("canvas_hash",       sa.String(64),  nullable=True),
            sa.Column("webgl_hash",        sa.String(64),  nullable=True),
            sa.Column("audio_hash",        sa.String(64),  nullable=True),
            sa.Column("font_list",         sa.Text,        nullable=True),
            sa.Column("risk_score",        sa.Integer,     nullable=False, server_default="0"),
            sa.Column("status",            sa.String(20),  nullable=False, server_default="active"),
            sa.Column("linked_user",       sa.String(36),
                sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("first_seen", sa.DateTime(timezone=True), nullable=False),
            sa.Column("last_seen",  sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_devices_fingerprint", "devices", ["fingerprint"], unique=True)
        op.create_index("ix_devices_status",      "devices", ["status"])

    # ── visitors ─────────────────────────────────────────────────────────────
    if not _exists(conn, "visitors"):
        op.create_table(
            "visitors",
            sa.Column("id",           sa.String(36),  primary_key=True),
            sa.Column("ip",           sa.String(45),  nullable=False),
            sa.Column("country",      sa.String(100), nullable=True),
            sa.Column("country_code", sa.String(2),   nullable=True),
            sa.Column("country_flag", sa.String(10),  nullable=True),
            sa.Column("city",         sa.String(100), nullable=True),
            sa.Column("isp",          sa.String(200), nullable=True),
            sa.Column("device_type",  sa.String(50),  nullable=True),
            sa.Column("browser",      sa.String(100), nullable=True),
            sa.Column("os",           sa.String(100), nullable=True),
            sa.Column("user_agent",   sa.Text,        nullable=True),
            sa.Column("status",       sa.String(20),  nullable=False, server_default="active"),
            sa.Column("page_views",   sa.Integer,     nullable=False, server_default="0"),
            sa.Column("site_id",    sa.String(36),
                sa.ForeignKey("sites.id",   ondelete="SET NULL"), nullable=True),
            sa.Column("linked_user", sa.String(36),
                sa.ForeignKey("users.id",   ondelete="SET NULL"), nullable=True),
            sa.Column("device_id",   sa.String(36),
                sa.ForeignKey("devices.id", ondelete="SET NULL"), nullable=True),
            sa.Column("first_seen", sa.DateTime(timezone=True), nullable=False),
            sa.Column("last_seen",  sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_visitors_ip",     "visitors", ["ip"])
        op.create_index("ix_visitors_status", "visitors", ["status"])

    # ── events ───────────────────────────────────────────────────────────────
    if not _exists(conn, "events"):
        op.create_table(
            "events",
            sa.Column("id",         sa.String(36),   primary_key=True),
            sa.Column("site_id",    sa.String(36),
                sa.ForeignKey("sites.id", ondelete="CASCADE"), nullable=True),
            sa.Column("visitor_id", sa.String(36),   nullable=True),
            sa.Column("user_id",    sa.String(36),   nullable=True),
            sa.Column("device_id",  sa.String(36),   nullable=True),
            sa.Column("event_type", sa.String(100),  nullable=False),
            sa.Column("page_url",   sa.String(2048), nullable=True),
            sa.Column("referrer",   sa.String(2048), nullable=True),
            sa.Column("properties", sa.Text,         nullable=True),
            sa.Column("ip",         sa.String(45),   nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_events_site_id",    "events", ["site_id"])
        op.create_index("ix_events_visitor_id", "events", ["visitor_id"])
        op.create_index("ix_events_event_type", "events", ["event_type"])
        op.create_index("ix_events_created_at", "events", ["created_at"])

    # ── blocking_rules ────────────────────────────────────────────────────────
    if not _exists(conn, "blocking_rules"):
        op.create_table(
            "blocking_rules",
            sa.Column("id",         sa.String(36),  primary_key=True),
            sa.Column("type",       sa.String(30),  nullable=False),
            sa.Column("value",      sa.String(500), nullable=False),
            sa.Column("reason",     sa.String(500), nullable=True),
            sa.Column("action",     sa.String(20),  nullable=False, server_default="block"),
            sa.Column("hits",       sa.Integer,     nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )

    # ── blocked_ips ───────────────────────────────────────────────────────────
    if not _exists(conn, "blocked_ips"):
        op.create_table(
            "blocked_ips",
            sa.Column("ip",           sa.String(50),  primary_key=True),
            sa.Column("country",      sa.String(100), nullable=True),
            sa.Column("country_flag", sa.String(10),  nullable=True),
            sa.Column("reason",       sa.String(500), nullable=True),
            sa.Column("hits",         sa.Integer,     nullable=False, server_default="0"),
            sa.Column("blocked_at",   sa.DateTime(timezone=True), nullable=False),
        )

    # ── incidents ─────────────────────────────────────────────────────────────
    if not _exists(conn, "incidents"):
        op.create_table(
            "incidents",
            sa.Column("id",          sa.String(36),  primary_key=True),
            sa.Column("type",        sa.String(100), nullable=False),
            sa.Column("description", sa.Text,        nullable=True),
            sa.Column("ip",          sa.String(45),  nullable=True),
            sa.Column("device_id",   sa.String(36),  nullable=True),
            sa.Column("user_id",     sa.String(36),  nullable=True),
            sa.Column("severity",    sa.String(20),  nullable=False, server_default="medium"),
            sa.Column("status",      sa.String(20),  nullable=False, server_default="open"),
            sa.Column("metadata",    sa.Text,        nullable=True),
            sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    op.drop_table("incidents")
    op.drop_table("blocked_ips")
    op.drop_table("blocking_rules")
    op.drop_table("events")
    op.drop_table("visitors")
    op.drop_table("devices")
    op.drop_table("sites")
    op.drop_table("users")
    op.execute(sa.text("DROP TYPE IF EXISTS user_status"))
    op.execute(sa.text("DROP TYPE IF EXISTS user_role"))
