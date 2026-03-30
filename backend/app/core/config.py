from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_VERSION: str = "1.1.0"
    APP_SECRET_KEY: str = "dev_secret_change_me"
    APP_DEBUG: bool = True
    APP_BASE_URL: str = "http://localhost:8000"

    DATABASE_URL: str = "postgresql+asyncpg://skynet:skynet@localhost:5432/skynet"
    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET: str = "dev_jwt_secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    GEOIP_DB_PATH: str = "./data/GeoLite2-City.mmdb"
    # "*" = allow all origins (self-hosted tool, security via API key + JWT)
    CORS_ORIGINS: str = "*"

    @property
    def cors_origins_list(self) -> List[str]:
        v = self.CORS_ORIGINS.strip()
        if v == "*":
            return ["*"]
        return [o.strip() for o in v.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
