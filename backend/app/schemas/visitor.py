from pydantic import BaseModel
from typing import Optional, List


class BlockRequest(BaseModel):
    reason: Optional[str] = None


class VisitorOut(BaseModel):
    id: str
    ip: str
    country: Optional[str] = None
    country_flag: Optional[str] = ""
    city: Optional[str] = None
    isp: Optional[str] = None
    device_type: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    user_agent: Optional[str] = None
    status: str
    page_views: int
    first_seen: str
    last_seen: str
    linked_user: Optional[str] = None


class VisitorListResponse(BaseModel):
    total: int
    items: List[VisitorOut]
