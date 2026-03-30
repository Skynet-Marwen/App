"""
GeoIP lookup service — wraps geoip2 reader with lazy init and silent failure.
Database: GeoLite2-City.mmdb (path from settings.GEOIP_DB_PATH).
If the database file is absent the lookup returns an empty dict — never raises.
"""
import geoip2.database
import geoip2.errors
from .config import settings

_reader: geoip2.database.Reader | None = None
_load_attempted = False


def _get_reader() -> geoip2.database.Reader | None:
    global _reader, _load_attempted
    if _load_attempted:
        return _reader
    _load_attempted = True
    try:
        _reader = geoip2.database.Reader(settings.GEOIP_DB_PATH)
    except Exception:
        _reader = None
    return _reader


def _flag(code: str) -> str:
    """Convert ISO-3166-1 alpha-2 country code to flag emoji."""
    if not code or len(code) != 2:
        return ""
    code = code.upper()
    return chr(0x1F1E6 + ord(code[0]) - 65) + chr(0x1F1E6 + ord(code[1]) - 65)


def lookup(ip: str) -> dict:
    """
    Return geo fields for an IP.
    Keys: country, country_code, country_flag, city.
    Returns empty dict on any failure (missing DB, private IP, unknown IP).
    """
    reader = _get_reader()
    if reader is None:
        return {}
    try:
        record = reader.city(ip)
        code = record.country.iso_code or ""
        return {
            "country":      record.country.name or "",
            "country_code": code,
            "country_flag": _flag(code),
            "city":         record.city.name or "",
        }
    except Exception:
        return {}
