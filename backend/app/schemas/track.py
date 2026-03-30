from pydantic import BaseModel, field_validator
from typing import Optional, Dict, Any
from ..services.sanitize import clean_mapping_strings, clean_optional_text, clean_text, clean_url


class PageviewPayload(BaseModel):
    page_url: str
    referrer: Optional[str] = None
    fingerprint: Optional[str] = None
    canvas_hash: Optional[str] = None
    webgl_hash: Optional[str] = None
    screen: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    session_id: Optional[str] = None

    @field_validator("page_url")
    @classmethod
    def validate_page_url(cls, value: str) -> str:
        return clean_url(value) or ""

    @field_validator("referrer")
    @classmethod
    def validate_referrer(cls, value: Optional[str]) -> Optional[str]:
        return clean_url(value)

    @field_validator("fingerprint", "canvas_hash", "webgl_hash", "screen", "language", "timezone", "session_id")
    @classmethod
    def clean_optional_fields(cls, value: Optional[str]) -> Optional[str]:
        return clean_optional_text(value)


class EventPayload(BaseModel):
    event_type: str
    page_url: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    fingerprint: Optional[str] = None
    session_id: Optional[str] = None

    @field_validator("event_type")
    @classmethod
    def clean_event_type(cls, value: str) -> str:
        return clean_text(value)

    @field_validator("page_url")
    @classmethod
    def validate_page_url(cls, value: Optional[str]) -> Optional[str]:
        return clean_url(value)

    @field_validator("fingerprint", "session_id")
    @classmethod
    def clean_optional_fields(cls, value: Optional[str]) -> Optional[str]:
        return clean_optional_text(value)

    @field_validator("properties")
    @classmethod
    def clean_properties(cls, value: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        return clean_mapping_strings(value)


class IdentifyPayload(BaseModel):
    user_id: str
    fingerprint: Optional[str] = None
    traits: Optional[Dict[str, Any]] = None

    @field_validator("user_id")
    @classmethod
    def clean_user_id(cls, value: str) -> str:
        return clean_text(value)

    @field_validator("fingerprint")
    @classmethod
    def clean_fingerprint(cls, value: Optional[str]) -> Optional[str]:
        return clean_optional_text(value)

    @field_validator("traits")
    @classmethod
    def clean_traits(cls, value: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        return clean_mapping_strings(value)
