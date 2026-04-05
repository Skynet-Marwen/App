import json
from collections import defaultdict
from datetime import datetime

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.incident import Incident
from ..models.visitor import Visitor

TRACKING_SIGNAL_TYPES = {
    "ADBLOCKER_DETECTED": "Adblocker detected",
    "DNS_FILTER_SUSPECTED": "DNS filter suspected",
    "ISP_UNRESOLVED": "ISP unresolved",
}


def _fmt_dt(dt: datetime | None) -> str | None:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


def _parse_extra(raw: str | None) -> dict | None:
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {"raw": raw}
    return parsed if isinstance(parsed, dict) else {"value": parsed}


def _empty_summary() -> dict:
    return {
        "adblocker_detected": False,
        "dns_filter_suspected": False,
        "isp_unresolved": False,
        "blocker_family": None,
        "last_detected_at": None,
        "open_incident_count": 0,
        "incident_count": 0,
        "signals": [],
    }


def summarize_tracking_incidents(incidents: list[Incident]) -> dict:
    summary = _empty_summary()
    for incident in sorted(incidents, key=lambda item: item.detected_at or datetime.min, reverse=True):
        if incident.type not in TRACKING_SIGNAL_TYPES:
            continue
        details = _parse_extra(incident.extra_data) or {}
        if incident.type == "ADBLOCKER_DETECTED":
            summary["adblocker_detected"] = True
        elif incident.type == "DNS_FILTER_SUSPECTED":
            summary["dns_filter_suspected"] = True
        elif incident.type == "ISP_UNRESOLVED":
            summary["isp_unresolved"] = True
        if not summary["last_detected_at"]:
            summary["last_detected_at"] = _fmt_dt(incident.detected_at)
        if incident.status == "open":
            summary["open_incident_count"] += 1
        summary["incident_count"] += 1
        summary["blocker_family"] = summary["blocker_family"] or details.get("blocker_family")
        summary["signals"].append(
            {
                "id": incident.id,
                "type": incident.type,
                "label": TRACKING_SIGNAL_TYPES[incident.type],
                "description": incident.description,
                "severity": incident.severity,
                "status": incident.status,
                "detected_at": _fmt_dt(incident.detected_at),
                "details": details,
            }
        )
    return summary


async def get_device_tracking_summary(db: AsyncSession, device_id: str | None) -> dict:
    if not device_id:
        return _empty_summary()
    incidents = (
        await db.execute(
            select(Incident)
            .where(
                Incident.device_id == device_id,
                Incident.type.in_(tuple(TRACKING_SIGNAL_TYPES.keys())),
            )
            .order_by(Incident.detected_at.desc())
            .limit(12)
        )
    ).scalars().all()
    return summarize_tracking_incidents(list(incidents))


async def get_visitor_tracking_summary(db: AsyncSession, visitor: Visitor | None) -> dict:
    if not visitor:
        return _empty_summary()
    clauses = []
    if visitor.device_id:
        clauses.append(Incident.device_id == visitor.device_id)
    if visitor.ip:
        clauses.append(and_(Incident.ip == visitor.ip, Incident.device_id.is_(None)))
    if not clauses:
        return _empty_summary()
    incidents = (
        await db.execute(
            select(Incident)
            .where(
                Incident.type.in_(tuple(TRACKING_SIGNAL_TYPES.keys())),
                or_(*clauses),
            )
            .order_by(Incident.detected_at.desc())
            .limit(12)
        )
    ).scalars().all()
    return summarize_tracking_incidents(list(incidents))


async def get_visitors_tracking_summary_map(db: AsyncSession, visitors: list[Visitor]) -> dict[str, dict]:
    if not visitors:
        return {}
    device_ids = sorted({visitor.device_id for visitor in visitors if visitor.device_id})
    ips = sorted({visitor.ip for visitor in visitors if visitor.ip})
    clauses = []
    if device_ids:
        clauses.append(Incident.device_id.in_(device_ids))
    if ips:
        clauses.append(and_(Incident.ip.in_(ips), Incident.device_id.is_(None)))
    if not clauses:
        return {visitor.id: _empty_summary() for visitor in visitors}
    incidents = (
        await db.execute(
            select(Incident)
            .where(
                Incident.type.in_(tuple(TRACKING_SIGNAL_TYPES.keys())),
                or_(*clauses),
            )
            .order_by(Incident.detected_at.desc())
        )
    ).scalars().all()
    by_device: dict[str, list[Incident]] = defaultdict(list)
    by_ip_without_device: dict[str, list[Incident]] = defaultdict(list)
    for incident in incidents:
        if incident.device_id:
            by_device[incident.device_id].append(incident)
        elif incident.ip:
            by_ip_without_device[incident.ip].append(incident)
    summaries: dict[str, dict] = {}
    for visitor in visitors:
        relevant = []
        if visitor.device_id:
            relevant.extend(by_device.get(visitor.device_id, []))
        if visitor.ip:
            relevant.extend(by_ip_without_device.get(visitor.ip, []))
        summaries[visitor.id] = summarize_tracking_incidents(relevant)
    return summaries


async def get_devices_tracking_summary_map(db: AsyncSession, device_ids: list[str]) -> dict[str, dict]:
    if not device_ids:
        return {}
    incidents = (
        await db.execute(
            select(Incident)
            .where(
                Incident.device_id.in_(device_ids),
                Incident.type.in_(tuple(TRACKING_SIGNAL_TYPES.keys())),
            )
            .order_by(Incident.detected_at.desc())
        )
    ).scalars().all()
    grouped: dict[str, list[Incident]] = defaultdict(list)
    for incident in incidents:
        if incident.device_id:
            grouped[incident.device_id].append(incident)
    return {device_id: summarize_tracking_incidents(grouped.get(device_id, [])) for device_id in device_ids}


async def get_external_user_tracking_summary(
    db: AsyncSession,
    external_user_id: str,
    device_ids: list[str] | None = None,
    visitor_ips: list[str] | None = None,
) -> dict:
    clauses = [Incident.user_id == external_user_id]
    if device_ids:
        clauses.append(Incident.device_id.in_(device_ids))
    if visitor_ips:
        clauses.append(and_(Incident.ip.in_(visitor_ips), Incident.device_id.is_(None)))
    incidents = (
        await db.execute(
            select(Incident)
            .where(
                Incident.type.in_(tuple(TRACKING_SIGNAL_TYPES.keys())),
                or_(*clauses),
            )
            .order_by(Incident.detected_at.desc())
            .limit(20)
        )
    ).scalars().all()
    return summarize_tracking_incidents(list(incidents))
