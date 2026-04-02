from fastapi import APIRouter, BackgroundTasks, Depends, Query, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from ...core.database import get_db
from ...core.security import get_current_user, hash_password
from ...models.user import User
from ...schemas.user import CreateUserRequest, UpdateUserRequest
from ...services.audit import log_action, request_ip
from ...services.theme_service import assign_default_theme_to_user
from ...services.sessions import list_sessions, revoke_all_sessions, revoke_session
from ...services.runtime_config import runtime_settings
import secrets
import string
import uuid

router = APIRouter(prefix="/users", tags=["users"])

_settings = runtime_settings()


@router.get("")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    search: str = Query(""),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(User)
    cq = select(func.count()).select_from(User)
    if search:
        s = f"%{search}%"
        q = q.where(or_(User.email.ilike(s), User.username.ilike(s)))
        cq = cq.where(or_(User.email.ilike(s), User.username.ilike(s)))

    total = await db.scalar(cq) or 0
    result = await db.execute(q.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    users = result.scalars().all()
    return {
        "total": total,
        "items": [
            {
                "id": u.id,
                "email": u.email,
                "username": u.username,
                "role": u.role,
                "status": u.status,
                "last_login": u.last_login.strftime("%Y-%m-%d %H:%M") if u.last_login else None,
                "created_at": u.created_at.strftime("%Y-%m-%d %H:%M"),
                "devices_count": 0,
            }
            for u in users
        ],
    }


@router.post("")
async def create_user(
    body: CreateUserRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    existing = await db.scalar(select(User).where((User.email == body.email) | (User.username == body.username)))
    if existing:
        raise HTTPException(409, "Email or username already exists")
    user = User(
        id=str(uuid.uuid4()),
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await assign_default_theme_to_user(db, user)
    log_action(
        db, action="CREATE_USER", actor_id=current.id,
        target_type="user", target_id=user.id,
        ip=request_ip(request), extra={"role": user.role},
    )
    await db.commit()

    from ...services.email import send_welcome_email
    if _settings.get("smtp_enabled") and user.email:
        background_tasks.add_task(
            send_welcome_email,
            to=user.email,
            username=user.username,
            password=body.password,
            role=user.role,
            actor=current.username,
            login_url=(_settings.get("base_url") or "").rstrip("/") + "/login",
            instance_name=_settings.get("instance_name", "SkyNet"),
        )

    return {"id": user.id, "message": "Created"}


@router.get("/{user_id}")
async def get_user(user_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Not found")
    return u


@router.put("/{user_id}")
async def update_user(
    user_id: str,
    body: UpdateUserRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Not found")
    changes = {}
    if body.email and body.email != u.email:
        conflict = await db.scalar(select(User).where(User.email == body.email, User.id != user_id))
        if conflict:
            raise HTTPException(409, "Email already in use")
        u.email = body.email
        changes["email"] = body.email
    if body.username and body.username != u.username:
        conflict = await db.scalar(select(User).where(User.username == body.username, User.id != user_id))
        if conflict:
            raise HTTPException(409, "Username already in use")
        u.username = body.username
        changes["username"] = body.username
    if body.role:
        u.role = body.role
        changes["role"] = body.role
    if body.status:
        u.status = body.status
        changes["status"] = body.status
    log_action(
        db,
        action="UPDATE_USER",
        actor_id=current.id,
        target_type="user",
        target_id=u.id,
        ip=request_ip(request),
        extra=changes or None,
    )
    await db.commit()
    return {"message": "Updated"}


@router.delete("/{user_id}")
async def delete_user(user_id: str, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    if current.id == user_id:
        raise HTTPException(400, "Cannot delete yourself")
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Not found")
    await revoke_all_sessions(user_id)
    log_action(db, action="DELETE_USER", actor_id=current.id, target_type="user", target_id=u.id, ip=request_ip(request))
    await db.delete(u)
    await db.commit()
    return {"message": "Deleted"}


@router.post("/{user_id}/block")
async def block_user(
    user_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Not found")
    u.status = "blocked"
    await revoke_all_sessions(user_id)
    log_action(db, action="BLOCK_USER", actor_id=current.id, target_type="user", target_id=u.id, ip=request_ip(request))
    await db.commit()
    return {"message": "Blocked"}


@router.delete("/{user_id}/block")
async def unblock_user(
    user_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Not found")
    u.status = "active"
    log_action(db, action="UNBLOCK_USER", actor_id=current.id, target_type="user", target_id=u.id, ip=request_ip(request))
    await db.commit()
    return {"message": "Unblocked"}


@router.post("/{user_id}/reset-password")
async def reset_password(
    user_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Not found")
    alphabet = string.ascii_letters + string.digits
    temp_pw = "".join(secrets.choice(alphabet) for _ in range(14))
    u.hashed_password = hash_password(temp_pw)
    log_action(
        db, action="RESET_PASSWORD", actor_id=current.id,
        target_type="user", target_id=u.id, ip=request_ip(request),
    )
    await db.commit()

    from ...services.email import send_reset_email
    if _settings.get("smtp_enabled") and u.email:
        background_tasks.add_task(
            send_reset_email,
            to=u.email,
            username=u.username,
            temp_password=temp_pw,
            login_url=(_settings.get("base_url") or "").rstrip("/") + "/login",
            instance_name=_settings.get("instance_name", "SkyNet"),
        )
        return {"message": "Reset email sent"}
    return {"message": "Password reset", "temp_password": temp_pw}


@router.get("/{user_id}/sessions")
async def get_sessions(user_id: str, _: User = Depends(get_current_user)):
    return await list_sessions(user_id)


@router.delete("/{user_id}/sessions/{session_id}")
async def revoke_user_session(
    user_id: str,
    session_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
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
