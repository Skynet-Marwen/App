from datetime import datetime

from pydantic import BaseModel, Field


class SecurityFindingOut(BaseModel):
    id: str
    site_id: str | None = None
    profile_id: str | None = None
    finding_type: str
    title: str
    severity: str
    endpoint: str
    evidence: dict = Field(default_factory=dict)
    correlated_risk_score: float
    active_exploitation_suspected: bool
    status: str
    created_at: datetime
    updated_at: datetime


class SecurityRecommendationOut(BaseModel):
    id: str
    finding_id: str
    recommendation_text: str
    priority: str
    auto_applicable: bool
    action_key: str | None = None
    action_payload: dict = Field(default_factory=dict)
    status: str
    created_at: datetime
    updated_at: datetime
    finding_title: str | None = None
    finding_severity: str | None = None
    finding_endpoint: str | None = None


class SecurityScanRequest(BaseModel):
    refresh_intel: bool = True
    site_id: str | None = None


class SecurityScanError(BaseModel):
    site_id: str | None = None
    site_url: str | None = None
    detail: str


class SecurityActionResponse(BaseModel):
    ok: bool = True
    detail: str


class SecurityStatusProfile(BaseModel):
    id: str
    site_id: str | None = None
    base_url: str
    detected_server: str | None = None
    frameworks: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)
    scan_status: str
    last_scanned_at: datetime | None = None
    notes: str | None = None


class SecurityStatusResponse(BaseModel):
    scheduler: dict
    threat_intel_entries: int
    last_intel_refresh: datetime | None = None
    last_scan_at: datetime | None = None
    open_findings: int
    active_exploitation_findings: int
    open_recommendations: int
    profiles: list[SecurityStatusProfile] = Field(default_factory=list)


class SecurityScanResponse(BaseModel):
    ok: bool = True
    scanned_targets: int
    findings_created: int
    recommendations_created: int
    intel_updated: int
    errors: list[SecurityScanError] = Field(default_factory=list)
