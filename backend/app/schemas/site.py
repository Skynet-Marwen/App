from pydantic import BaseModel, HttpUrl
from typing import Optional


class CreateSiteRequest(BaseModel):
    name: str
    url: str
    description: Optional[str] = None


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
