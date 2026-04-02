from pydantic import BaseModel
from typing import Optional, List


# ── Requests ──────────────────────────────────────────────────────────────────

class LinkIdentityRequest(BaseModel):
    fingerprint_id: Optional[str] = None
    platform: str = "web"
    site_id: Optional[str] = None


class UpdateFlagRequest(BaseModel):
    status: str  # acknowledged | resolved | false_positive


class EnhancedAuditRequest(BaseModel):
    enabled: bool
    reason: str


# ── Responses ─────────────────────────────────────────────────────────────────

class LinkIdentityResponse(BaseModel):
    user_id: str
    trust_level: str
    risk_score: float
    flags: List[str] = []


class IdentityLinkOut(BaseModel):
    id: str
    external_user_id: str
    id_provider: str
    fingerprint_id: Optional[str]
    visitor_id: Optional[str]
    platform: str
    ip: Optional[str]
    linked_at: str
    last_seen_at: str


class UserProfileOut(BaseModel):
    id: str
    external_user_id: str
    email: Optional[str]
    display_name: Optional[str]
    current_risk_score: float
    trust_level: str
    total_devices: int
    total_sessions: int
    first_seen: str
    last_seen: str
    last_ip: Optional[str]
    last_country: Optional[str]
    enhanced_audit: bool


class AnomalyFlagOut(BaseModel):
    id: str
    external_user_id: str
    flag_type: str
    severity: str
    status: str
    related_device_id: Optional[str]
    related_visitor_id: Optional[str]
    evidence: Optional[str]
    detected_at: str
    resolved_at: Optional[str]
