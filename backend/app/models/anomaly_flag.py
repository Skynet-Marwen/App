import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, Index
from sqlalchemy.orm import Mapped, mapped_column
from ..core.database import Base


class AnomalyFlag(Base):
    """Security anomaly detected for an external user."""
    __tablename__ = "anomaly_flags"
    __table_args__ = (
        Index("ix_anomaly_flags_status_severity", "status", "severity"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    external_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    # new_device | geo_jump | multi_account | impossible_travel | headless | behavior_drift
    flag_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # low | medium | high | critical
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    # open | acknowledged | resolved | false_positive
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    related_device_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    related_visitor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
