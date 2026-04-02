"""Risk intelligence routes — user-level scoring and anomaly management."""
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.anomaly_flag import AnomalyFlag
from ...models.user import User
from ...models.user_profile import UserProfile
from ...services import risk_engine

router = APIRouter(prefix="/risk", tags=["risk"])


@router.get("/users")
async def list_risky_users(
    search: str = Query(""),
    min_score: float = Query(0.0, ge=0.0, le=1.0),
    trust_level: str = Query(""),
    has_flags: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    open_flags_count = (
        select(func.count())
        .select_from(AnomalyFlag)
        .where(
            AnomalyFlag.external_user_id == UserProfile.external_user_id,
            AnomalyFlag.status == "open",
        )
        .correlate(UserProfile)
        .scalar_subquery()
    )

    q = select(UserProfile, open_flags_count.label("open_flags_count"))
    cq = select(func.count()).select_from(UserProfile)

    if search.strip():
        pattern = f"%{search.strip()}%"
        search_filter = or_(
            UserProfile.external_user_id.ilike(pattern),
            UserProfile.email.ilike(pattern),
            UserProfile.display_name.ilike(pattern),
        )
        q = q.where(search_filter)
        cq = cq.where(search_filter)
    if min_score > 0:
        q = q.where(UserProfile.current_risk_score >= min_score)
        cq = cq.where(UserProfile.current_risk_score >= min_score)
    if trust_level:
        q = q.where(UserProfile.trust_level == trust_level)
        cq = cq.where(UserProfile.trust_level == trust_level)
    if has_flags:
        q = q.where(open_flags_count > 0)
        cq = cq.where(open_flags_count > 0)

    total = await db.scalar(cq) or 0
    rows = (
        await db.execute(
            q.order_by(UserProfile.current_risk_score.desc())
            .offset((page - 1) * page_size).limit(page_size)
        )
    ).all()

    return {
        "total": total,
        "items": [
            {
                "external_user_id": p.external_user_id,
                "email": p.email,
                "display_name": p.display_name,
                "current_risk_score": p.current_risk_score,
                "trust_level": p.trust_level,
                "total_devices": p.total_devices,
                "total_sessions": p.total_sessions,
                "last_seen": p.last_seen.strftime("%Y-%m-%dT%H:%M:%SZ") if p.last_seen else None,
                "last_country": p.last_country,
                "enhanced_audit": p.enhanced_audit,
                "open_flags_count": int(open_count or 0),
            }
            for p, open_count in rows
        ],
    }


@router.post("/{external_user_id}/recompute")
async def recompute_risk(
    external_user_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    profile = await db.scalar(
        select(UserProfile).where(UserProfile.external_user_id == external_user_id)
    )
    if not profile:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Profile not found"})

    previous, new_score, trust_level = await risk_engine.recompute(
        db, external_user_id,
        trigger_type="manual",
        trigger_detail={"requested_by": current.id},
    )
    await db.commit()
    return {
        "external_user_id": external_user_id,
        "previous_score": previous,
        "new_score": new_score,
        "delta": round(new_score - previous, 4),
        "trust_level": trust_level,
    }
