import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ...core.database import get_db
from ...core.security import verify_password, create_access_token, get_current_user
from ...models.user import User
from ...middleware.rate_limit import limiter
from ...services.audit import log_action, request_ip
from ...services.sanitize import clean_text
from ...services.sessions import create_session, revoke_session
from datetime import datetime, timezone

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
@limiter.limit("10/minute")
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
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "username": user.username, "role": user.role},
    }


@router.post("/logout")
@limiter.limit("30/minute")
async def logout(request: Request, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    log_action(db, action="LOGOUT", actor_id=current_user.id, ip=request_ip(request))
    await db.commit()
    if getattr(current_user, "_session_id", None):
        await revoke_session(current_user.id, current_user._session_id)
    return {"message": "Logged out"}


@router.get("/me")
@limiter.limit("30/minute")
async def me(request: Request, current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "role": current_user.role,
        "status": current_user.status,
        "theme_id": current_user.theme_id,
        "theme_source": current_user.theme_source,
    }
