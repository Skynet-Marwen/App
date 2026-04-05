from pydantic import BaseModel
from typing import Optional, List


class LinkRequest(BaseModel):
    user_id: str
    external_user_id: Optional[str] = None  # Keycloak sub — if provided, also creates IdentityLink


class DeviceOut(BaseModel):
    id: str
    fingerprint: str
    display_name: Optional[str] = None
    probable_model: Optional[str] = None
    probable_vendor: Optional[str] = None
    match_key: Optional[str] = None
    match_version: Optional[int] = None
    type: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    screen_resolution: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    canvas_hash: Optional[str] = None
    webgl_hash: Optional[str] = None
    fingerprint_confidence: float = 0.0
    stability_score: float = 1.0
    composite_fingerprint: Optional[str] = None
    composite_score: float = 0.0
    timezone_offset_minutes: Optional[int] = None
    clock_skew_minutes: Optional[int] = None
    risk_score: int = 0
    status: str
    linked_user: Optional[str] = None
    visitor_count: int = 0
    first_seen: str
    last_seen: str
    tracking_signals: Optional[dict] = None


class DeviceListResponse(BaseModel):
    total: int
    items: List[DeviceOut]


class DeviceGroupChildOut(BaseModel):
    id: str
    fingerprint: str
    display_name: Optional[str] = None
    probable_model: Optional[str] = None
    probable_vendor: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    risk_score: int = 0
    status: str
    linked_user: Optional[str] = None
    visitor_count: int = 0
    first_seen: str
    last_seen: str


class DeviceGroupOut(BaseModel):
    group_id: str
    display_name: Optional[str] = None
    probable_model: Optional[str] = None
    probable_vendor: Optional[str] = None
    match_key: Optional[str] = None
    match_strength: str
    match_label: str
    match_evidence: List[str]
    fingerprint_count: int
    visitor_count: int
    status: str
    linked_user_state: str
    linked_user: Optional[str] = None
    first_seen: str
    last_seen: str
    devices: List[DeviceGroupChildOut]


class DeviceGroupListResponse(BaseModel):
    total: int
    items: List[DeviceGroupOut]
