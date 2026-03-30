from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, Text, Integer
from ..core.database import Base


class BlockPageConfig(Base):
    """Single-row table (id=1) storing the block page customization."""
    __tablename__ = "block_page_config"

    id:               Mapped[int]  = mapped_column(Integer, primary_key=True, default=1)
    title:            Mapped[str]  = mapped_column(String(120), default="ACCESS RESTRICTED")
    subtitle:         Mapped[str]  = mapped_column(String(240), default="Your access to this site has been blocked.")
    message:          Mapped[str]  = mapped_column(Text, default="This action was taken automatically for security reasons. If you believe this is a mistake, please contact the site administrator.")
    bg_color:         Mapped[str]  = mapped_column(String(20),  default="#050505")
    accent_color:     Mapped[str]  = mapped_column(String(20),  default="#ef4444")
    logo_url:         Mapped[str | None] = mapped_column(String(512), nullable=True)
    contact_email:    Mapped[str | None] = mapped_column(String(255), nullable=True)
    show_request_id:  Mapped[bool] = mapped_column(Boolean, default=True)
    show_contact:     Mapped[bool] = mapped_column(Boolean, default=True)
