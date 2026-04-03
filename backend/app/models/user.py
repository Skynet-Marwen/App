import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from ..core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(Enum("superadmin", "admin", "moderator", "user", name="user_role"), default="user")
    status: Mapped[str] = mapped_column(Enum("active", "blocked", "pending", name="user_status"), default="active")
    tenant_id: Mapped[str | None] = mapped_column(ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True)
    theme_id: Mapped[str | None] = mapped_column(ForeignKey("themes.id", ondelete="SET NULL"), nullable=True, index=True)
    theme_source: Mapped[str | None] = mapped_column(String(20), nullable=True, default="default")
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
