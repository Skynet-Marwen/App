import ipaddress
from pydantic import BaseModel, field_validator
from typing import Optional, List
from ..services.sanitize import clean_optional_text, clean_text


class CreateRuleRequest(BaseModel):
    type: str
    value: str
    reason: Optional[str] = None
    action: str = "block"

    @field_validator("type", "value", "action")
    @classmethod
    def clean_required_fields(cls, value: str) -> str:
        return clean_text(value)

    @field_validator("reason")
    @classmethod
    def clean_reason(cls, value: Optional[str]) -> Optional[str]:
        return clean_optional_text(value)


class BlockingRuleOut(BaseModel):
    id: str
    type: str
    value: str
    reason: Optional[str] = None
    action: str
    hits: int
    created_at: str


class BlockIPRequest(BaseModel):
    ip: str
    reason: Optional[str] = None

    @field_validator("ip")
    @classmethod
    def validate_ip(cls, value: str) -> str:
        cleaned = clean_text(value)
        ipaddress.ip_address(cleaned)
        return cleaned

    @field_validator("reason")
    @classmethod
    def clean_block_reason(cls, value: Optional[str]) -> Optional[str]:
        return clean_optional_text(value)


class BlockedIPOut(BaseModel):
    ip: str
    country: Optional[str] = None
    country_flag: Optional[str] = None
    reason: Optional[str] = None
    hits: int
    blocked_at: str


class BlockedIPListResponse(BaseModel):
    total: int
    items: List[BlockedIPOut]
