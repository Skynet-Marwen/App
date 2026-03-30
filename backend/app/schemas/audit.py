from pydantic import BaseModel
from typing import Any, Optional


class AuditLogOut(BaseModel):
    id: str
    actor_id: Optional[str] = None
    actor_label: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    ip: Optional[str] = None
    created_at: str
    extra: Optional[dict[str, Any]] = None


class AuditLogListResponse(BaseModel):
    total: int
    items: list[AuditLogOut]
