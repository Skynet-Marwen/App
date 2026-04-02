from pydantic import BaseModel
from typing import Optional, List


class RiskEventOut(BaseModel):
    id: str
    external_user_id: str
    score: float
    delta: float
    trigger_type: str
    trigger_detail: Optional[str]
    created_at: str


class RiskHistoryResponse(BaseModel):
    total: int
    items: List[RiskEventOut]


class RecomputeResponse(BaseModel):
    external_user_id: str
    previous_score: float
    new_score: float
    delta: float
    trust_level: str


class RiskUserListResponse(BaseModel):
    total: int
    items: List[dict]  # UserProfileOut — kept as dict to avoid circular import in routes
