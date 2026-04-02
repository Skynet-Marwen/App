import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class TargetProfile(Base):
    __tablename__ = "target_profile"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    site_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("sites.id", ondelete="SET NULL"), nullable=True, index=True)
    base_url: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    detected_server: Mapped[str | None] = mapped_column(String(255), nullable=True)
    powered_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    frameworks: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    technologies: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    response_headers: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    observed_endpoints: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    scan_status: Mapped[str] = mapped_column(String(20), nullable=False, default="idle")
    last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
