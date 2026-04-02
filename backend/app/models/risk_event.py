import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Float, Text, Index
from sqlalchemy.orm import Mapped, mapped_column
from ..core.database import Base


class RiskEvent(Base):
    """Time-series snapshot of a user's risk score after each change."""
    __tablename__ = "risk_events"
    __table_args__ = (
        Index("ix_risk_events_user_created", "external_user_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    external_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    delta: Mapped[float] = mapped_column(Float, nullable=False)
    # What triggered this recomputation
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)
    trigger_detail: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
