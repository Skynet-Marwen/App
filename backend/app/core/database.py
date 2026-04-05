from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from .config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.APP_DEBUG, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    """Intentional no-op.

    DB schema is managed exclusively by Alembic migrations.
    The Dockerfile CMD runs ``alembic upgrade head`` before starting the app,
    so there is nothing to do here at application startup.
    This function exists as a hook in case future startup-time DB work is needed
    (e.g., seeding lookup tables) without requiring changes to callers.
    """
