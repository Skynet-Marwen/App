"""
SMTP settings endpoints.
Routes: PUT  /settings/smtp          — save config (password encrypted at rest)
        POST /settings/smtp/test     — send test email without saving
        GET  /settings/smtp/reveal   — decrypt + return password (admin only)
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...services.audit import log_action, request_ip
from ...services.email import encrypt_password, decrypt_password, send_test_email
from ...services.runtime_config import runtime_settings, save_runtime_settings_cache

router = APIRouter(prefix="/settings", tags=["settings"])

_MASKED = "••••••••"
_settings = runtime_settings()
_SMTP_KEYS = {
    "smtp_enabled", "smtp_host", "smtp_port", "smtp_user",
    "smtp_from_name", "smtp_from_email", "smtp_tls", "smtp_ssl",
}


def _smtp_response() -> dict:
    return {
        **{k: _settings.get(k) for k in _SMTP_KEYS},
        "smtp_password": _MASKED if _settings.get("smtp_password_enc") else "",
    }


@router.put("/smtp")
async def update_smtp(
    data: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    for key in _SMTP_KEYS:
        if key in data:
            _settings[key] = data[key]
    pw = data.get("smtp_password", "")
    if pw and pw != _MASKED:
        _settings["smtp_password_enc"] = encrypt_password(pw)
    await save_runtime_settings_cache(db)
    log_action(
        db, action="CONFIG_CHANGE", actor_id=current.id,
        target_type="settings", target_id="smtp", ip=request_ip(request),
    )
    await db.commit()
    return _smtp_response()


@router.post("/smtp/test")
async def test_smtp(data: dict, _: User = Depends(get_current_user)):
    """Connect + send test email using provided values. Nothing is saved."""
    missing = {"host", "port", "from_email", "to_email"} - data.keys()
    if missing:
        raise HTTPException(422, f"Missing required fields: {sorted(missing)}")

    pw = data.get("password", "")
    if pw == _MASKED:
        pw = decrypt_password(_settings.get("smtp_password_enc", ""))

    cfg_override = {
        "host": data["host"],
        "port": int(data["port"]),
        "user": data.get("user", ""),
        "password": pw,
        "from_name": data.get("from_name", "SkyNet"),
        "from_email": data["from_email"],
        "tls": bool(data.get("tls", True)),
        "ssl": bool(data.get("ssl", False)),
    }
    try:
        await send_test_email(to=data["to_email"], cfg_override=cfg_override)
        return {"ok": True}
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/smtp/reveal")
async def reveal_smtp_password(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Return decrypted SMTP password. Restricted to admin.
    TODO: restrict to owner role once RBAC is implemented."""
    if current.role not in ("admin",):
        raise HTTPException(403, "Insufficient privileges")
    enc = _settings.get("smtp_password_enc", "")
    if not enc:
        raise HTTPException(404, "No SMTP password stored")
    log_action(
        db, action="REVEAL_SMTP_PASSWORD", actor_id=current.id,
        target_type="settings", target_id="smtp", ip=request_ip(request),
    )
    await db.commit()
    return {"password": decrypt_password(enc)}
