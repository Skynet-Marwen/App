from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..services.sanitize import clean_mapping_strings, clean_optional_text, clean_text


ALLOWED_THEME_SOURCES = {"user", "default"}


class ThemeBase(BaseModel):
    name: str
    colors: dict[str, Any]
    layout: dict[str, Any] = Field(default_factory=dict)
    widgets: list[Any] = Field(default_factory=list)
    branding: dict[str, Any] | None = None
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return clean_text(value)

    @field_validator("colors")
    @classmethod
    def validate_colors(cls, value: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(value, dict) or not value:
            raise ValueError("colors must be a non-empty object")
        return clean_mapping_strings(value)

    @field_validator("layout")
    @classmethod
    def validate_layout(cls, value: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise ValueError("layout must be an object")
        return clean_mapping_strings(value)

    @field_validator("widgets")
    @classmethod
    def validate_widgets(cls, value: list[Any]) -> list[Any]:
        if not isinstance(value, list):
            raise ValueError("widgets must be an array")
        return clean_mapping_strings(value)

    @field_validator("branding")
    @classmethod
    def validate_branding(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is not None and not isinstance(value, dict):
            raise ValueError("branding must be an object or null")
        return clean_mapping_strings(value) if value is not None else value


class ThemeCreateRequest(ThemeBase):
    id: str
    is_default: bool = False

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        cleaned = clean_text(value).strip()
        if not cleaned:
            raise ValueError("id is required")
        return cleaned


class ThemeUpdateRequest(BaseModel):
    name: str | None = None
    colors: dict[str, Any] | None = None
    layout: dict[str, Any] | None = None
    widgets: list[Any] | None = None
    branding: dict[str, Any] | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        return clean_optional_text(value)

    @field_validator("colors")
    @classmethod
    def validate_colors(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is not None and (not isinstance(value, dict) or not value):
            raise ValueError("colors must be a non-empty object")
        return clean_mapping_strings(value) if value is not None else value

    @field_validator("layout")
    @classmethod
    def validate_layout(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is not None and not isinstance(value, dict):
            raise ValueError("layout must be an object")
        return clean_mapping_strings(value) if value is not None else value

    @field_validator("widgets")
    @classmethod
    def validate_widgets(cls, value: list[Any] | None) -> list[Any] | None:
        if value is not None and not isinstance(value, list):
            raise ValueError("widgets must be an array")
        return clean_mapping_strings(value) if value is not None else value

    @field_validator("branding")
    @classmethod
    def validate_branding(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is not None and not isinstance(value, dict):
            raise ValueError("branding must be an object or null")
        return clean_mapping_strings(value) if value is not None else value


class ThemeDefaultRequest(BaseModel):
    theme_id: str

    @field_validator("theme_id")
    @classmethod
    def validate_theme_id(cls, value: str) -> str:
        cleaned = clean_text(value).strip()
        if not cleaned:
            raise ValueError("theme_id is required")
        return cleaned


class UserThemeSelectionRequest(BaseModel):
    theme_id: str | None = None
    theme_source: Literal["user", "default"] | None = None

    @field_validator("theme_id")
    @classmethod
    def validate_theme_id(cls, value: str | None) -> str | None:
        return clean_optional_text(value)

    @field_validator("theme_source")
    @classmethod
    def validate_source(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = clean_text(value)
        if cleaned not in ALLOWED_THEME_SOURCES:
            raise ValueError("theme_source must be 'user' or 'default'")
        return cleaned


class ThemeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    colors: dict[str, Any]
    layout: dict[str, Any]
    widgets: list[Any]
    branding: dict[str, Any] | None
    is_default: bool
    is_active: bool


class ThemePackageLogo(BaseModel):
    filename: str
    content_type: str
    data_base64: str
    size_bytes: int

    @field_validator("filename", "content_type", "data_base64")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = clean_text(value)
        if not cleaned:
            raise ValueError("logo package fields cannot be empty")
        return cleaned


class ThemePackageDocument(BaseModel):
    schema_version: str = "theme-package.v1"
    exported_at: str
    theme: ThemeOut
    logo: ThemePackageLogo | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("schema_version", "exported_at")
    @classmethod
    def validate_document_text(cls, value: str) -> str:
        cleaned = clean_text(value)
        if not cleaned:
            raise ValueError("package metadata fields cannot be empty")
        return cleaned

    @field_validator("metadata")
    @classmethod
    def validate_metadata(cls, value: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise ValueError("metadata must be an object")
        return clean_mapping_strings(value)


class ThemeImportResponse(BaseModel):
    theme: ThemeOut
    replaced_existing: bool = False
    imported_logo: bool = False


class UserThemeResponse(BaseModel):
    selected_theme_id: str | None
    theme_source: str
    resolved_theme: ThemeOut
    default_theme_id: str
    available_themes: list[ThemeOut]
    fallback_applied: bool = False
    fallback_reason: str | None = None
