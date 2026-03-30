from pydantic import BaseModel, field_validator
from typing import Optional
from ..services.sanitize import clean_optional_text, clean_text, clean_url


class CreateSiteRequest(BaseModel):
    name: str
    url: str
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return clean_text(value)

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        return clean_url(value) or ""

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: Optional[str]) -> Optional[str]:
        return clean_optional_text(value)


class SiteStats(BaseModel):
    visitors: int = 0
    events: int = 0
    blocked: int = 0


class SiteOut(BaseModel):
    id: str
    name: str
    url: str
    description: Optional[str] = None
    api_key: str
    active: bool
    stats: SiteStats
    created_at: str
