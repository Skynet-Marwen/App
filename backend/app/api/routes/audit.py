from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, outerjoin, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from ...core.database import get_db
from ...core.security import get_current_user, require_admin_user
from ...models.audit_log import AuditLog
from ...models.user import User
from ...services.audit import parse_extra

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: str = Query(""),
    actor_id: str = Query(""),
    target_type: str = Query(""),
    target_id: str = Query(""),
    search: str = Query(""),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    audit_join = outerjoin(AuditLog, User, User.id == AuditLog.actor_id)
    filters = []
    if action:
        filters.append(AuditLog.action == action)
    if actor_id:
        filters.append(AuditLog.actor_id == actor_id)
    if target_type:
        filters.append(AuditLog.target_type == target_type)
    if target_id:
        filters.append(AuditLog.target_id == target_id)
    if search:
        term = f"%{search}%"
        filters.append(
            or_(
                AuditLog.action.ilike(term),
                AuditLog.target_type.ilike(term),
                AuditLog.target_id.ilike(term),
                AuditLog.ip.ilike(term),
                AuditLog.extra_data.ilike(term),
                User.email.ilike(term),
                User.username.ilike(term),
            )
        )
    total_query = select(func.count()).select_from(audit_join)
    if filters:
        total_query = total_query.where(*filters)
    total = await db.scalar(total_query) or 0
    query = (
        select(AuditLog, User.email, User.username)
        .select_from(audit_join)
        .order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if filters:
        query = query.where(*filters)
    rows = (await db.execute(query)).all()
    return {
        "total": total,
        "items": [
            {
                "id": log.id,
                "actor_id": log.actor_id,
                "actor_label": email or username,
                "action": log.action,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "ip": log.ip,
                "created_at": log.created_at.isoformat(),
                "extra": parse_extra(log.extra_data),
            }
            for log, email, username in rows
        ],
    }
