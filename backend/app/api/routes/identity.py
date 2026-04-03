"""Identity linking and user intelligence routes.

Protected by:
  - POST /identity/link         → external IdP JWT (external user)
  - POST /track/activity        → external IdP JWT (external user)
  - GET  /identity/*            → SKYNET admin JWT
  - PUT  /identity/*/flags/*    → SKYNET admin JWT
"""
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user, is_admin_user
from ...models.user import User
from ...models.identity_link import IdentityLink
from ...models.user_profile import UserProfile
from ...models.anomaly_flag import AnomalyFlag
from ...schemas.identity import (
    LinkIdentityRequest, LinkIdentityResponse,
    UserProfileOut, AnomalyFlagOut, EnhancedAuditRequest, UpdateFlagRequest,
)
from ...services.jwks_validator import validate_external_token, extract_bearer
from ...services import identity_service, risk_engine
from ...services.audit import log_action, request_ip
from ...services.keycloak_admin import sync_keycloak_users
from ...services.runtime_config import runtime_settings, save_runtime_settings_cache
from ...core.geoip import lookup as geoip_lookup
from ...core.ip_utils import get_client_ip
from fastapi import Request

router = APIRouter(prefix="/identity", tags=["identity"])


def _fmt_dt(dt: datetime | None) -> str | None:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


def _profile_out(p: UserProfile) -> dict:
    return {
        "id": p.id,
        "external_user_id": p.external_user_id,
        "email": p.email,
        "display_name": p.display_name,
        "current_risk_score": p.current_risk_score,
        "trust_level": p.trust_level,
        "total_devices": p.total_devices,
        "total_sessions": p.total_sessions,
        "first_seen": _fmt_dt(p.first_seen),
        "last_seen": _fmt_dt(p.last_seen),
        "last_ip": p.last_ip,
        "last_country": p.last_country,
        "enhanced_audit": p.enhanced_audit,
    }


# ── POST /identity/link ────────────────────────────────────────────────────────

@router.post("/link", response_model=LinkIdentityResponse)
async def link_identity(
    body: LinkIdentityRequest,
    request: Request,
    authorization: str = Header(..., alias="Authorization"),
    db: AsyncSession = Depends(get_db),
):
    """Called by protected apps after external login to attach identity to device."""
    claims = await validate_external_token(extract_bearer(authorization))
    external_user_id: str = claims.get("sub", "")
    id_provider = claims.get("__skynet_id_provider", "keycloak")
    if not external_user_id:
        raise HTTPException(status_code=401, detail={"code": "TOKEN_INVALID", "message": "Missing sub claim"})

    ip = get_client_ip(request)
    geo = await geoip_lookup(ip)
    country = geo.get("country_code") or None

    # Upsert profile
    profile = await identity_service.upsert_profile(
        db,
        external_user_id=external_user_id,
        email=claims.get("email"),
        display_name=claims.get("name") or claims.get("preferred_username"),
        ip=ip,
        country=country,
    )

    # Link device
    _, is_new = await identity_service.link_device(
        db,
        external_user_id=external_user_id,
        fingerprint_id=body.fingerprint_id,
        visitor_id=None,
        platform=body.platform,
        ip=ip,
        id_provider=id_provider,
    )

    # Multi-account detection
    flag = await identity_service.detect_multi_account(db, external_user_id, body.fingerprint_id)

    # Recompute risk
    trigger = "new_device" if is_new else "login"
    _, new_score, trust_level = await risk_engine.recompute(
        db, external_user_id, trigger_type=trigger,
        trigger_detail={"fingerprint_id": body.fingerprint_id, "platform": body.platform},
    )

    risk_action = risk_engine.enforcement_action(new_score)
    profile.total_sessions = (profile.total_sessions or 0) + 1
    await db.commit()

    active_flags = []
    if flag:
        active_flags.append(flag.flag_type)
    if trust_level in ("suspicious", "blocked"):
        active_flags.append(f"trust_level:{trust_level}")

    return LinkIdentityResponse(
        user_id=external_user_id,
        trust_level=trust_level,
        risk_score=new_score,
        flags=active_flags + ([f"risk_action:{risk_action}"] if risk_action != "allow" else []),
    )


# ── GET /identity/{external_user_id}/profile ──────────────────────────────────

@router.get("/{external_user_id}/profile")
async def get_profile(
    external_user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    profile = await db.scalar(
        select(UserProfile).where(UserProfile.external_user_id == external_user_id)
    )
    if not profile:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Profile not found"})
    return _profile_out(profile)


# ── GET /identity/{external_user_id}/devices ──────────────────────────────────

@router.get("/{external_user_id}/devices")
async def get_user_devices(
    external_user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    links = (
        await db.execute(
            select(IdentityLink).where(IdentityLink.external_user_id == external_user_id)
        )
    ).scalars().all()
    return [
        {
            "id": lk.id,
            "fingerprint_id": lk.fingerprint_id,
            "platform": lk.platform,
            "ip": lk.ip,
            "linked_at": _fmt_dt(lk.linked_at),
            "last_seen_at": _fmt_dt(lk.last_seen_at),
        }
        for lk in links
    ]


# ── GET /identity/{external_user_id}/risk-history ─────────────────────────────

@router.get("/{external_user_id}/risk-history")
async def get_risk_history(
    external_user_id: str,
    limit: int = Query(50, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from ...models.risk_event import RiskEvent
    events = (
        await db.execute(
            select(RiskEvent)
            .where(RiskEvent.external_user_id == external_user_id)
            .order_by(RiskEvent.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return {
        "total": len(events),
        "items": [
            {
                "id": e.id,
                "score": e.score,
                "delta": e.delta,
                "trigger_type": e.trigger_type,
                "trigger_detail": e.trigger_detail,
                "created_at": _fmt_dt(e.created_at),
            }
            for e in events
        ],
    }


# ── GET /identity/{external_user_id}/activity ─────────────────────────────────

@router.get("/{external_user_id}/activity")
async def get_activity(
    external_user_id: str,
    event_type: str = Query(""),
    platform: str = Query(""),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from ...models.activity_event import ActivityEvent
    q = select(ActivityEvent).where(ActivityEvent.external_user_id == external_user_id)
    cq = select(func.count()).select_from(ActivityEvent).where(
        ActivityEvent.external_user_id == external_user_id
    )
    if event_type:
        q = q.where(ActivityEvent.event_type == event_type)
        cq = cq.where(ActivityEvent.event_type == event_type)
    if platform:
        q = q.where(ActivityEvent.platform == platform)
        cq = cq.where(ActivityEvent.platform == platform)

    total = await db.scalar(cq) or 0
    events = (
        await db.execute(
            q.order_by(ActivityEvent.created_at.desc())
            .offset((page - 1) * page_size).limit(page_size)
        )
    ).scalars().all()
    return {
        "total": total,
        "items": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "platform": e.platform,
                "site_id": e.site_id,
                "fingerprint_id": e.fingerprint_id,
                "ip": e.ip,
                "country": e.country,
                "page_url": e.page_url,
                "session_id": e.session_id,
                "created_at": _fmt_dt(e.created_at),
            }
            for e in events
        ],
    }


# ── GET /identity/{external_user_id}/flags ────────────────────────────────────

@router.get("/{external_user_id}/flags")
async def get_flags(
    external_user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    flags = (
        await db.execute(
            select(AnomalyFlag)
            .where(AnomalyFlag.external_user_id == external_user_id)
            .order_by(AnomalyFlag.detected_at.desc())
        )
    ).scalars().all()
    return [
        {
            "id": f.id,
            "flag_type": f.flag_type,
            "severity": f.severity,
            "status": f.status,
            "related_device_id": f.related_device_id,
            "evidence": f.evidence,
            "detected_at": _fmt_dt(f.detected_at),
            "resolved_at": _fmt_dt(f.resolved_at),
        }
        for f in flags
    ]


# ── PUT /identity/{external_user_id}/flags/{flag_id} ──────────────────────────

@router.put("/{external_user_id}/flags/{flag_id}")
async def update_flag(
    external_user_id: str,
    flag_id: str,
    body: UpdateFlagRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    valid_statuses = {"acknowledged", "resolved", "false_positive"}
    if body.status not in valid_statuses:
        raise HTTPException(status_code=422, detail={"code": "INVALID_STATUS", "message": f"Status must be one of {valid_statuses}"})

    flag = await db.get(AnomalyFlag, flag_id)
    if not flag or flag.external_user_id != external_user_id:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Flag not found"})

    flag.status = body.status
    if body.status in ("resolved", "false_positive"):
        flag.resolved_at = datetime.now(timezone.utc)

    log_action(db, action="FLAG_UPDATE", actor_id=current.id, target_type="anomaly_flag",
               target_id=flag_id, ip=request_ip(request),
               extra={"status": body.status, "user": external_user_id})
    await db.commit()
    return {"ok": True}


# ── POST /identity/{external_user_id}/enhanced-audit ─────────────────────────

@router.post("/{external_user_id}/enhanced-audit")
async def set_enhanced_audit(
    external_user_id: str,
    body: EnhancedAuditRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if not is_admin_user(current):
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Admin role required"})

    profile = await db.scalar(
        select(UserProfile).where(UserProfile.external_user_id == external_user_id)
    )
    if not profile:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Profile not found"})

    profile.enhanced_audit = body.enabled
    log_action(db, action="ENHANCED_AUDIT_TOGGLE", actor_id=current.id, target_type="user_profile",
               target_id=external_user_id, ip=request_ip(request),
               extra={"enabled": body.enabled, "reason": body.reason})
    await db.commit()
    return {"ok": True, "enhanced_audit": body.enabled}


@router.get("/sync/keycloak/status")
async def get_keycloak_sync_status(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    settings = runtime_settings()
    await save_runtime_settings_cache(db)
    return {
        "enabled": bool(settings.get("keycloak_sync_enabled")),
        "base_url": settings.get("keycloak_sync_base_url", ""),
        "auth_realm": settings.get("keycloak_sync_auth_realm", ""),
        "realm": settings.get("keycloak_sync_realm", ""),
        "last_run_at": settings.get("keycloak_sync_last_run_at", ""),
        "last_summary": settings.get("keycloak_sync_last_summary") or {},
    }


@router.post("/sync/keycloak")
async def run_keycloak_sync(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    summary = await sync_keycloak_users(db)
    log_action(
        db,
        action="SYNC_KEYCLOAK_USERS",
        actor_id=current.id,
        target_type="identity",
        target_id=summary["realm"],
        ip=request_ip(request),
        extra=summary,
    )
    await save_runtime_settings_cache(db)
    await db.commit()
    return summary
