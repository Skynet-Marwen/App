"""add stie threat intelligence and security center tables

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _table_exists(inspector, "threat_intel"):
        op.create_table(
            "threat_intel",
            sa.Column("id", sa.String(length=120), primary_key=True),
            sa.Column("source", sa.String(length=40), nullable=False),
            sa.Column("severity", sa.Float(), nullable=False, server_default="0"),
            sa.Column("severity_label", sa.String(length=20), nullable=False, server_default="low"),
            sa.Column("affected_software", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("references", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_threat_intel_source", "threat_intel", ["source"], unique=False)
        op.create_index("ix_threat_intel_severity", "threat_intel", ["severity"], unique=False)
        op.create_index("ix_threat_intel_updated_at", "threat_intel", ["updated_at"], unique=False)

    inspector = inspect(bind)
    if not _table_exists(inspector, "target_profile"):
        op.create_table(
            "target_profile",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("site_id", sa.String(length=36), nullable=True),
            sa.Column("base_url", sa.String(length=500), nullable=False),
            sa.Column("detected_server", sa.String(length=255), nullable=True),
            sa.Column("powered_by", sa.String(length=255), nullable=True),
            sa.Column("frameworks", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("technologies", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("response_headers", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("observed_endpoints", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("scan_status", sa.String(length=20), nullable=False, server_default="idle"),
            sa.Column("last_scanned_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="SET NULL"),
        )
        op.create_index("ix_target_profile_site_id", "target_profile", ["site_id"], unique=False)
        op.create_index("ix_target_profile_base_url", "target_profile", ["base_url"], unique=False)
        op.create_index("ix_target_profile_last_scanned_at", "target_profile", ["last_scanned_at"], unique=False)

    inspector = inspect(bind)
    if not _table_exists(inspector, "security_findings"):
        op.create_table(
            "security_findings",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("site_id", sa.String(length=36), nullable=True),
            sa.Column("profile_id", sa.String(length=36), nullable=True),
            sa.Column("finding_type", sa.String(length=60), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("severity", sa.String(length=20), nullable=False),
            sa.Column("endpoint", sa.String(length=1000), nullable=False),
            sa.Column("evidence", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("correlated_risk_score", sa.Float(), nullable=False, server_default="0"),
            sa.Column("active_exploitation_suspected", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["profile_id"], ["target_profile.id"], ondelete="SET NULL"),
        )
        op.create_index("ix_security_findings_site_id", "security_findings", ["site_id"], unique=False)
        op.create_index("ix_security_findings_profile_id", "security_findings", ["profile_id"], unique=False)
        op.create_index("ix_security_findings_finding_type", "security_findings", ["finding_type"], unique=False)
        op.create_index("ix_security_findings_severity", "security_findings", ["severity"], unique=False)
        op.create_index("ix_security_findings_status", "security_findings", ["status"], unique=False)
        op.create_index("ix_security_findings_correlated_risk_score", "security_findings", ["correlated_risk_score"], unique=False)
        op.create_index("ix_security_findings_active_exploitation_suspected", "security_findings", ["active_exploitation_suspected"], unique=False)
        op.create_index("ix_security_findings_created_at", "security_findings", ["created_at"], unique=False)

    inspector = inspect(bind)
    if not _table_exists(inspector, "security_recommendations"):
        op.create_table(
            "security_recommendations",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("finding_id", sa.String(length=36), nullable=False),
            sa.Column("recommendation_text", sa.Text(), nullable=False),
            sa.Column("priority", sa.String(length=20), nullable=False, server_default="medium"),
            sa.Column("auto_applicable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("action_key", sa.String(length=80), nullable=True),
            sa.Column("action_payload", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["finding_id"], ["security_findings.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_security_recommendations_finding_id", "security_recommendations", ["finding_id"], unique=False)
        op.create_index("ix_security_recommendations_priority", "security_recommendations", ["priority"], unique=False)
        op.create_index("ix_security_recommendations_status", "security_recommendations", ["status"], unique=False)
        op.create_index("ix_security_recommendations_created_at", "security_recommendations", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_security_recommendations_created_at", table_name="security_recommendations")
    op.drop_index("ix_security_recommendations_status", table_name="security_recommendations")
    op.drop_index("ix_security_recommendations_priority", table_name="security_recommendations")
    op.drop_index("ix_security_recommendations_finding_id", table_name="security_recommendations")
    op.drop_table("security_recommendations")

    op.drop_index("ix_security_findings_created_at", table_name="security_findings")
    op.drop_index("ix_security_findings_active_exploitation_suspected", table_name="security_findings")
    op.drop_index("ix_security_findings_correlated_risk_score", table_name="security_findings")
    op.drop_index("ix_security_findings_status", table_name="security_findings")
    op.drop_index("ix_security_findings_severity", table_name="security_findings")
    op.drop_index("ix_security_findings_finding_type", table_name="security_findings")
    op.drop_index("ix_security_findings_profile_id", table_name="security_findings")
    op.drop_index("ix_security_findings_site_id", table_name="security_findings")
    op.drop_table("security_findings")

    op.drop_index("ix_target_profile_last_scanned_at", table_name="target_profile")
    op.drop_index("ix_target_profile_base_url", table_name="target_profile")
    op.drop_index("ix_target_profile_site_id", table_name="target_profile")
    op.drop_table("target_profile")

    op.drop_index("ix_threat_intel_updated_at", table_name="threat_intel")
    op.drop_index("ix_threat_intel_severity", table_name="threat_intel")
    op.drop_index("ix_threat_intel_source", table_name="threat_intel")
    op.drop_table("threat_intel")
