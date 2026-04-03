from typing import Optional

from pydantic import BaseModel, field_validator

from ..services.sanitize import clean_optional_text, clean_text


class CreateTenantRequest(BaseModel):
    name: str
    slug: str
    primary_host: Optional[str] = None
    description: Optional[str] = None
    default_theme_id: Optional[str] = None
    is_active: bool = True

    @field_validator("name", "slug")
    @classmethod
    def clean_required_fields(cls, value: str) -> str:
        return clean_text(value)

    @field_validator("primary_host", "description", "default_theme_id")
    @classmethod
    def clean_optional_fields(cls, value: Optional[str]) -> Optional[str]:
        return clean_optional_text(value)


class UpdateTenantRequest(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    primary_host: Optional[str] = None
    description: Optional[str] = None
    default_theme_id: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("name", "slug", "primary_host", "description", "default_theme_id")
    @classmethod
    def clean_optional_fields(cls, value: Optional[str]) -> Optional[str]:
        return clean_optional_text(value)


class TenantOut(BaseModel):
    id: str
    name: str
    slug: str
    primary_host: Optional[str] = None
    description: Optional[str] = None
    default_theme_id: Optional[str] = None
    default_theme_name: Optional[str] = None
    is_active: bool = True
    user_count: int = 0
    created_at: str
    updated_at: str
