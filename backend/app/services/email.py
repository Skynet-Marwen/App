"""
SMTP email service.
  - Password stored Fernet-encrypted; decrypted only at send time.
  - The configured smtp_from_email (e.g. mr.robot@skynet.tn) is used as the
    sender address in every email and is shown visibly in the email body.
  - Templates live in email_templates.py.
  - Public API: send_welcome_email / send_reset_email / send_forgot_password_email
                send_test_email / send_incident_alert_email / send_operational_alert_email
  - Crypto API: encrypt_password / decrypt_password  (used by settings_smtp route)
"""
import base64
import hashlib
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from cryptography.fernet import Fernet, InvalidToken
from ..core.config import settings as cfg
from .runtime_config import runtime_settings
from . import email_templates as T

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


# ── Public API ────────────────────────────────────────────────────────────────

async def send_welcome_email(
    to: str, username: str, password: str, role: str,
    actor: str, login_url: str, instance_name: str,
    reset_link: str = "",
) -> None:
    reset_row = (
        f'<tr><td style="padding:6px 12px;color:#9ca3af">Set Password</td>'
        f'<td style="padding:6px 12px"><a href="{reset_link}" style="color:#22d3ee">'
        f'Click here (24h link)</a></td></tr>'
    ) if reset_link else ""
    html = T.WELCOME.format(
        instance_name=instance_name, actor=actor, login_url=login_url,
        username=username, password=password, role=role, reset_row=reset_row,
    )
    await _send(to, f"Welcome to {instance_name} — Account Created", html)


async def send_reset_email(
    to: str, username: str, temp_password: str,
    login_url: str, instance_name: str,
) -> None:
    html = T.ADMIN_RESET.format(
        instance_name=instance_name, login_url=login_url,
        username=username, password=temp_password,
    )
    await _send(to, f"Password Reset — {instance_name}", html)


async def send_forgot_password_email(
    to: str, username: str, reset_link: str, instance_name: str,
) -> None:
    html = T.FORGOT_RESET.format(
        instance_name=instance_name, username=username, reset_link=reset_link,
    )
    await _send(to, f"Password Reset Request — {instance_name}", html)


async def send_test_email(to: str, cfg_override: dict) -> None:
    await _send(to, "SkyNet — SMTP Test", T.TEST, cfg_override=cfg_override)


async def send_incident_alert_email(to: str, incident: dict, instance_name: str) -> None:
    severity = str(incident.get("severity", "high")).upper()
    accent = "#ef4444" if severity == "CRITICAL" else "#f59e0b"
    html = T.INCIDENT.format(
        instance_name=instance_name, accent=accent, severity=severity,
        incident_type=incident.get("type", "incident"),
        target=incident.get("target") or incident.get("ip") or incident.get("device_id") or incident.get("user_id") or "system",
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
    html = T.OP_ALERT.format(
        instance_name=instance_name, event_name=event_name,
        summary=summary, details=details, severity=severity, target=target,
    )
    await _send(to, subject, html)
