from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...schemas.search import SearchResponse
from ...services.dashboard_search import search_dashboard


router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResponse)
async def search_entities(
    q: str = Query("", min_length=0),
    limit: int = Query(4, ge=1, le=8),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await search_dashboard(db, q, limit=limit)
