from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_VERSION: str = "1.0.1"
    APP_SECRET_KEY: str = "dev_secret_change_me"
    APP_DEBUG: bool = True
    APP_BASE_URL: str = "http://localhost:8000"

    DATABASE_URL: str = "postgresql+asyncpg://skynet:skynet@localhost:5432/skynet"
    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET: str = "dev_jwt_secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    GEOIP_DB_PATH: str = "./data/GeoLite2-City.mmdb"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
