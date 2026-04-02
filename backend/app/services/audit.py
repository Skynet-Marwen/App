import json
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.audit_log import AuditLog
from ..core.ip_utils import get_client_ip


def request_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    return get_client_ip(request)


def parse_extra(extra_data: str | None) -> dict | None:
    if not extra_data:
        return None
    try:
        return json.loads(extra_data)
    except Exception:
        return {"raw": extra_data}


def log_action(
    db: AsyncSession,
    *,
    action: str,
    actor_id: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    ip: str | None = None,
    extra: dict | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        ip=ip,
        extra_data=json.dumps(extra, default=str) if extra else None,
    )
    db.add(entry)
    return entry
