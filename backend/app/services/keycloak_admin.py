from __future__ import annotations

from datetime import datetime, timezone
import json

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user_profile import UserProfile
from .email import decrypt_password
from .runtime_config import runtime_settings


def _cfg() -> dict:
    settings = runtime_settings()
    target_realm = str(settings.get("keycloak_sync_realm") or "").strip()
    auth_realm = str(settings.get("keycloak_sync_auth_realm") or "").strip() or target_realm
    return {
        "enabled": bool(settings.get("keycloak_sync_enabled")),
        "base_url": str(settings.get("keycloak_sync_base_url") or "").rstrip("/"),
        "auth_realm": auth_realm,
        "realm": target_realm,
        "client_id": str(settings.get("keycloak_sync_client_id") or "admin-cli").strip(),
        "client_secret": decrypt_password(settings.get("keycloak_sync_client_secret_enc", "")),
        "username": str(settings.get("keycloak_sync_username") or "").strip(),
        "password": decrypt_password(settings.get("keycloak_sync_password_enc", "")),
        "user_limit": max(int(settings.get("keycloak_sync_user_limit") or 500), 1),
    }


def _display_name(user: dict) -> str | None:
    first = str(user.get("firstName") or "").strip()
    last = str(user.get("lastName") or "").strip()
    if first or last:
        return " ".join(part for part in (first, last) if part)
    return str(user.get("username") or "").strip() or None


async def _admin_token(client: httpx.AsyncClient, cfg: dict) -> str:
    if not cfg["enabled"]:
        raise HTTPException(status_code=400, detail="Keycloak sync is disabled")
    if not cfg["base_url"] or not cfg["realm"]:
        raise HTTPException(status_code=400, detail="Keycloak sync base URL and realm are required")

    token_url = f"{cfg['base_url']}/realms/{cfg['auth_realm']}/protocol/openid-connect/token"
    form = {"client_id": cfg["client_id"]}

    if cfg["client_secret"]:
        form["grant_type"] = "client_credentials"
        form["client_secret"] = cfg["client_secret"]
    elif cfg["username"] and cfg["password"]:
        form["grant_type"] = "password"
        form["username"] = cfg["username"]
        form["password"] = cfg["password"]
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide either a Keycloak client secret or admin username/password for user sync",
        )

    response = await client.post(token_url, data=form)
    if response.status_code >= 400:
        detail = response.text.strip()
        realm_context = f"auth realm '{cfg['auth_realm']}'"
        raise HTTPException(status_code=502, detail=f"Keycloak token request failed for {realm_context} ({response.status_code}): {detail}")

    access_token = response.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=502, detail="Keycloak token response did not include access_token")
    return access_token


async def _fetch_users(client: httpx.AsyncClient, cfg: dict, token: str) -> list[dict]:
    users_url = f"{cfg['base_url']}/admin/realms/{cfg['realm']}/users"
    headers = {"Authorization": f"Bearer {token}"}
    first = 0
    max_page = min(cfg["user_limit"], 100)
    users: list[dict] = []

    while len(users) < cfg["user_limit"]:
        response = await client.get(
            users_url,
            headers=headers,
            params={"first": first, "max": max_page},
        )
        if response.status_code >= 400:
            detail = response.text.strip()
            raise HTTPException(status_code=502, detail=f"Keycloak user fetch failed for target realm '{cfg['realm']}' ({response.status_code}): {detail}")
        batch = response.json()
        if not isinstance(batch, list) or not batch:
            break
        users.extend(batch)
        if len(batch) < max_page:
            break
        first += len(batch)

    return users[: cfg["user_limit"]]


async def sync_keycloak_users(db: AsyncSession) -> dict:
    cfg = _cfg()
    timeout = httpx.Timeout(20.0, connect=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        token = await _admin_token(client, cfg)
        users = await _fetch_users(client, cfg, token)

    created = 0
    updated = 0
    suspended = 0
    deleted = 0
    now = datetime.now(timezone.utc)

    # Track every ID returned by Keycloak for this realm
    keycloak_ids: set[str] = set()

    for item in users:
        external_user_id = str(item.get("id") or "").strip()
        if not external_user_id:
            continue
        keycloak_ids.add(external_user_id)

        kc_enabled = bool(item.get("enabled", True))
        profile = await db.scalar(
            select(UserProfile).where(UserProfile.external_user_id == external_user_id)
        )
        profile_data = {
            "id_provider": "keycloak",
            "realm": cfg["realm"],
            "username": item.get("username"),
            "enabled": kc_enabled,
            "email_verified": item.get("emailVerified", False),
            "synced_at": now.isoformat(),
        }
        if profile:
            profile.email = item.get("email") or profile.email
            profile.display_name = _display_name(item) or profile.display_name
            profile.profile_data = json.dumps(profile_data, separators=(",", ":"), sort_keys=True)
            # Keycloak account disabled → suspend in SkyNet (keep risk data, block access)
            if not kc_enabled and profile.status == "active":
                profile.status = "suspended"
                profile.trust_level = "blocked"
                suspended += 1
            elif kc_enabled and profile.status == "suspended":
                # Re-enabled in Keycloak → restore to normal
                profile.status = "active"
                if profile.trust_level == "blocked":
                    profile.trust_level = "normal"
            updated += 1
        else:
            new_status = "active" if kc_enabled else "suspended"
            db.add(
                UserProfile(
                    external_user_id=external_user_id,
                    email=item.get("email"),
                    display_name=_display_name(item),
                    trust_level="normal" if kc_enabled else "blocked",
                    current_risk_score=0.0,
                    status=new_status,
                    first_seen=now,
                    last_seen=now,
                    profile_data=json.dumps(profile_data, separators=(",", ":"), sort_keys=True),
                )
            )
            created += 1

    # Detect profiles from this realm that are no longer in Keycloak → soft-delete
    # Only considers profiles whose profile_data marks them as belonging to this realm.
    if keycloak_ids:
        realm_profiles = (
            await db.execute(
                select(UserProfile).where(
                    UserProfile.status.in_(["active", "suspended"]),
                    UserProfile.profile_data.contains(f'"realm": "{cfg["realm"]}"'),
                )
            )
        ).scalars().all()
        for profile in realm_profiles:
            if profile.external_user_id not in keycloak_ids:
                profile.status = "deleted"
                profile.trust_level = "blocked"
                deleted += 1

    summary = {
        "realm": cfg["realm"],
        "auth_realm": cfg["auth_realm"],
        "fetched": len(users),
        "created": created,
        "updated": updated,
        "suspended": suspended,
        "deleted": deleted,
        "synced_at": now.isoformat(),
    }
    settings = runtime_settings()
    settings["keycloak_sync_last_run_at"] = summary["synced_at"]
    settings["keycloak_sync_last_summary"] = summary
    return summary
