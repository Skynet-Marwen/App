from pydantic import BaseModel, EmailStr
from typing import Optional, List


class CreateUserRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    role: str = "user"


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None


class UserOut(BaseModel):
    id: str
    email: str
    username: str
    role: str
    status: str
    keycloak_id: Optional[str] = None
    last_login: Optional[str] = None
    created_at: str
    devices_count: int = 0


class UserListResponse(BaseModel):
    total: int
    items: List[UserOut]
