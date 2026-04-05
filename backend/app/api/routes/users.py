import secrets
import string
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user, hash_password, is_superadmin, require_admin_user
from ...models.tenant import Tenant
from ...models.user import User
from ...schemas.user import CreateUserRequest, UpdateUserRequest
from ...services.audit import log_action, request_ip
from ...services.incident_notifications import dispatch_notification_event
from ...services.runtime_config import runtime_settings
from ...services.sessions import list_sessions, revoke_all_sessions, revoke_session
from ...services.theme_service import assign_default_theme_to_user


router = APIRouter(prefix="/users", tags=["users"])

_settings = runtime_settings()
_SUPERADMIN_ROLE = "superadmin"


def _ensure_same_tenant_scope(current: User, tenant_id: str | None) -> None:
    if is_superadmin(current) or not current.tenant_id:
        return
    if tenant_id != current.tenant_id:
        raise HTTPException(status_code=403, detail="Tenant-scoped admins can only manage their own tenant")


async def _get_tenant(db: AsyncSession, tenant_id: str | None) -> Tenant | None:
    if not tenant_id:
        return None
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


async def _count_superadmins(db: AsyncSession) -> int:
    return await db.scalar(select(func.count()).select_from(User).where(User.role == _SUPERADMIN_ROLE)) or 0


async def _serialize_users(db: AsyncSession, users: list[User]) -> list[dict]:
    if not users:
        return []

    tenant_ids = [user.tenant_id for user in users if user.tenant_id]
    tenant_map = {}
    if tenant_ids:
        tenant_rows = await db.execute(select(Tenant.id, Tenant.name, Tenant.slug).where(Tenant.id.in_(tenant_ids)))
        tenant_map = {
            tenant_id: {"name": name, "slug": slug}
            for tenant_id, name, slug in tenant_rows.all()
        }

    session_device_counts: dict[str, int] = {}
    for user in users:
        sessions = await list_sessions(user.id)
        unique_devices = {
            (session.get("device") or "").strip()
            for session in sessions
            if (session.get("device") or "").strip() and (session.get("device") or "").strip() != "Unknown device"
        }
        session_device_counts[user.id] = len(unique_devices) if unique_devices else len(sessions)

    return [
        {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "status": user.status,
            "tenant_id": user.tenant_id,
            "tenant_name": tenant_map.get(user.tenant_id or "", {}).get("name"),
            "tenant_slug": tenant_map.get(user.tenant_id or "", {}).get("slug"),
            "last_login": user.last_login.strftime("%Y-%m-%d %H:%M") if user.last_login else None,
            "created_at": user.created_at.strftime("%Y-%m-%d %H:%M"),
            "devices_count": session_device_counts.get(user.id, 0),
        }
        for user in users
    ]


async def _get_user_in_scope(db: AsyncSession, current: User, user_id: str) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Not found")
    _ensure_same_tenant_scope(current, user.tenant_id)
    if user.role == _SUPERADMIN_ROLE and not is_superadmin(current):
        raise HTTPException(status_code=403, detail="Only superadmins can manage superadmin accounts")
    return user


@router.get("")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    search: str = Query(""),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin_user),
):
    q = select(User)
    cq = select(func.count()).select_from(User)
    if current.tenant_id and not is_superadmin(current):
        q = q.where(User.tenant_id == current.tenant_id)
        cq = cq.where(User.tenant_id == current.tenant_id)
    if search:
        needle = f"%{search}%"
        filters = or_(User.email.ilike(needle), User.username.ilike(needle))
        q = q.where(filters)
        cq = cq.where(filters)

    total = await db.scalar(cq) or 0
    result = await db.execute(q.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    users = list(result.scalars().all())
    return {"total": total, "items": await _serialize_users(db, users)}


@router.post("")
async def create_user(
    body: CreateUserRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin_user),
):
    if body.role == _SUPERADMIN_ROLE and not is_superadmin(current):
        raise HTTPException(status_code=403, detail="Only superadmins can create superadmin accounts")

    _ensure_same_tenant_scope(current, body.tenant_id)
    await _get_tenant(db, body.tenant_id)

    existing = await db.scalar(select(User).where((User.email == body.email) | (User.username == body.username)))
    if existing:
        raise HTTPException(status_code=409, detail="Email or username already exists")

    user = User(
        id=str(uuid.uuid4()),
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
        role=body.role,
        tenant_id=body.tenant_id if body.tenant_id else current.tenant_id if current.tenant_id and not is_superadmin(current) else None,
    )
    db.add(user)
    await assign_default_theme_to_user(db, user)
    log_action(
        db,
        action="CREATE_USER",
        actor_id=current.id,
        target_type="user",
        target_id=user.id,
        ip=request_ip(request),
        extra={"role": user.role, "tenant_id": user.tenant_id},
    )
    await db.commit()

    tenant = await _get_tenant(db, user.tenant_id) if user.tenant_id else None
    dispatch_notification_event(
        "new_user",
        {
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "tenant": tenant.name if tenant else None,
            "created_by": current.username,
            "target": user.email or user.username or user.id,
        },
        subject=f"{_settings.get('instance_name', 'SkyNet')} Notification — New User",
        severity="low",
    )

    from ...services.email import send_welcome_email
    from ...services.password_reset import generate_reset_token

    if _settings.get("smtp_enabled") and user.email:
        base = (_settings.get("base_url") or "").rstrip("/")
        reset_token = await generate_reset_token(user.id)
        reset_link = f"{base}/reset-password?token={reset_token}"
        background_tasks.add_task(
            send_welcome_email,
            to=user.email,
            username=user.username,
            password=body.password,
            role=user.role,
            actor=current.username,
            login_url=base + "/login",
            instance_name=_settings.get("instance_name", "SkyNet"),
            reset_link=reset_link,
        )

    return {"id": user.id, "message": "Created"}


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin_user),
):
    user = await _get_user_in_scope(db, current, user_id)
    return (await _serialize_users(db, [user]))[0]


@router.put("/{user_id}")
async def update_user(
    user_id: str,
    body: UpdateUserRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin_user),
):
    user = await _get_user_in_scope(db, current, user_id)
    changes = {}

    if body.email and body.email != user.email:
        conflict = await db.scalar(select(User).where(User.email == body.email, User.id != user_id))
        if conflict:
            raise HTTPException(status_code=409, detail="Email already in use")
        user.email = body.email
        changes["email"] = body.email

    if body.username and body.username != user.username:
        conflict = await db.scalar(select(User).where(User.username == body.username, User.id != user_id))
        if conflict:
            raise HTTPException(status_code=409, detail="Username already in use")
        user.username = body.username
        changes["username"] = body.username

    if body.role:
        if body.role == _SUPERADMIN_ROLE and not is_superadmin(current):
            raise HTTPException(status_code=403, detail="Only superadmins can promote another operator to superadmin")
        if user.role == _SUPERADMIN_ROLE and body.role != _SUPERADMIN_ROLE:
            if not is_superadmin(current):
                raise HTTPException(status_code=403, detail="Only superadmins can demote a superadmin")
            if current.id == user.id:
                raise HTTPException(status_code=400, detail="Cannot remove your own superadmin role")
            if await _count_superadmins(db) <= 1:
                raise HTTPException(status_code=400, detail="At least one superadmin must remain")
        user.role = body.role
        changes["role"] = body.role

    if body.status:
        if user.role == _SUPERADMIN_ROLE and body.status == "blocked":
            if not is_superadmin(current):
                raise HTTPException(status_code=403, detail="Only superadmins can block a superadmin")
            if current.id == user.id:
                raise HTTPException(status_code=400, detail="Cannot block yourself")
            if await _count_superadmins(db) <= 1:
                raise HTTPException(status_code=400, detail="At least one superadmin must remain")
        user.status = body.status
        changes["status"] = body.status

    if "tenant_id" in body.model_fields_set:
        tenant_id = body.tenant_id or None
        _ensure_same_tenant_scope(current, tenant_id)
        await _get_tenant(db, tenant_id)
        if user.role == _SUPERADMIN_ROLE and tenant_id:
            raise HTTPException(status_code=400, detail="Superadmin accounts stay global and cannot be tenant-bound")
        user.tenant_id = tenant_id
        changes["tenant_id"] = tenant_id

    log_action(
        db,
        action="UPDATE_USER",
        actor_id=current.id,
        target_type="user",
        target_id=user.id,
        ip=request_ip(request),
        extra=changes or None,
    )
    await db.commit()
    return {"message": "Updated"}


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin_user),
):
    if current.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = await _get_user_in_scope(db, current, user_id)
    if user.role == _SUPERADMIN_ROLE and await _count_superadmins(db) <= 1:
        raise HTTPException(status_code=400, detail="At least one superadmin must remain")

    await revoke_all_sessions(user_id)
    log_action(db, action="DELETE_USER", actor_id=current.id, target_type="user", target_id=user.id, ip=request_ip(request))
    await db.delete(user)
    await db.commit()
    return {"message": "Deleted"}


@router.post("/{user_id}/block")
async def block_user(
    user_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin_user),
):
    if current.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    user = await _get_user_in_scope(db, current, user_id)
    if user.role == _SUPERADMIN_ROLE and await _count_superadmins(db) <= 1:
        raise HTTPException(status_code=400, detail="At least one superadmin must remain")

    user.status = "blocked"
    await revoke_all_sessions(user_id)
    log_action(db, action="BLOCK_USER", actor_id=current.id, target_type="user", target_id=user.id, ip=request_ip(request))
    await db.commit()
    dispatch_notification_event(
        "block_triggered",
        {
            "target_type": "user",
            "target_id": user.id,
            "target": user.email or user.username or user.id,
            "actor": current.username,
        },
        subject=f"{_settings.get('instance_name', 'SkyNet')} Notification — User Blocked",
        severity="medium",
    )
    return {"message": "Blocked"}


@router.delete("/{user_id}/block")
async def unblock_user(
    user_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin_user),
):
    user = await _get_user_in_scope(db, current, user_id)
    user.status = "active"
    log_action(db, action="UNBLOCK_USER", actor_id=current.id, target_type="user", target_id=user.id, ip=request_ip(request))
    await db.commit()
    return {"message": "Unblocked"}


@router.post("/{user_id}/reset-password")
async def reset_password(
    user_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin_user),
):
    user = await _get_user_in_scope(db, current, user_id)
    alphabet = string.ascii_letters + string.digits
    temp_pw = "".join(secrets.choice(alphabet) for _ in range(14))
    user.hashed_password = hash_password(temp_pw)
    log_action(
        db,
        action="RESET_PASSWORD",
        actor_id=current.id,
        target_type="user",
        target_id=user.id,
        ip=request_ip(request),
    )
    await db.commit()

    from ...services.email import send_reset_email

    if _settings.get("smtp_enabled") and user.email:
        background_tasks.add_task(
            send_reset_email,
            to=user.email,
            username=user.username,
            temp_password=temp_pw,
            login_url=(_settings.get("base_url") or "").rstrip("/") + "/login",
            instance_name=_settings.get("instance_name", "SkyNet"),
        )
        return {"message": "Reset email sent"}
    return {"message": "Password reset", "temp_password": temp_pw}


@router.get("/{user_id}/sessions")
async def get_sessions(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin_user),
):
    await _get_user_in_scope(db, current, user_id)
    return await list_sessions(user_id)


@router.delete("/{user_id}/sessions/{session_id}")
async def revoke_user_session(
    user_id: str,
    session_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin_user),
):
    await _get_user_in_scope(db, current, user_id)
    await revoke_session(user_id, session_id)
    log_action(
        db,
        action="REVOKE_SESSION",
        actor_id=current.id,
        target_type="session",
        target_id=session_id,
        ip=request_ip(request),
        extra={"user_id": user_id},
    )
    await db.commit()
    return {"message": "Revoked"}
