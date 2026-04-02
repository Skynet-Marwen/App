import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Float, Integer, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from ..core.database import Base


class UserProfile(Base):
    """Aggregated security intelligence profile for an external (Keycloak) user."""
    __tablename__ = "user_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    external_user_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Risk / trust
    current_risk_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, index=True)
    trust_level: Mapped[str] = mapped_column(String(20), nullable=False, default="normal", index=True)
    # Aggregated counters
    total_devices: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Temporal
    first_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    last_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    last_country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    # Audit
    enhanced_audit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    profile_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
