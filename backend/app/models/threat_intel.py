import json
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class ThreatIntel(Base):
    __tablename__ = "threat_intel"

    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    source: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    severity: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, index=True)
    severity_label: Mapped[str] = mapped_column(String(20), nullable=False, default="low")
    affected_software: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    references: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    def affected_software_list(self) -> list[str]:
        try:
            return json.loads(self.affected_software or "[]")
        except Exception:
            return []

    def references_list(self) -> list[str]:
        try:
            return json.loads(self.references or "[]")
        except Exception:
            return []
