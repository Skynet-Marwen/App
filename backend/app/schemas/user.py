from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from ..services.sanitize import clean_optional_text, clean_text


class CreateUserRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    role: str = "user"

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return clean_text(str(value)).lower()

    @field_validator("username", "role")
    @classmethod
    def clean_fields(cls, value: str) -> str:
        return clean_text(value)


class UpdateUserRequest(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: Optional[EmailStr]) -> Optional[str]:
        return clean_text(str(value)).lower() if value else None

    @field_validator("username", "role", "status")
    @classmethod
    def clean_optional_fields(cls, value: Optional[str]) -> Optional[str]:
        return clean_optional_text(value)


class UserOut(BaseModel):
    id: str
    email: str
    username: str
    role: str
    status: str
    last_login: Optional[str] = None
    created_at: str
    devices_count: int = 0


class UserListResponse(BaseModel):
    total: int
    items: List[UserOut]


class UserSessionOut(BaseModel):
    id: str
    ip: str
    device: str
    created_at: Optional[str] = None
    last_active: Optional[str] = None
