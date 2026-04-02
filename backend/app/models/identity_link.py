import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from ..core.database import Base


class IdentityLink(Base):
    """Maps an external user (Keycloak sub) to a SKYNET device fingerprint."""
    __tablename__ = "identity_links"
    __table_args__ = (
        UniqueConstraint("external_user_id", "fingerprint_id", name="uq_identity_link_user_device"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    external_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    id_provider: Mapped[str] = mapped_column(String(50), nullable=False, default="keycloak")
    fingerprint_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("devices.id", ondelete="SET NULL"), nullable=True, index=True
    )
    visitor_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("visitors.id", ondelete="SET NULL"), nullable=True
    )
    platform: Mapped[str] = mapped_column(String(20), nullable=False, default="web")
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    linked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
