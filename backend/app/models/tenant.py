import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    primary_host: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_theme_id: Mapped[str | None] = mapped_column(ForeignKey("themes.id", ondelete="SET NULL"), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
