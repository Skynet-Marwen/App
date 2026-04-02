from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.request
from pathlib import Path


NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=25"
GITHUB_URL = "https://api.github.com/advisories?per_page=20&type=reviewed"
GITHUB_SCORES = {"low": 3.1, "medium": 5.6, "high": 8.1, "critical": 9.8}


def _seed_path() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "threat_intel_seed.json"


def _http_json(url: str) -> object:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "SkyNet-STIE/1.0",
        },
    )
    context = ssl.create_default_context()
    with urllib.request.urlopen(request, timeout=8, context=context) as response:
        return json.loads(response.read().decode("utf-8"))


def _severity_label(score: float) -> str:
    if score >= 9:
        return "critical"
    if score >= 7:
        return "high"
    if score >= 4:
        return "medium"
    if score > 0:
        return "low"
    return "info"


def _extract_description(cve: dict) -> str:
    for item in cve.get("descriptions", []):
        if item.get("lang") == "en" and item.get("value"):
            return item["value"]
    return ""


def _extract_score(cve: dict) -> float:
    metrics = cve.get("metrics", {})
    for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
        values = metrics.get(key) or []
        for entry in values:
            data = entry.get("cvssData", {})
            score = data.get("baseScore")
            if isinstance(score, (int, float)):
                return float(score)
    return 0.0


def _extract_affected(cve: dict) -> list[str]:
    found: set[str] = set()
    for config in cve.get("configurations", []):
        for node in config.get("nodes", []):
            for match in node.get("cpeMatch", []):
                criteria = (match.get("criteria") or "").lower()
                parts = criteria.split(":")
                if len(parts) >= 6:
                    vendor = parts[3].replace("_", " ").strip()
                    product = parts[4].replace("_", " ").strip()
                    if vendor:
                        found.add(vendor)
                    if product:
                        found.add(product)
                    if vendor and product:
                        found.add(f"{vendor} {product}".strip())
    return sorted(found)


def _extract_references(cve: dict) -> list[str]:
    refs: list[str] = []
    for item in cve.get("references", []):
        url = item.get("url")
        if url:
            refs.append(url)
    return refs


def _parse_nvd(payload: dict) -> list[dict]:
    rows: list[dict] = []
    for item in payload.get("vulnerabilities", []):
        cve = item.get("cve", {})
        cve_id = cve.get("id")
        if not cve_id:
            continue
        score = _extract_score(cve)
        rows.append(
            {
                "id": cve_id,
                "source": "nvd",
                "severity": score,
                "severity_label": _severity_label(score),
                "affected_software": _extract_affected(cve),
                "description": _extract_description(cve),
                "references": _extract_references(cve),
                "published_at": cve.get("published"),
                "updated_at": cve.get("lastModified"),
            }
        )
    return rows


def _parse_github(payload: object) -> list[dict]:
    advisories = payload if isinstance(payload, list) else []
    rows: list[dict] = []
    for item in advisories:
        advisory_id = item.get("cve_id") or item.get("ghsa_id")
        if not advisory_id:
            continue
        severity_name = (item.get("severity") or "medium").lower()
        affected: set[str] = set()
        for vuln in item.get("vulnerabilities", []):
            package = vuln.get("package") or {}
            ecosystem = package.get("ecosystem")
            name = package.get("name")
            if ecosystem:
                affected.add(str(ecosystem).lower())
            if name:
                affected.add(str(name).lower())
        rows.append(
            {
                "id": advisory_id,
                "source": "github",
                "severity": GITHUB_SCORES.get(severity_name, 5.6),
                "severity_label": severity_name,
                "affected_software": sorted(affected),
                "description": item.get("summary") or item.get("description") or "",
                "references": [ref.get("url") for ref in item.get("references", []) if ref.get("url")],
                "published_at": item.get("published_at"),
                "updated_at": item.get("updated_at"),
            }
        )
    return rows


def load_local_fallback() -> list[dict]:
    data = json.loads(_seed_path().read_text(encoding="utf-8"))
    return [
        {
            **item,
            "published_at": item.get("published_at"),
            "updated_at": item.get("updated_at"),
        }
        for item in data
    ]


def fetch_threat_feed_bundle() -> tuple[list[dict], dict]:
    rows: list[dict] = []
    sources = {"nvd": 0, "github": 0, "local": 0}
    errors: list[str] = []

    try:
        nvd_rows = _parse_nvd(_http_json(NVD_URL))
        rows.extend(nvd_rows)
        sources["nvd"] = len(nvd_rows)
    except (OSError, urllib.error.URLError, ValueError, json.JSONDecodeError) as exc:
        errors.append(f"nvd:{exc}")

    try:
        github_rows = _parse_github(_http_json(GITHUB_URL))
        rows.extend(github_rows)
        sources["github"] = len(github_rows)
    except (OSError, urllib.error.URLError, ValueError, json.JSONDecodeError) as exc:
        errors.append(f"github:{exc}")

    deduped: dict[str, dict] = {}
    for row in rows:
        deduped.setdefault(row["id"], row)

    if not deduped:
        local_rows = load_local_fallback()
        for row in local_rows:
            deduped.setdefault(row["id"], row)
        sources["local"] = len(local_rows)
    elif sources["local"] == 0:
        local_rows = load_local_fallback()
        for row in local_rows:
            deduped.setdefault(row["id"], row)
        sources["local"] = len(local_rows)

    return list(deduped.values()), {"sources": sources, "errors": errors}
