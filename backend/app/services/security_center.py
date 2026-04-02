from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.blocking import BlockedIP
from ..models.event import Event
from ..models.security_finding import SecurityFinding
from ..models.security_recommendation import SecurityRecommendation
from ..models.site import Site
from ..models.target_profile import TargetProfile
from ..models.threat_intel import ThreatIntel
from ..models.visitor import Visitor
from .security_center_ops import load_json, security_settings
from .stie_analysis import analyze_target
from .stie_sources import fetch_threat_feed_bundle

INTEL_LOCK = asyncio.Lock()
SCAN_LOCK = asyncio.Lock()
PAYLOAD_MARKERS = ("<script", "%3cscript", "' or 1=1", "../", "%2e%2e%2f", "${jndi:", "union select", "redirect=")


def _parse_datetime(value):
    if isinstance(value, datetime) or value is None:
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


async def _build_traffic_context(db: AsyncSession, site_id: str | None) -> dict:
    recent = datetime.now(timezone.utc) - timedelta(days=14)
    events = (
        await db.execute(
            select(Event.page_url, Event.referrer, Event.properties, Event.ip)
            .where(Event.site_id == site_id, Event.created_at >= recent)
            .order_by(Event.created_at.desc())
            .limit(200)
        )
    ).all()
    payload_markers: list[str] = []
    suspicious_ips: set[str] = set()
    for page_url, referrer, properties, ip in events:
        haystack = " ".join(filter(None, [page_url, referrer, properties])).lower()
        hits = [marker for marker in PAYLOAD_MARKERS if marker in haystack]
        if hits and ip:
            suspicious_ips.add(ip)
            payload_markers.extend(hits)

    blocked_visitors = await db.scalar(
        select(func.count()).select_from(Visitor).where(Visitor.site_id == site_id, Visitor.status == "blocked")
    ) or 0
    return {
        "payload_markers": payload_markers,
        "suspicious_ips": sorted(suspicious_ips),
        "blocked_visitors": int(blocked_visitors),
        "max_device_risk": min(100, len(payload_markers) * 12 + blocked_visitors * 8),
    }


async def refresh_threat_intel(db: AsyncSession, *, force: bool = False) -> int:
    cfg = security_settings()
    async with INTEL_LOCK:
        latest = await db.scalar(select(func.max(ThreatIntel.updated_at)))
        if latest and not force:
            next_due = latest + timedelta(hours=cfg["intel_refresh_interval_hours"])
            if next_due > datetime.now(timezone.utc):
                return 0

        rows, _meta = await asyncio.to_thread(fetch_threat_feed_bundle)
        now = datetime.now(timezone.utc)
        updated = 0
        for row in rows:
            item = await db.get(ThreatIntel, row["id"])
            if not item:
                item = ThreatIntel(id=row["id"], source=row["source"])
                db.add(item)
            item.source = row["source"]
            item.severity = float(row.get("severity") or 0.0)
            item.severity_label = row.get("severity_label") or "low"
            item.affected_software = json.dumps(row.get("affected_software", []))
            item.description = row.get("description") or ""
            item.references = json.dumps(row.get("references", []))
            item.published_at = _parse_datetime(row.get("published_at"))
            item.updated_at = now
            updated += 1
        await db.commit()
        return updated


async def _replace_site_results(db: AsyncSession, site_id: str | None) -> None:
    existing_ids = list(
        (
            await db.execute(
                select(SecurityFinding.id).where(SecurityFinding.site_id == site_id, SecurityFinding.status == "open")
            )
        ).scalars()
    )
    if existing_ids:
        await db.execute(delete(SecurityRecommendation).where(SecurityRecommendation.finding_id.in_(existing_ids)))
        await db.execute(delete(SecurityFinding).where(SecurityFinding.id.in_(existing_ids)))


async def _apply_auto_defense(db: AsyncSession, findings: list[SecurityFinding]) -> None:
    for finding in findings:
        evidence = load_json(finding.evidence, {})
        for ip in evidence.get("suspicious_ips", [])[:10]:
            blocked = await db.get(BlockedIP, ip)
            if not blocked:
                blocked = BlockedIP(ip=ip, reason="STIE active exploitation suspected")
                db.add(blocked)
            else:
                blocked.reason = "STIE active exploitation suspected"


async def run_security_scan(db: AsyncSession, *, force: bool = False, site_id: str | None = None, refresh_intel_first: bool = True) -> dict:
    cfg = security_settings()
    async with SCAN_LOCK:
        intel_updated = await refresh_threat_intel(db, force=force) if refresh_intel_first else 0
        threats = list((await db.execute(select(ThreatIntel).order_by(ThreatIntel.severity.desc()))).scalars())
        sites_query = select(Site).where(Site.active.is_(True))
        if site_id:
            sites_query = sites_query.where(Site.id == site_id)
        sites = list((await db.execute(sites_query.order_by(Site.created_at.desc()))).scalars())

        findings_created = 0
        recommendations_created = 0
        scanned_targets = 0
        threat_index = [{"id": item.id, "affected_software": item.affected_software_list(), "description": item.description} for item in threats]
        for site in sites:
            profile = await db.scalar(select(TargetProfile).where(TargetProfile.site_id == site.id))
            if not profile:
                profile = TargetProfile(site_id=site.id, base_url=site.url)
                db.add(profile)
                await db.flush()

            observed = list(
                (
                    await db.execute(
                        select(Event.page_url).where(Event.site_id == site.id, Event.page_url.is_not(None)).limit(100)
                    )
                ).scalars()
            )
            traffic = await _build_traffic_context(db, site.id)
            result = await asyncio.to_thread(
                analyze_target,
                site.url,
                observed,
                traffic,
                threat_index,
                cfg["max_scan_depth"],
                cfg["correlation_sensitivity"],
            )
            data = result["profile"]
            profile.base_url = data["base_url"]
            profile.detected_server = data["detected_server"]
            profile.powered_by = data["powered_by"]
            profile.frameworks = json.dumps(data["frameworks"])
            profile.technologies = json.dumps(data["technologies"])
            profile.response_headers = json.dumps(data["response_headers"])
            profile.observed_endpoints = json.dumps(data["observed_endpoints"])
            profile.scan_status = data["scan_status"]
            profile.notes = data["notes"]
            profile.last_scanned_at = datetime.now(timezone.utc)
            profile.updated_at = datetime.now(timezone.utc)

            await _replace_site_results(db, site.id)
            new_findings: list[SecurityFinding] = []
            for finding_data in result["findings"]:
                finding = SecurityFinding(
                    site_id=site.id,
                    profile_id=profile.id,
                    finding_type=finding_data["finding_type"],
                    title=finding_data["title"],
                    severity=finding_data["severity"],
                    endpoint=finding_data["endpoint"],
                    evidence=json.dumps(finding_data["evidence"]),
                    correlated_risk_score=finding_data["correlated_risk_score"],
                    active_exploitation_suspected=finding_data["active_exploitation_suspected"],
                    status="open",
                    updated_at=datetime.now(timezone.utc),
                )
                db.add(finding)
                await db.flush()
                new_findings.append(finding)
                findings_created += 1
                for recommendation in finding_data.get("recommendations", []):
                    db.add(
                        SecurityRecommendation(
                            finding_id=finding.id,
                            recommendation_text=recommendation["recommendation_text"],
                            priority=recommendation["priority"],
                            auto_applicable=recommendation["auto_applicable"],
                            action_key=recommendation["action_key"],
                            action_payload=json.dumps(recommendation["action_payload"]),
                            status="open",
                            updated_at=datetime.now(timezone.utc),
                        )
                    )
                    recommendations_created += 1

            if cfg["enable_auto_defense"]:
                await _apply_auto_defense(db, [item for item in new_findings if item.active_exploitation_suspected])
            scanned_targets += 1

        await db.commit()
        return {
            "scanned_targets": scanned_targets,
            "findings_created": findings_created,
            "recommendations_created": recommendations_created,
            "intel_updated": intel_updated,
        }
