from sqlalchemy import Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class RuntimeConfig(Base):
    __tablename__ = "runtime_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    runtime_settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    anti_evasion_config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
