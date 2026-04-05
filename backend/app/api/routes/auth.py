import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from ...models.tenant import Tenant
from ...models.user import User
from ...services.audit import log_action, request_ip
from ...services.sanitize import clean_text
from ...services.sessions import create_session, revoke_all_sessions, revoke_session

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Request schemas ────────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


@router.post("/login")
async def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    username = clean_text(form.username)
    result = await db.execute(
        select(User).where((User.email == username) | (User.username == username))
    )
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password or not verify_password(form.password, user.hashed_password):
        log_action(
            db,
            action="LOGIN_FAILED",
            ip=request_ip(request),
            extra={"attempted_username": username},
        )
        await db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.status == "blocked":
        raise HTTPException(status_code=403, detail="Account blocked")

    user.last_login = datetime.now(timezone.utc)
    session_id = str(uuid.uuid4())
    token = create_access_token({"sub": user.id, "role": user.role, "sid": session_id})
    await create_session(user.id, session_id, request_ip(request), request.headers.get("user-agent"))
    log_action(db, action="LOGIN", actor_id=user.id, ip=request_ip(request))
    await db.commit()
    tenant = await db.get(Tenant, user.tenant_id) if user.tenant_id else None
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "tenant_id": user.tenant_id,
            "tenant_name": tenant.name if tenant else None,
            "tenant_slug": tenant.slug if tenant else None,
        },
    }


@router.post("/logout")
async def logout(request: Request, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    log_action(db, action="LOGOUT", actor_id=current_user.id, ip=request_ip(request))
    await db.commit()
    if getattr(current_user, "_session_id", None):
        await revoke_session(current_user.id, current_user._session_id)
    return {"message": "Logged out"}


@router.get("/me")
async def me(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant = await db.get(Tenant, current_user.tenant_id) if current_user.tenant_id else None
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "role": current_user.role,
        "status": current_user.status,
        "tenant_id": current_user.tenant_id,
        "tenant_name": tenant.name if tenant else None,
        "tenant_slug": tenant.slug if tenant else None,
        "theme_id": current_user.theme_id,
        "theme_source": current_user.theme_source,
    }


# ── Public SMTP gate ───────────────────────────────────────────────────────────

@router.get("/smtp-status")
async def smtp_status():
    """Public endpoint — lets the login page know whether to show 'Forgot password?'."""
    from ...services.runtime_config import runtime_settings
    _settings = runtime_settings()
    return {"smtp_enabled": bool(_settings.get("smtp_enabled"))}


# ── Self-service password reset ────────────────────────────────────────────────

@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Public — always returns 200 to prevent email enumeration.
    Sends a reset link only when SMTP is configured and the email matches an active account.
    """
    from ...services.runtime_config import runtime_settings
    from ...services.password_reset import generate_reset_token
    from ...services.email import send_forgot_password_email

    _settings = runtime_settings()
    if not _settings.get("smtp_enabled"):
        return {"message": "ok"}

    result = await db.execute(select(User).where(User.email == str(body.email)))
    user = result.scalar_one_or_none()
    if user and user.status == "active" and user.email:
        token = await generate_reset_token(user.id)
        base = (_settings.get("base_url") or "").rstrip("/")
        reset_link = f"{base}/reset-password?token={token}"
        background_tasks.add_task(
            send_forgot_password_email,
            to=user.email,
            username=user.username,
            reset_link=reset_link,
            instance_name=_settings.get("instance_name", "SkyNet"),
        )
    return {"message": "ok"}


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Public — consume a single-use token and set a new password."""
    from ...services.password_reset import consume_reset_token

    raw = await consume_reset_token(body.token)
    if not raw:
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired")

    user_id = raw.decode() if isinstance(raw, bytes) else raw
    user = await db.get(User, user_id)
    if not user or user.status != "active":
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired")

    user.hashed_password = hash_password(body.new_password)
    await revoke_all_sessions(user.id)
    log_action(
        db,
        action="SELF_RESET_PASSWORD",
        actor_id=user.id,
        target_type="user",
        target_id=user.id,
        ip=request_ip(request),
    )
    await db.commit()
    return {"message": "Password updated. Please sign in with your new password."}
