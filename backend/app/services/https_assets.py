from __future__ import annotations

from datetime import datetime, timedelta, timezone
import ipaddress
from pathlib import Path
import re

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


_PEM_CERT = "BEGIN CERTIFICATE"
_PEM_KEY_MARKERS = (
    "BEGIN PRIVATE KEY",
    "BEGIN RSA PRIVATE KEY",
    "BEGIN EC PRIVATE KEY",
)
_HOST_RE = re.compile(r"^[A-Za-z0-9.-]+$")


def cert_root() -> Path:
    return Path(__file__).resolve().parents[2] / "data" / "certs"


def _cert_dir(name: str) -> Path:
    path = cert_root() / name
    path.mkdir(parents=True, exist_ok=True)
    return path


def _iso_mtime(path: Path) -> str | None:
    if not path.exists():
        return None
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()


def _status_for_dir(name: str) -> dict:
    directory = _cert_dir(name)
    cert = directory / "cert.pem"
    key = directory / "key.pem"
    chain = directory / "chain.pem"
    return {
        "name": name,
        "directory": str(directory),
        "ready": cert.exists() and key.exists(),
        "cert_exists": cert.exists(),
        "key_exists": key.exists(),
        "chain_exists": chain.exists(),
        "cert_path": str(cert),
        "key_path": str(key),
        "chain_path": str(chain),
        "updated_at": max(filter(None, [_iso_mtime(cert), _iso_mtime(key), _iso_mtime(chain)]), default=None),
    }


def certificate_status() -> dict:
    return {
        "self_signed": _status_for_dir("self-signed"),
        "uploaded": _status_for_dir("uploaded"),
    }


def _decode_upload(data: bytes, expected_markers: tuple[str, ...]) -> str:
    text = data.decode("utf-8", errors="ignore").strip()
    if not text:
        raise ValueError("Uploaded file is empty")
    if not any(marker in text for marker in expected_markers):
        raise ValueError("Uploaded PEM content is invalid")
    return text + "\n"


def save_uploaded_certificate(cert_bytes: bytes, key_bytes: bytes, chain_bytes: bytes | None = None) -> dict:
    directory = _cert_dir("uploaded")
    (directory / "cert.pem").write_text(_decode_upload(cert_bytes, (_PEM_CERT,)), encoding="utf-8")
    (directory / "key.pem").write_text(_decode_upload(key_bytes, _PEM_KEY_MARKERS), encoding="utf-8")
    if chain_bytes:
        (directory / "chain.pem").write_text(_decode_upload(chain_bytes, (_PEM_CERT,)), encoding="utf-8")
    else:
        (directory / "chain.pem").unlink(missing_ok=True)
    return _status_for_dir("uploaded")


def generate_self_signed_certificate(common_name: str, valid_days: int) -> dict:
    host = common_name.strip()
    if not host or not _HOST_RE.fullmatch(host):
        raise ValueError("Common name must be a hostname like skynet.local or localhost")
    if valid_days < 1 or valid_days > 825:
        raise ValueError("Self-signed certificate validity must be between 1 and 825 days")

    directory = _cert_dir("self-signed")
    cert_path = directory / "cert.pem"
    key_path = directory / "key.pem"

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    now = datetime.now(timezone.utc)
    subject = issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, host)])
    alt_names: list[x509.GeneralName] = [x509.DNSName(host)]
    if host == "localhost":
        alt_names.append(x509.IPAddress(ipaddress.ip_address("127.0.0.1")))

    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + timedelta(days=valid_days))
        .add_extension(x509.SubjectAlternativeName(alt_names), critical=False)
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(private_key=private_key, algorithm=hashes.SHA256())
    )

    key_path.write_bytes(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    cert_path.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))

    return _status_for_dir("self-signed")
