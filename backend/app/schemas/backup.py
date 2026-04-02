from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


BackupService = Literal["database", "settings", "assets"]
RestoreMode = Literal["full", "selective"]


class BackupCreateRequest(BaseModel):
    services: list[BackupService] = Field(min_length=1)
    password: str | None = Field(default=None, max_length=256)
    note: str | None = Field(default=None, max_length=160)


class BackupRestoreRequest(BaseModel):
    mode: RestoreMode = "full"
    services: list[BackupService] = Field(default_factory=list)
    password: str | None = Field(default=None, max_length=256)


class BackupFileMetadata(BaseModel):
    filename: str
    created_at: datetime
    services: list[BackupService]
    encrypted: bool
    note: str | None = None
    size_bytes: int
    sha256: str
    section_counts: dict[str, int] = Field(default_factory=dict)


class BackupListResponse(BaseModel):
    items: list[BackupFileMetadata]


class BackupCreateResponse(BaseModel):
    backup: BackupFileMetadata


class BackupRestoreResponse(BaseModel):
    restored_services: list[BackupService]
    archive: BackupFileMetadata
    mode: RestoreMode

