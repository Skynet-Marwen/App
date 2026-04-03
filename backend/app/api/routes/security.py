from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import require_admin_user
from ...models.user import User
from ...schemas.security import (
    SecurityActionResponse,
    SecurityFindingOut,
    SecurityRecommendationOut,
    SecurityScanRequest,
    SecurityScanResponse,
    SecurityStatusResponse,
)
from ...services.audit import log_action, request_ip
from ...services.security_center import run_security_scan
from ...services.security_center_ops import apply_recommendation, get_security_status, ignore_finding, list_findings, list_recommendations


router = APIRouter(prefix="/security", tags=["security"])


@router.get("/status", response_model=SecurityStatusResponse)
async def security_status(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin_user),
):
    return await get_security_status(db)


@router.get("/findings", response_model=list[SecurityFindingOut])
async def security_findings(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin_user),
):
    return await list_findings(db)


@router.get("/recommendations", response_model=list[SecurityRecommendationOut])
async def security_recommendations(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_admin_user),
):
    return await list_recommendations(db)


@router.post("/scan", response_model=SecurityScanResponse)
async def trigger_security_scan(
    body: SecurityScanRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin_user),
):
    try:
        summary = await run_security_scan(
            db,
            force=True,
            site_id=body.site_id,
            refresh_intel_first=body.refresh_intel,
        )
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Security scan failed unexpectedly: {exc}") from exc
    log_action(
        db,
        action="RUN_SECURITY_SCAN",
        actor_id=current.id,
        target_type="security",
        target_id=body.site_id or "all-sites",
        ip=request_ip(request),
        extra=summary,
    )
    await db.commit()
    return {"ok": True, **summary}


@router.post("/findings/{finding_id}/ignore", response_model=SecurityActionResponse)
async def ignore_security_finding(
    finding_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin_user),
):
    try:
        await ignore_finding(db, finding_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    log_action(
        db,
        action="IGNORE_SECURITY_FINDING",
        actor_id=current.id,
        target_type="security_finding",
        target_id=finding_id,
        ip=request_ip(request),
    )
    await db.commit()
    return {"ok": True, "detail": "Finding ignored"}


@router.post("/recommendations/{recommendation_id}/apply", response_model=SecurityActionResponse)
async def apply_security_recommendation(
    recommendation_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin_user),
):
    try:
        await apply_recommendation(db, recommendation_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    log_action(
        db,
        action="APPLY_SECURITY_RECOMMENDATION",
        actor_id=current.id,
        target_type="security_recommendation",
        target_id=recommendation_id,
        ip=request_ip(request),
    )
    await db.commit()
    return {"ok": True, "detail": "Recommendation applied"}
