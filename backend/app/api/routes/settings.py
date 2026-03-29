from fastapi import APIRouter, Depends
from ...core.security import get_current_user
from ...models.user import User

router = APIRouter(prefix="/settings", tags=["settings"])

# In-memory settings (persist to DB/file in production)
_settings = {
    "instance_name": "SkyNet",
    "base_url": "http://localhost:8000",
    "timezone": "UTC",
    "realtime_enabled": True,
    "auto_block_tor_vpn": False,
    "require_auth": False,
    "visitor_retention_days": 90,
    "event_retention_days": 90,
    "incident_retention_days": 365,
    "anonymize_ips": False,
    "webhook_url": "",
    "webhook_secret": "",
    "webhook_events": {},
}

_keycloak = {
    "url": "",
    "realm": "master",
    "client_id": "skynet",
    "client_secret": "",
    "admin_username": "admin",
    "admin_password": "",
    "enabled": False,
    "sync_users": False,
    "enforce_roles": False,
}


@router.get("")
async def get_settings(_: User = Depends(get_current_user)):
    return _settings


@router.put("")
async def update_settings(data: dict, _: User = Depends(get_current_user)):
    _settings.update(data)
    return _settings


@router.get("/keycloak")
async def get_keycloak(_: User = Depends(get_current_user)):
    safe = {k: v for k, v in _keycloak.items() if "password" not in k and "secret" not in k}
    return safe


@router.put("/keycloak")
async def update_keycloak(data: dict, _: User = Depends(get_current_user)):
    _keycloak.update(data)
    return {"message": "Updated"}
