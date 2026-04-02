import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class SecurityFinding(Base):
    __tablename__ = "security_findings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    site_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("sites.id", ondelete="SET NULL"), nullable=True, index=True)
    profile_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("target_profile.id", ondelete="SET NULL"), nullable=True, index=True)
    finding_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    endpoint: Mapped[str] = mapped_column(String(1000), nullable=False)
    evidence: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    correlated_risk_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, index=True)
    active_exploitation_suspected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
