from pydantic import BaseModel
from typing import List, Optional


class HeatmapBucket(BaseModel):
    timestamp: str
    count: int


class CountryStats(BaseModel):
    country: str
    flag: str
    count: int
    percent: float


class BlockingChartItem(BaseModel):
    reason: str
    count: int


class RecentIncident(BaseModel):
    id: str
    title: str
    severity: str
    time: str


class ThreatHotspot(BaseModel):
    country: str
    flag: str
    count: int
    percent: float
    delta: int = 0
    top_reason: str = "mixed"
    threat_score: int = 0


class EnforcementTotals(BaseModel):
    blocked: int
    challenged: int
    rate_limited: int
    observed: int


class EnforcementSummary(BaseModel):
    label: str
    value: str


class EnforcementPressure(BaseModel):
    totals: EnforcementTotals
    summaries: List[EnforcementSummary]


class PriorityInvestigation(BaseModel):
    id: str
    title: str
    severity: str
    status: str
    target_type: str
    target_label: str
    time: str
    repeat_count: int = 1
    state_tags: List[str]


class RiskLeaderboardItem(BaseModel):
    external_user_id: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    current_risk_score: float
    trust_level: str
    total_devices: int
    total_sessions: int
    open_flags_count: int = 0
    top_flag: Optional[str] = None
    last_seen: Optional[str] = None
    last_country: Optional[str] = None
    enhanced_audit: bool = False


class GatewayBreakdownItem(BaseModel):
    label: str
    count: int


class GatewayDecisionTotals(BaseModel):
    allow: int
    challenge: int
    block: int


class GatewayDashboard(BaseModel):
    enabled: bool
    configured: bool
    target_origin: str
    total_requests: int
    request_change_pct: int
    bot_percent: float
    challenge_rate: float
    avg_latency_ms: Optional[float] = None
    p95_latency_ms: Optional[float] = None
    upstream_error_rate: float
    decision_totals: GatewayDecisionTotals
    challenge_outcomes: List[GatewayBreakdownItem] = []
    challenge_breakdown: List[GatewayBreakdownItem] = []
    top_reasons: List[GatewayBreakdownItem] = []


class OverviewResponse(BaseModel):
    total_visitors: int
    unique_users: int
    total_devices: int
    total_blocked: int
    evasion_attempts: int
    spam_detected: int
    visitors_change: Optional[float] = None
    users_change: Optional[float] = None
    blocked_change: Optional[float] = None
    traffic_heatmap: List[HeatmapBucket]
    top_countries: List[CountryStats]
    blocking_chart: List[BlockingChartItem]
    recent_incidents: List[RecentIncident]
    threat_hotspots: List[ThreatHotspot] = []
    enforcement_pressure: Optional[EnforcementPressure] = None
    gateway_dashboard: Optional[GatewayDashboard] = None
    priority_investigations: List[PriorityInvestigation] = []
    risk_leaderboard: List[RiskLeaderboardItem] = []


class RealtimeResponse(BaseModel):
    active_visitors: int
    blocked_attempts_last_minute: int
    suspicious_sessions: int
