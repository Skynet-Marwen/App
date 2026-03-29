from pydantic import BaseModel
from typing import Optional, List


class IncidentOut(BaseModel):
    id: str
    type: str
    description: Optional[str] = None
    ip: Optional[str] = None
    severity: str
    status: str
    detected_at: str


class IncidentListResponse(BaseModel):
    total: int
    items: List[IncidentOut]
