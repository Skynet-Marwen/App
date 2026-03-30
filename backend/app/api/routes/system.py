"""System info endpoint — returns component versions for the dashboard footer."""
import sys
import fastapi
import sqlalchemy
import alembic as alembic_pkg
from fastapi import APIRouter
from ...core.config import settings

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/info")
async def system_info():
    return {
        "app":        settings.APP_VERSION,
        "api":        "v1",
        "fastapi":    fastapi.__version__,
        "python":     f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "sqlalchemy": sqlalchemy.__version__,
        "alembic":    alembic_pkg.__version__,
    }
