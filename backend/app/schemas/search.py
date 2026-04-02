from typing import Literal

from pydantic import BaseModel


class SearchItem(BaseModel):
    id: str
    entity_type: Literal["visitor", "device", "portal_user"]
    title: str
    subtitle: str | None = None
    meta: str | None = None
    status: str | None = None
    route: str


class SearchSection(BaseModel):
    key: Literal["visitors", "devices", "portal_users"]
    label: str
    total: int
    items: list[SearchItem]


class SearchTotals(BaseModel):
    visitors: int = 0
    devices: int = 0
    portal_users: int = 0
    overall: int = 0


class SearchResponse(BaseModel):
    query: str
    totals: SearchTotals
    sections: list[SearchSection]
