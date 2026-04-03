from pydantic import BaseModel
from typing import Optional, List


# ── Request ───────────────────────────────────────────────────────────────────

class ActivityPayload(BaseModel):
    event_type: str
    platform: Optional[str] = "web"
    fingerprint_id: Optional[str] = None
    page_url: Optional[str] = None
    properties: Optional[dict] = None
    session_id: Optional[str] = None
    site_id: Optional[str] = None
    site_key: Optional[str] = None


# ── Response ──────────────────────────────────────────────────────────────────

class ActivityEventOut(BaseModel):
    id: str
    external_user_id: str
    event_type: str
    platform: Optional[str]
    site_id: Optional[str]
    fingerprint_id: Optional[str]
    ip: Optional[str]
    country: Optional[str]
    page_url: Optional[str]
    properties: Optional[str]
    session_id: Optional[str]
    created_at: str


class ActivityListResponse(BaseModel):
    total: int
    items: List[ActivityEventOut]
