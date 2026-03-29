from pydantic import BaseModel
from typing import Optional, Dict, Any


class PageviewPayload(BaseModel):
    page_url: str
    referrer: Optional[str] = None
    fingerprint: Optional[str] = None
    canvas_hash: Optional[str] = None
    webgl_hash: Optional[str] = None
    screen: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    session_id: Optional[str] = None


class EventPayload(BaseModel):
    event_type: str
    page_url: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    fingerprint: Optional[str] = None
    session_id: Optional[str] = None


class IdentifyPayload(BaseModel):
    user_id: str
    fingerprint: Optional[str] = None
    traits: Optional[Dict[str, Any]] = None
