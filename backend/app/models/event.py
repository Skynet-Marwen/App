import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from ..core.database import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    site_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("sites.id", ondelete="CASCADE"), nullable=True, index=True)
    visitor_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    device_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)  # pageview, click, identify, custom
    page_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    referrer: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    properties: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
