from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.core.config import settings
from app.core.database import init_db
from app.core.redis import close_redis, init_redis
from app.api import api_router
from app.middleware.rate_limit import limiter, rate_limit_exceeded_handler
from app.middleware.security_headers import SecurityHeadersMiddleware
from slowapi.errors import RateLimitExceeded


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await init_redis()
    # Create default admin user if none exists
    await create_default_admin()
    yield
    await close_redis()


async def create_default_admin():
    from app.core.database import AsyncSessionLocal
    from app.models.user import User
    from app.core.security import hash_password
    from sqlalchemy import select
    import uuid

    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(User).where(User.role == "admin"))
        if not existing:
            admin = User(
                id=str(uuid.uuid4()),
                email="admin@skynet.local",
                username="admin",
                hashed_password=hash_password("admin"),
                role="admin",
                status="active",
            )
            db.add(admin)
            await db.commit()
            print("✓ Default admin created: admin@skynet.local / admin")


app = FastAPI(
    title="SkyNet API",
    version=settings.APP_VERSION,
    description="SkyNet — Self-Hosted Visitor Tracking & Security Dashboard",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

# Serve tracker script and test pages
tracker_path = os.path.join(os.path.dirname(__file__), "tracker")
if os.path.exists(tracker_path):
    app.mount("/tracker", StaticFiles(directory=tracker_path, html=True), name="tracker")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "SkyNet"}
