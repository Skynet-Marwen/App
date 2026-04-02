from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
import uuid
from urllib.parse import quote

from fastapi.responses import HTMLResponse, RedirectResponse, Response

from ..core.redis import get_redis
from .anti_evasion_config import get_anti_evasion_config


def _secret() -> str:
    return os.environ.get("CHALLENGE_COOKIE_SECRET") or os.environ.get("APP_SECRET_KEY") or "dev_secret_change_me"


def challenge_settings() -> dict:
    return get_anti_evasion_config()


async def create_challenge_token(*, subject: str, request_id: str, next_url: str, reason: str) -> dict:
    cfg = challenge_settings()
    token = uuid.uuid4().hex
    payload = {
        "subject": subject,
        "request_id": request_id,
        "next_url": next_url,
        "reason": reason,
        "type": str(cfg.get("challenge_type") or "js_pow"),
        "difficulty": int(cfg.get("challenge_pow_difficulty", 4) or 4),
        "honeypot_field": str(cfg.get("challenge_honeypot_field") or "website"),
        "created_at": int(time.time()),
    }
    redis = get_redis()
    await redis.set(f"challenge:{token}", json.dumps(payload, separators=(",", ":")), ex=300)
    return {"token": token, **payload}


async def load_challenge_token(token: str) -> dict | None:
    redis = get_redis()
    raw = await redis.get(f"challenge:{token}")
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except ValueError:
        return None
    return value if isinstance(value, dict) else None


def issue_bypass_cookie(subject: str, ttl_sec: int) -> str:
    expires = int(time.time()) + max(int(ttl_sec or 900), 60)
    payload = f"{subject}:{expires}"
    signature = hmac.new(_secret().encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    token = f"{payload}:{signature}"
    return base64.urlsafe_b64encode(token.encode("utf-8")).decode("utf-8")


def verify_bypass_cookie(token: str | None, subject: str) -> bool:
    if not token:
        return False
    try:
        decoded = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
    except Exception:
        return False
    parts = decoded.split(":")
    if len(parts) != 3:
        return False
    cookie_subject, expires, signature = parts
    if cookie_subject != subject:
        return False
    payload = f"{cookie_subject}:{expires}"
    expected = hmac.new(_secret().encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return False
    try:
        return int(expires) >= int(time.time())
    except ValueError:
        return False


def verify_pow_solution(challenge: dict, nonce: str | None) -> bool:
    if not nonce:
        return False
    difficulty = max(int(challenge.get("difficulty") or 4), 1)
    digest = hashlib.sha256(f"{challenge.get('token', '')}:{nonce}".encode("utf-8")).hexdigest()
    return digest.startswith("0" * difficulty)


def build_challenge_response(*, challenge: dict, request_id: str, accept_html: bool) -> Response:
    cfg = challenge_settings()
    challenge_type = challenge.get("type") or "js_pow"
    next_url = challenge.get("next_url") or "/"
    redirect_url = str(cfg.get("challenge_redirect_url") or "").strip()

    if challenge_type == "captcha_redirect" and redirect_url:
        joiner = "&" if "?" in redirect_url else "?"
        location = f"{redirect_url}{joiner}return_to={quote(next_url, safe='')}&request_id={quote(request_id)}"
        return RedirectResponse(
            location=location,
            status_code=302,
            headers={"X-SkyNet-Decision": "challenge", "X-SkyNet-Challenge-Type": challenge_type, "X-SkyNet-Request-Id": request_id},
        )

    challenge_url = f"/api/v1/gateway/challenge/{challenge['token']}"
    if accept_html:
        return RedirectResponse(
            location=challenge_url,
            status_code=302,
            headers={"X-SkyNet-Decision": "challenge", "X-SkyNet-Challenge-Type": challenge_type, "X-SkyNet-Request-Id": request_id},
        )

    body = {
        "challenge": True,
        "request_id": request_id,
        "reason": challenge.get("reason"),
        "challenge_type": challenge_type,
        "challenge_url": challenge_url,
        "difficulty": challenge.get("difficulty"),
        "honeypot_field": challenge.get("honeypot_field"),
    }
    return Response(
        content=json.dumps(body),
        media_type="application/json",
        status_code=429,
        headers={"X-SkyNet-Decision": "challenge", "X-SkyNet-Challenge-Type": challenge_type, "X-SkyNet-Request-Id": request_id},
    )


def render_challenge_page(challenge: dict) -> HTMLResponse:
    challenge_type = challenge.get("type") or "js_pow"
    token = challenge.get("token", "")
    next_url = challenge.get("next_url") or "/"
    honeypot_field = challenge.get("honeypot_field") or "website"
    difficulty = int(challenge.get("difficulty") or 4)
    escaped_next = next_url.replace("&", "&amp;").replace('"', "&quot;")

    if challenge_type == "honeypot":
        html = f"""<!doctype html><html><body style="font-family:sans-serif;background:#030712;color:#e5e7eb;display:grid;place-items:center;min-height:100vh">
<form method="post" action="/api/v1/gateway/challenge/{token}/verify-honeypot" style="width:min(420px,92vw);padding:24px;border:1px solid #334155;border-radius:16px;background:#0f172a">
<h1>Security check</h1><p>Leave the hidden field empty, then continue.</p>
<div style="position:absolute;left:-10000px"><input name="{honeypot_field}" autocomplete="off"></div>
<input type="hidden" name="next" value="{escaped_next}">
<button type="submit" style="margin-top:16px;padding:10px 16px;background:#06b6d4;color:#03111f;border:0;border-radius:10px">Continue</button>
</form></body></html>"""
        return HTMLResponse(html, status_code=429, headers={"X-SkyNet-Decision": "challenge", "X-SkyNet-Challenge-Type": "honeypot"})

    html = f"""<!doctype html><html><body style="font-family:sans-serif;background:#030712;color:#e5e7eb;display:grid;place-items:center;min-height:100vh">
<div style="width:min(560px,94vw);padding:28px;border:1px solid #334155;border-radius:16px;background:#0f172a">
<h1>Security check</h1><p>Proof-of-work is running locally in your browser.</p>
<p id="status">Solving challenge…</p>
</div>
<script>
async function solve() {{
  const token = {json.dumps(token)};
  const difficulty = {difficulty};
  let nonce = 0;
  async function sha256(text) {{
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }}
  while (true) {{
    const hash = await sha256(token + ':' + nonce);
    if (hash.startsWith('0'.repeat(difficulty))) {{
      window.location.href = '/api/v1/gateway/challenge/' + token + '/verify?nonce=' + nonce + '&next=' + encodeURIComponent({json.dumps(next_url)});
      return;
    }}
    nonce += 1;
    if (nonce % 500 === 0) document.getElementById('status').textContent = 'Solving challenge… attempts: ' + nonce;
  }}
}}
solve();
</script></body></html>"""
    return HTMLResponse(html, status_code=429, headers={"X-SkyNet-Decision": "challenge", "X-SkyNet-Challenge-Type": challenge_type})
