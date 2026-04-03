from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .config import settings
from ..services.sessions import require_session, touch_session

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)
ADMIN_ROLES = {"admin", "superadmin"}


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_minutes: Optional[int] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.JWT_EXPIRE_MINUTES
    )
    payload = {**data, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


def is_superadmin(user) -> bool:
    return bool(user) and str(getattr(user, "role", "")).lower() == "superadmin"


def is_admin_user(user) -> bool:
    return bool(user) and str(getattr(user, "role", "")).lower() in ADMIN_ROLES


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    from ..models.user import User
    from ..core.database import AsyncSessionLocal
    from sqlalchemy import select

    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(credentials.credentials)
        user_id: str = payload.get("sub")
        session_id: str = payload.get("sid")
        if not user_id or not session_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    await require_session(user_id, session_id)
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or user.status == "blocked":
            raise HTTPException(status_code=401, detail="User not found or blocked")
        await touch_session(user_id, session_id)
        user._session_id = session_id
        user._token = credentials.credentials
        user._request = request
        return user


async def require_admin_user(current=Depends(get_current_user)):
    if not is_admin_user(current):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current


async def require_superadmin_user(current=Depends(get_current_user)):
    if not is_superadmin(current):
        raise HTTPException(status_code=403, detail="Superadmin privileges required")
    return current
