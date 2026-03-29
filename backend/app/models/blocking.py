import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from ..core.database import Base


class BlockingRule(Base):
    __tablename__ = "blocking_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    type: Mapped[str] = mapped_column(String(30), nullable=False)  # ip, country, device, user_agent, asn
    value: Mapped[str] = mapped_column(String(500), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    action: Mapped[str] = mapped_column(String(20), default="block")  # block, challenge, rate_limit
    hits: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class BlockedIP(Base):
    __tablename__ = "blocked_ips"

    ip: Mapped[str] = mapped_column(String(50), primary_key=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country_flag: Mapped[str | None] = mapped_column(String(10), nullable=True)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hits: Mapped[int] = mapped_column(Integer, default=0)
    blocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
