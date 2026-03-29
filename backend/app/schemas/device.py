from pydantic import BaseModel
from typing import Optional, List


class LinkRequest(BaseModel):
    user_id: str


class DeviceOut(BaseModel):
    id: str
    fingerprint: str
    type: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    screen_resolution: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    canvas_hash: Optional[str] = None
    webgl_hash: Optional[str] = None
    risk_score: int = 0
    status: str
    linked_user: Optional[str] = None
    first_seen: str
    last_seen: str


class DeviceListResponse(BaseModel):
    total: int
    items: List[DeviceOut]
