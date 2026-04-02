import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Integer, Float, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from ..core.database import Base


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (
        Index("ix_devices_match_key", "match_key"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    fingerprint: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    device_cookie_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)
    match_key: Mapped[str | None] = mapped_column(String(80), nullable=True)
    match_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fingerprint_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    fingerprint_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    stability_score: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    fingerprint_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    composite_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    composite_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    timezone_offset_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    clock_skew_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    browser: Mapped[str | None] = mapped_column(String(100), nullable=True)
    os: Mapped[str | None] = mapped_column(String(100), nullable=True)
    screen_resolution: Mapped[str | None] = mapped_column(String(20), nullable=True)
    language: Mapped[str | None] = mapped_column(String(20), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    canvas_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    webgl_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    audio_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    font_list: Mapped[str | None] = mapped_column(Text, nullable=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    linked_user: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # Identity fields — populated when an external (Keycloak) user is linked
    owner_user_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    shared_user_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_known_platform: Mapped[str | None] = mapped_column(String(20), nullable=True)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
