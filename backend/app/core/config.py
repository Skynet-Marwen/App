from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_VERSION: str = "1.7.4"
    APP_SECRET_KEY: str = "dev_secret_change_me"
    DEVICE_COOKIE_SECRET: str = ""
    APP_DEBUG: bool = True
    APP_BASE_URL: str = "http://localhost:8000"
    APP_HTTPS_MODE: str = "off"
    APP_HTTPS_PROVIDER: str = "reverse_proxy"
    APP_TRUST_PROXY_HEADERS: bool = False
    APP_HSTS_ENABLED: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://skynet:skynet@localhost:5432/skynet"
    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET: str = "dev_jwt_secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    GEOIP_DB_PATH: str = "./data/GeoLite2-City.mmdb"
    # "*" = allow all origins (self-hosted tool, security via API key + JWT)
    CORS_ORIGINS: str = "*"

    # Keycloak — external IdP for end-user JWT validation (not used for SKYNET operator auth)
    # These are bootstrap defaults; runtime values are managed via /api/v1/settings
    KEYCLOAK_JWKS_URL: str = ""
    KEYCLOAK_ISSUER: str = ""
    KEYCLOAK_AUDIENCE: str = ""
    KEYCLOAK_CACHE_TTL_SEC: int = 300
    KEYCLOAK_SYNC_BASE_URL: str = ""
    KEYCLOAK_SYNC_REALM: str = ""
    KEYCLOAK_SYNC_CLIENT_ID: str = "admin-cli"
    KEYCLOAK_SYNC_CLIENT_SECRET: str = ""
    KEYCLOAK_SYNC_USERNAME: str = ""
    KEYCLOAK_SYNC_PASSWORD: str = ""

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
