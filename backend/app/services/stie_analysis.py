from __future__ import annotations

import json
import re
import ssl
import urllib.parse
import urllib.request
from collections import Counter


SQL_ERROR_RE = re.compile(r"(sql syntax|sqlite|mysql|postgresql|ora-\d+|unterminated quoted string)", re.I)
FRAMEWORK_MARKERS = {
    "wordpress": ("wp-content", "wp-includes"),
    "next.js": ("__next", "_next/static", "__NEXT_DATA__"),
    "react": ("data-reactroot", "_reactRootContainer", "react"),
    "vue": ("data-v-", "__vue__", "vue.js"),
    "angular": ("ng-version", "angular"),
}
PAYLOAD_MARKERS = ("<script", "%3cscript", "' or 1=1", "../", "%2e%2e%2f", "${jndi:", "union select")
REDIRECT_KEYS = ("next", "url", "redirect", "return", "returnTo", "redirect_uri")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _normalize_base(url: str) -> str:
    parsed = urllib.parse.urlsplit(url if "://" in url else f"https://{url}")
    scheme = parsed.scheme or "https"
    host = parsed.netloc or parsed.path
    return urllib.parse.urlunsplit((scheme, host.rstrip("/"), "", "", ""))


def _same_origin(base_url: str, candidate: str) -> bool:
    base = urllib.parse.urlsplit(base_url)
    current = urllib.parse.urlsplit(candidate)
    return base.netloc == current.netloc


def _request(url: str, *, headers: dict | None = None, follow_redirects: bool = True, timeout: int = 4) -> dict:
    request = urllib.request.Request(url, headers=headers or {"User-Agent": "SkyNet-STIE/1.0"})
    context = ssl.create_default_context()
    handlers = [urllib.request.HTTPSHandler(context=context)]
    if not follow_redirects:
        handlers.append(_NoRedirect())
    opener = urllib.request.build_opener(*handlers)
    try:
        with opener.open(request, timeout=timeout) as response:
            body = response.read(180_000).decode("utf-8", errors="ignore")
            return {
                "status": getattr(response, "status", response.getcode()),
                "headers": {k.lower(): v for k, v in response.headers.items()},
                "cookies": response.headers.get_all("Set-Cookie", []),
                "body": body,
                "final_url": response.geturl(),
            }
    except urllib.error.HTTPError as exc:
        body = exc.read(180_000).decode("utf-8", errors="ignore")
        return {
            "status": exc.code,
            "headers": {k.lower(): v for k, v in exc.headers.items()},
            "cookies": exc.headers.get_all("Set-Cookie", []),
            "body": body,
            "final_url": url,
        }
    except Exception as exc:
        return {"status": 0, "headers": {}, "cookies": [], "body": "", "final_url": url, "error": str(exc)}


def _with_query(url: str, key: str, value: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    query = [(k, v) for k, v in query if k != key] + [(key, value)]
    return urllib.parse.urlunsplit(parsed._replace(query=urllib.parse.urlencode(query)))


def _build_paths(base_url: str, observed_urls: list[str], max_depth: int) -> list[str]:
    paths = ["/"]
    for url in observed_urls:
        if not url or not _same_origin(base_url, url):
            continue
        parsed = urllib.parse.urlsplit(url)
        path = parsed.path or "/"
        if path not in paths:
            paths.append(path)
    return paths[: max(1, max_depth)]


def _detect_stack(headers: dict, body: str) -> dict:
    technologies: set[str] = set()
    frameworks: set[str] = set()
    server = headers.get("server", "")
    powered_by = headers.get("x-powered-by", "")
    if server:
        technologies.add(server.split("/")[0].lower())
    if powered_by:
        technologies.add(powered_by.split("/")[0].lower())

    body_lower = body.lower()
    for name, markers in FRAMEWORK_MARKERS.items():
        if any(marker.lower() in body_lower for marker in markers):
            frameworks.add(name)
            technologies.add(name)
    return {
        "server": server or None,
        "powered_by": powered_by or None,
        "frameworks": sorted(frameworks),
        "technologies": sorted(technologies),
    }


def _severity_weight(level: str) -> float:
    return {"critical": 0.95, "high": 0.78, "medium": 0.56, "low": 0.32, "info": 0.18}.get(level, 0.25)


def _recommendation_for(finding: dict) -> dict:
    evidence = finding["evidence"]
    finding_type = finding["finding_type"]
    if finding_type == "missing_security_headers":
        return {
            "recommendation_text": f"Add the missing headers on {finding['endpoint']}: {', '.join(evidence.get('missing_headers', []))}.",
            "priority": "high" if "strict-transport-security" in evidence.get("missing_headers", []) else "medium",
            "auto_applicable": False,
            "action_key": None,
            "action_payload": {},
        }
    if finding_type == "weak_cookie_flags":
        return {
            "recommendation_text": "Harden session cookies with Secure, HttpOnly, and SameSite attributes.",
            "priority": "high",
            "auto_applicable": False,
            "action_key": None,
            "action_payload": {},
        }
    if finding_type == "cors_misconfiguration":
        return {
            "recommendation_text": "Restrict CORS origins and avoid wildcard origins when credentials are enabled.",
            "priority": "high",
            "auto_applicable": False,
            "action_key": None,
            "action_payload": {},
        }
    if evidence.get("suspicious_ips"):
        return {
            "recommendation_text": "Block the suspicious source IPs observed around this finding and enable adaptive defense for repeat attempts.",
            "priority": "critical" if finding["active_exploitation_suspected"] else "high",
            "auto_applicable": True,
            "action_key": "block_suspicious_ips",
            "action_payload": {"ips": evidence.get("suspicious_ips", [])},
        }
    return {
        "recommendation_text": "Review the affected endpoint, validate exposure, and raise protection posture if the pattern is seen in live traffic.",
        "priority": "medium",
        "auto_applicable": True,
        "action_key": "enable_auto_defense",
        "action_payload": {},
    }


def analyze_target(base_url: str, observed_urls: list[str], traffic: dict, threat_rows: list[dict], max_depth: int, sensitivity: float) -> dict:
    base = _normalize_base(base_url)
    root = _request(base)
    stack = _detect_stack(root["headers"], root["body"])
    paths = _build_paths(base, observed_urls, max_depth)
    findings: list[dict] = []

    missing_headers = [
        name for name in ("content-security-policy", "strict-transport-security", "x-frame-options", "x-content-type-options")
        if name not in root["headers"]
    ]
    if missing_headers:
        findings.append(
            {
                "finding_type": "missing_security_headers",
                "severity": "high" if "strict-transport-security" in missing_headers else "medium",
                "title": "Missing security headers",
                "endpoint": base,
                "evidence": {"missing_headers": missing_headers, "response_headers": root["headers"]},
            }
        )

    weak_cookies = [cookie for cookie in root["cookies"] if not all(flag in cookie.lower() for flag in ("secure", "httponly", "samesite"))]
    if weak_cookies:
        findings.append(
            {
                "finding_type": "weak_cookie_flags",
                "severity": "medium",
                "title": "Weak cookie flags detected",
                "endpoint": base,
                "evidence": {"cookies": weak_cookies},
            }
        )

    if root["headers"].get("access-control-allow-origin") == "*" and root["headers"].get("access-control-allow-credentials", "").lower() == "true":
        findings.append(
            {
                "finding_type": "cors_misconfiguration",
                "severity": "high",
                "title": "Wildcard CORS with credentials",
                "endpoint": base,
                "evidence": {"allow_origin": "*", "allow_credentials": True},
            }
        )

    for path in paths:
        url = urllib.parse.urljoin(base + "/", path.lstrip("/"))
        xss_marker = "<svg/onload=alert('skynet')>"
        xss_probe = _request(_with_query(url, "skynet_xss", xss_marker))
        if xss_probe["status"] and xss_marker in xss_probe["body"]:
            findings.append(
                {
                    "finding_type": "reflected_xss",
                    "severity": "high",
                    "title": "Potential reflected XSS pattern",
                    "endpoint": xss_probe["final_url"],
                    "evidence": {"reflected_marker": True, "status": xss_probe["status"]},
                }
            )

        sqli_probe = _request(_with_query(url, "skynet_sqli", "' OR 1=1 --"))
        if sqli_probe["status"] and SQL_ERROR_RE.search(sqli_probe["body"] or ""):
            findings.append(
                {
                    "finding_type": "sqli_error_pattern",
                    "severity": "high",
                    "title": "Potential SQL injection error disclosure",
                    "endpoint": sqli_probe["final_url"],
                    "evidence": {"error_excerpt": (SQL_ERROR_RE.search(sqli_probe["body"]).group(0) if SQL_ERROR_RE.search(sqli_probe["body"]) else "")},
                }
            )

        for key in REDIRECT_KEYS:
            redirect_probe = _request(
                _with_query(url, key, "https://example.com/skynet-check"),
                follow_redirects=False,
            )
            location = redirect_probe["headers"].get("location", "")
            if redirect_probe["status"] in {301, 302, 303, 307, 308} and location.startswith("https://example.com/skynet-check"):
                findings.append(
                    {
                        "finding_type": "open_redirect",
                        "severity": "medium",
                        "title": "Potential open redirect behavior",
                        "endpoint": redirect_probe["final_url"],
                        "evidence": {"parameter": key, "location": location},
                    }
                )
                break

    technology_text = " ".join(stack["technologies"] + stack["frameworks"]).lower()
    related_cves = []
    for row in threat_rows:
        haystack = " ".join(row.get("affected_software", [])) + " " + row.get("description", "")
        if technology_text and any(token in haystack.lower() for token in stack["technologies"] + stack["frameworks"]):
            related_cves.append(row["id"])

    payload_counter = Counter(traffic.get("payload_markers", []))
    suspicious_ips = sorted(traffic.get("suspicious_ips", []))
    traffic_risk = min(max((traffic.get("max_device_risk", 0) / 100.0), 0.0), 1.0)

    for finding in findings:
        matched_payloads = [marker for marker in payload_counter if marker in json.dumps(finding["evidence"]).lower()]
        score = _severity_weight(finding["severity"])
        score += min(0.22, len(related_cves) * 0.04)
        score += min(0.18, len(matched_payloads) * 0.06)
        score += traffic_risk * 0.22
        score += min(0.14, len(suspicious_ips) * 0.03)
        score *= max(0.45, min(1.15, sensitivity))
        active = bool((matched_payloads or related_cves) and suspicious_ips and score >= 0.72)
        finding["correlated_risk_score"] = round(min(score, 0.99), 2)
        finding["active_exploitation_suspected"] = active
        finding["evidence"].update(
            {
                "matched_cves": related_cves[:8],
                "matched_payloads": matched_payloads,
                "suspicious_ips": suspicious_ips[:10],
                "blocked_visitors": traffic.get("blocked_visitors", 0),
            }
        )
        finding["recommendations"] = [_recommendation_for(finding)]

    return {
        "profile": {
            "base_url": base,
            "detected_server": stack["server"],
            "powered_by": stack["powered_by"],
            "frameworks": stack["frameworks"],
            "technologies": stack["technologies"],
            "response_headers": root["headers"],
            "observed_endpoints": paths,
            "scan_status": "ok" if root["status"] else "unreachable",
            "notes": None if root["status"] else root.get("error", "Unable to reach target"),
        },
        "findings": findings,
    }
