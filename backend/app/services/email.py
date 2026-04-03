"""
SMTP email service.
  - Password stored Fernet-encrypted; decrypted only at send time.
  - send_welcome_email / send_reset_email / send_test_email
  - encrypt_password / decrypt_password  (used by settings_smtp route)
"""
import base64
import hashlib
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from cryptography.fernet import Fernet, InvalidToken
from ..core.config import settings as cfg
from .runtime_config import runtime_settings

_MASKED = "••••••••"


# ── Encryption ────────────────────────────────────────────────────────────────

def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(
        hashlib.sha256(f"smtp-{cfg.APP_SECRET_KEY}".encode()).digest()
    )
    return Fernet(key)


def encrypt_password(plaintext: str) -> str:
    if not plaintext:
        return ""
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_password(ciphertext: str) -> str:
    if not ciphertext:
        return ""
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, Exception):
        return ""


# ── Runtime config helper ─────────────────────────────────────────────────────

def _smtp_cfg() -> dict:
    _settings = runtime_settings()
    return {
        "host": _settings.get("smtp_host", ""),
        "port": int(_settings.get("smtp_port", 587)),
        "user": _settings.get("smtp_user", ""),
        "password": decrypt_password(_settings.get("smtp_password_enc", "")),
        "from_name": _settings.get("smtp_from_name", "SkyNet"),
        "from_email": _settings.get("smtp_from_email", ""),
        "tls": bool(_settings.get("smtp_tls", True)),
        "ssl": bool(_settings.get("smtp_ssl", False)),
    }


# ── Core sender ───────────────────────────────────────────────────────────────

async def _send(to: str, subject: str, html: str, cfg_override: dict | None = None) -> None:
    c = cfg_override or _smtp_cfg()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{c['from_name']} <{c['from_email']}>"
    msg["To"] = to
    msg.attach(MIMEText(html, "html", "utf-8"))

    # Strip spaces — Google App Passwords include spaces for readability only
    password = (c["password"] or "").replace(" ", "")
    use_ssl = bool(c["ssl"])
    use_starttls = bool(c["tls"]) and not use_ssl

    smtp = aiosmtplib.SMTP(
        hostname=c["host"],
        port=c["port"],
        use_tls=use_ssl,
        timeout=15,
    )
    await smtp.connect()
    try:
        if use_starttls:
            await smtp.starttls()
        if c["user"]:
            await smtp.login(c["user"], password)
        await smtp.send_message(msg)
    finally:
        try:
            await smtp.quit()
        except Exception:
            pass


# ── Email templates ───────────────────────────────────────────────────────────

_WELCOME = """
<div style="font-family:monospace;background:#050505;color:#e5e7eb;padding:32px;
            max-width:520px;margin:auto;border:1px solid #1f2937;border-radius:8px">
  <p style="color:#22d3ee;font-size:18px;font-weight:700;margin:0 0 16px">
    Welcome to {instance_name}</p>
  <p style="margin:0 0 12px">Your account has been created by <strong>{actor}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
    <tr><td style="padding:6px 12px;color:#9ca3af">Login URL</td>
        <td style="padding:6px 12px"><a href="{login_url}" style="color:#22d3ee">{login_url}</a></td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Username</td>
        <td style="padding:6px 12px">{username}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Password</td>
        <td style="padding:6px 12px;font-weight:700;color:#f9fafb">{password}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Role</td>
        <td style="padding:6px 12px;text-transform:capitalize">{role}</td></tr>
  </table>
  <p style="color:#ef4444;font-size:12px;border-top:1px solid #1f2937;padding-top:12px;margin:0">
    ⚠ Change your password immediately after first login.<br>
    This system is restricted to authorised personnel only.
    Unauthorised access is prohibited and fully monitored.
  </p>
</div>
"""

_RESET = """
<div style="font-family:monospace;background:#050505;color:#e5e7eb;padding:32px;
            max-width:520px;margin:auto;border:1px solid #1f2937;border-radius:8px">
  <p style="color:#f59e0b;font-size:18px;font-weight:700;margin:0 0 16px">
    Password Reset — {instance_name}</p>
  <p style="margin:0 0 12px">A password reset was performed on your account.</p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
    <tr><td style="padding:6px 12px;color:#9ca3af">Login URL</td>
        <td style="padding:6px 12px"><a href="{login_url}" style="color:#22d3ee">{login_url}</a></td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Username</td>
        <td style="padding:6px 12px">{username}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Temp Password</td>
        <td style="padding:6px 12px;font-weight:700;color:#f9fafb">{password}</td></tr>
  </table>
  <p style="color:#6b7280;font-size:12px;border-top:1px solid #1f2937;padding-top:12px;margin:0">
    If you did not request this reset, contact your administrator immediately.
  </p>
</div>
"""

_TEST = """
<div style="font-family:monospace;background:#050505;color:#e5e7eb;padding:32px;
            max-width:520px;margin:auto;border:1px solid #1f2937;border-radius:8px">
  <p style="color:#22d3ee;font-size:18px;font-weight:700;margin:0 0 8px">
    SkyNet — SMTP Test</p>
  <p style="color:#6b7280;margin:0">SMTP configuration is working correctly.</p>
</div>
"""

_INCIDENT = """
<div style="font-family:monospace;background:#050505;color:#e5e7eb;padding:32px;
            max-width:560px;margin:auto;border:1px solid #1f2937;border-radius:8px">
  <p style="color:{accent};font-size:18px;font-weight:700;margin:0 0 14px">
    {instance_name} Incident Alert</p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
    <tr><td style="padding:6px 12px;color:#9ca3af">Severity</td><td style="padding:6px 12px">{severity}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Type</td><td style="padding:6px 12px">{incident_type}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Target</td><td style="padding:6px 12px">{target}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Detected</td><td style="padding:6px 12px">{detected_at}</td></tr>
  </table>
  <p style="margin:0 0 10px">{description}</p>
  <p style="margin:0;color:#6b7280;font-size:12px">Review this incident in the SKYNET dashboard and escalate if it remains open.</p>
</div>
"""

_OP_ALERT = """
<div style="font-family:monospace;background:#050505;color:#e5e7eb;padding:32px;
            max-width:560px;margin:auto;border:1px solid #1f2937;border-radius:8px">
  <p style="color:#22d3ee;font-size:18px;font-weight:700;margin:0 0 14px">
    {instance_name} Notification</p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
    <tr><td style="padding:6px 12px;color:#9ca3af">Event</td><td style="padding:6px 12px">{event_name}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Severity</td><td style="padding:6px 12px">{severity}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Target</td><td style="padding:6px 12px">{target}</td></tr>
  </table>
  <p style="margin:0 0 10px">{summary}</p>
  <p style="margin:0;color:#6b7280;font-size:12px">{details}</p>
</div>
"""


# ── Public API ────────────────────────────────────────────────────────────────

async def send_welcome_email(
    to: str, username: str, password: str, role: str,
    actor: str, login_url: str, instance_name: str,
) -> None:
    html = _WELCOME.format(
        instance_name=instance_name, actor=actor,
        login_url=login_url, username=username,
        password=password, role=role,
    )
    await _send(to, f"Welcome to {instance_name}", html)


async def send_reset_email(
    to: str, username: str, temp_password: str,
    login_url: str, instance_name: str,
) -> None:
    html = _RESET.format(
        instance_name=instance_name,
        login_url=login_url, username=username, password=temp_password,
    )
    await _send(to, f"Password Reset — {instance_name}", html)


async def send_test_email(to: str, cfg_override: dict) -> None:
    await _send(to, "SkyNet — SMTP Test", _TEST, cfg_override=cfg_override)


async def send_incident_alert_email(to: str, incident: dict, instance_name: str) -> None:
    severity = str(incident.get("severity", "high")).upper()
    accent = "#ef4444" if severity == "CRITICAL" else "#f59e0b"
    html = _INCIDENT.format(
        instance_name=instance_name,
        accent=accent,
        severity=severity,
        incident_type=incident.get("type", "incident"),
        target=incident.get("target", incident.get("ip") or incident.get("device_id") or incident.get("user_id") or "system"),
        detected_at=incident.get("detected_at", ""),
        description=incident.get("description", "A high-severity incident was detected."),
    )
    await _send(to, f"{instance_name} Incident Alert — {incident.get('type', 'incident')}", html)


async def send_operational_alert_email(
    to: str,
    *,
    subject: str,
    event_name: str,
    summary: str,
    details: str,
    severity: str,
    target: str,
    instance_name: str,
) -> None:
    html = _OP_ALERT.format(
        instance_name=instance_name,
        event_name=event_name,
        summary=summary,
        details=details,
        severity=severity,
        target=target,
    )
    await _send(to, subject, html)
