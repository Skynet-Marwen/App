from pydantic import BaseModel
from typing import Optional, List


class CreateRuleRequest(BaseModel):
    type: str
    value: str
    reason: Optional[str] = None
    action: str = "block"


class BlockingRuleOut(BaseModel):
    id: str
    type: str
    value: str
    reason: Optional[str] = None
    action: str
    hits: int
    created_at: str


class BlockIPRequest(BaseModel):
    ip: str
    reason: Optional[str] = None


class BlockedIPOut(BaseModel):
    ip: str
    country: Optional[str] = None
    country_flag: Optional[str] = None
    reason: Optional[str] = None
    hits: int
    blocked_at: str


class BlockedIPListResponse(BaseModel):
    total: int
    items: List[BlockedIPOut]
