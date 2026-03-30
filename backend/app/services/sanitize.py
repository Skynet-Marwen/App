import bleach
from urllib.parse import urlsplit


def clean_text(value: str) -> str:
    return bleach.clean((value or "").strip(), tags=[], attributes={}, strip=True).strip()


def clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = clean_text(value)
    return cleaned or None


def clean_url(value: str | None) -> str | None:
    cleaned = clean_optional_text(value)
    if cleaned is None:
        return None
    parsed = urlsplit(cleaned)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Invalid URL")
    return cleaned


def clean_mapping_strings(value):
    if isinstance(value, dict):
        return {clean_text(str(k)): clean_mapping_strings(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean_mapping_strings(item) for item in value]
    if isinstance(value, str):
        return clean_text(value)
    return value
