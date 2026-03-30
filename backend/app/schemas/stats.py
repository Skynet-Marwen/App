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


class RealtimeResponse(BaseModel):
    active_visitors: int
    blocked_attempts_last_minute: int
    suspicious_sessions: int
