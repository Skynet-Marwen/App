import uuid
import secrets
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Boolean, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column
from ..core.database import Base


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    api_key: Mapped[str] = mapped_column(String(64), unique=True, default=lambda: secrets.token_hex(32), index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
