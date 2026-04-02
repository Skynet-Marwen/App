from pydantic import BaseModel, field_validator


class SelfSignedCertificateRequest(BaseModel):
    common_name: str
    valid_days: int = 30

    @field_validator("common_name")
    @classmethod
    def validate_common_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("common_name is required")
        return value
