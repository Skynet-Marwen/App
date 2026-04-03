import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    channel: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued", index=True)
    target: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(200), nullable=True)
    response_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    incident_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    escalation_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
