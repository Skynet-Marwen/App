from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, case
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.visitor import Visitor
from ...models.device import Device
from ...models.blocking import BlockedIP, BlockingRule
from ...models.incident import Incident
from ...models.event import Event
from ...models.user_profile import UserProfile
from ...models.anomaly_flag import AnomalyFlag
from ...schemas.stats import OverviewResponse, RealtimeResponse
from ...services.gateway_analytics import summarize_gateway_dashboard
from ...services.overview_realtime import get_realtime_snapshot
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/stats", tags=["stats"])

RANGE_MAP = {"1h": 1/24, "24h": 1, "7d": 7, "30d": 30}
SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _format_time(dt: datetime | None) -> str:
    return dt.strftime("%H:%M") if dt else "—"


def _humanize_age(dt: datetime | None, now: datetime) -> str:
    if not dt:
        return "unknown"
    delta = now - dt
    if delta < timedelta(minutes=1):
        return "just now"
    if delta < timedelta(hours=1):
        return f"{int(delta.total_seconds() // 60)}m ago"
    if delta < timedelta(days=1):
        return f"{int(delta.total_seconds() // 3600)}h ago"
    return f"{delta.days}d ago"


def _incident_target(incident: Incident) -> tuple[str, str]:
    if incident.user_id:
        return "user", incident.user_id[:12]
    if incident.device_id:
        return "device", incident.device_id[:12]
    if incident.ip:
        return "ip", incident.ip
    return "system", incident.type


def _safe_ratio(current: int, previous: int) -> int:
    if previous <= 0:
        return 100 if current > 0 else 0
    return round(((current - previous) / previous) * 100)


def _isoformat(dt: datetime | None) -> str | None:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


@router.get("/overview", response_model=OverviewResponse)
async def overview(
    time_range: str = Query("24h", alias="range"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    days = RANGE_MAP.get(time_range, 1)
    since = now - timedelta(days=days)
    
    # Current period metrics
    total_visitors = await db.scalar(select(func.count(func.distinct(Visitor.id))).where(Visitor.first_seen >= since)) or 0
    total_blocked_entities = await db.scalar(select(func.count(BlockingRule.id))) or 0
    total_blocked_entities += await db.scalar(select(func.count(BlockedIP.ip))) or 0
    total_detected = await db.scalar(
        select(func.count()).select_from(Incident).where(Incident.detected_at >= since)
    ) or 0
    blocked_attempts = await db.scalar(
        select(func.sum(BlockedIP.hits)).select_from(BlockedIP)
    ) or 0
    unique_users = await db.scalar(
        select(func.count(func.distinct(Visitor.linked_user))).where(
            Visitor.first_seen >= since, Visitor.linked_user.isnot(None)
        )
    ) or 0
    
    # Count devices
    total_devices = await db.scalar(
        select(func.count(func.distinct(Visitor.device_id))).where(Visitor.first_seen >= since, Visitor.device_id.isnot(None))
    ) or 0

    # Blocked count: blocked IPs + blocked visitors + blocked devices
    blocked_ips_count = await db.scalar(select(func.count(BlockedIP.ip))) or 0
    blocked_visitors_count = await db.scalar(
        select(func.count(Visitor.id)).where(Visitor.status == "blocked")
    ) or 0
    blocked_devices_count = await db.scalar(
        select(func.count(Device.id)).where(Device.status == "blocked")
    ) or 0
    total_blocked = blocked_ips_count + blocked_visitors_count + blocked_devices_count
    
    # Evasion attempts from incidents
    evasion_attempts = await db.scalar(
        select(func.count()).select_from(Incident).where(Incident.detected_at >= since)
    ) or 0
    
    # Count spam/suspicious events
    spam_events = await db.scalar(
        select(func.count()).select_from(Event).where(
            Event.created_at >= since, 
            Event.event_type.in_(["spam", "suspicious"])
        )
    ) or 0
    
    # Previous period for comparison (7 days ago)
    prev_since = since - timedelta(days=days)
    prev_visitors = await db.scalar(
        select(func.count(func.distinct(Visitor.id))).where(
            Visitor.first_seen >= prev_since, Visitor.first_seen < since
        )
    ) or 1
    prev_detected = await db.scalar(
        select(func.count()).select_from(Incident).where(
            Incident.detected_at >= prev_since, Incident.detected_at < since
        )
    ) or 0
    prev_detected = prev_detected or 1
    
    # Calculate percentage changes
    visitors_change = round(((total_visitors - prev_visitors) / prev_visitors * 100)) if prev_visitors else 0
    blocked_change = round(((total_detected - prev_detected) / prev_detected * 100)) if prev_detected else 0
    
    # Traffic heatmap — dynamic bucketing by range
    _bucket_cfg = {
        '1h':  ("DATE_TRUNC('minute', created_at)",  60,  timedelta(minutes=1)),
        '24h': (
            "DATE_TRUNC('hour', created_at) + "
            "FLOOR(EXTRACT(MINUTE FROM created_at) / 15)::int * INTERVAL '15 minutes'",
            96, timedelta(minutes=15),
        ),
        '7d':  ("DATE_TRUNC('hour', created_at)", 168, timedelta(hours=1)),
        '30d': ("DATE_TRUNC('day',  created_at)",  30,  timedelta(days=1)),
    }
    bucket_expr, expected_count, bucket_delta = _bucket_cfg.get(
        time_range, ("DATE_TRUNC('hour', created_at)", 24, timedelta(hours=1))
    )

    # Align since to bucket boundary so fill-loop keys match SQL results
    if time_range == '1h':
        since_aligned = since.replace(second=0, microsecond=0)
    elif time_range == '24h':
        m = (since.minute // 15) * 15
        since_aligned = since.replace(minute=m, second=0, microsecond=0)
    elif time_range == '7d':
        since_aligned = since.replace(minute=0, second=0, microsecond=0)
    else:
        since_aligned = since.replace(hour=0, minute=0, second=0, microsecond=0)

    try:
        heatmap_sql = f"""
        SELECT {bucket_expr} AS bucket, COUNT(*) AS count
        FROM events
        WHERE created_at >= :since AND event_type = 'pageview'
        GROUP BY 1 ORDER BY 1
        """
        result = await db.execute(text(heatmap_sql), {"since": since_aligned})
        rows = result.fetchall()

        def _utc(dt):
            return dt.replace(tzinfo=timezone.utc) if dt and dt.tzinfo is None else dt

        buckets = {_utc(row[0]): row[1] for row in rows}
        traffic_heatmap, current = [], since_aligned
        for _ in range(expected_count):
            traffic_heatmap.append({
                'timestamp': current.strftime('%Y-%m-%d %H:%M:%S'),
                'count': buckets.get(current, 0),
            })
            current += bucket_delta
    except Exception:
        traffic_heatmap = []

    # Blocking chart - by incident type
    blocking_query = """
    SELECT type, COUNT(*) as count
    FROM incidents
    GROUP BY type
    ORDER BY count DESC
    LIMIT 10
    """
    try:
        result = await db.execute(text(blocking_query))
        rows = result.fetchall()
        blocking_chart = [
            {"reason": row[0], "count": row[1]}
            for row in rows
        ]
    except Exception:
        blocking_chart = []
    
    # Top countries by visitor count
    countries_result = await db.execute(
        select(
            Visitor.country,
            Visitor.country_flag,
            func.count(Visitor.id).label("cnt"),
        )
        .where(Visitor.first_seen >= since, Visitor.country.isnot(None))
        .group_by(Visitor.country, Visitor.country_flag)
        .order_by(func.count(Visitor.id).desc())
        .limit(10)
    )
    country_rows = countries_result.fetchall()
    country_total = sum(r[2] for r in country_rows) or 1
    previous_countries_result = await db.execute(
        select(
            Visitor.country,
            func.count(Visitor.id).label("cnt"),
        )
        .where(
            Visitor.first_seen >= prev_since,
            Visitor.first_seen < since,
            Visitor.country.isnot(None),
        )
        .group_by(Visitor.country)
    )
    previous_country_counts = {row[0]: row[1] for row in previous_countries_result.fetchall()}
    top_countries = [
        {
            "country": r[0],
            "flag": r[1] or "",
            "count": r[2],
            "percent": round(r[2] / country_total * 100, 1),
        }
        for r in country_rows
    ]

    incident_rows_result = await db.execute(
        select(Incident)
        .where(Incident.detected_at >= prev_since)
        .order_by(Incident.detected_at.desc())
        .limit(200)
    )
    incident_rows = incident_rows_result.scalars().all()
    incident_ips = sorted({incident.ip for incident in incident_rows if incident.ip})
    latest_country_by_ip: dict[str, tuple[str, str]] = {}
    if incident_ips:
        visitor_ip_result = await db.execute(
            select(Visitor.ip, Visitor.country, Visitor.country_flag, Visitor.last_seen)
            .where(Visitor.ip.in_(incident_ips))
            .where(Visitor.country.isnot(None))
            .order_by(Visitor.ip.asc(), Visitor.last_seen.desc())
        )
        for ip, country, flag, _last_seen in visitor_ip_result.fetchall():
            if ip and ip not in latest_country_by_ip:
                latest_country_by_ip[ip] = (country, flag or "")

    reasons_by_country: dict[str, dict[str, int]] = {}
    current_country_incidents: dict[str, int] = {}
    for incident in incident_rows:
        if not incident.ip:
            continue
        mapping = latest_country_by_ip.get(incident.ip)
        if not mapping:
            continue
        country_name, _flag = mapping
        if incident.detected_at and incident.detected_at >= since:
            current_country_incidents[country_name] = current_country_incidents.get(country_name, 0) + 1
        reasons_by_country.setdefault(country_name, {})
        reasons_by_country[country_name][incident.type] = reasons_by_country[country_name].get(incident.type, 0) + 1

    threat_hotspots = []
    for country in top_countries:
        previous_count = previous_country_counts.get(country["country"], 0)
        country_incidents = current_country_incidents.get(country["country"], 0)
        reason_counts = reasons_by_country.get(country["country"], {})
        top_reason = max(reason_counts.items(), key=lambda item: item[1])[0] if reason_counts else "mixed"
        threat_score = min(99, round(country["percent"] * 1.3 + country_incidents * 6))
        threat_hotspots.append(
            {
                **country,
                "delta": _safe_ratio(country["count"], previous_count),
                "top_reason": top_reason,
                "threat_score": threat_score,
            }
        )

    # Recent incidents
    incidents = incident_rows[:25]
    repeat_counts: dict[tuple[str, str, str], int] = {}
    for incident in incidents:
        target_type, target_label = _incident_target(incident)
        signature = (incident.type, target_type, target_label)
        repeat_counts[signature] = repeat_counts.get(signature, 0) + 1

    priority_investigations = []
    for incident in incidents:
        target_type, target_label = _incident_target(incident)
        signature = (incident.type, target_type, target_label)
        repeat_count = repeat_counts.get(signature, 1)
        tags = []
        if incident.status == "open":
            tags.append("new" if incident.detected_at and incident.detected_at >= now - timedelta(hours=6) else "open")
        if repeat_count > 1:
            tags.append("repeated")
        if incident.device_id or incident.user_id:
            tags.append("linked")
        if incident.severity in {"critical", "high"} and repeat_count > 1:
            tags.append("escalating")
        priority_investigations.append(
            {
                "id": incident.id,
                "title": incident.type,
                "severity": incident.severity,
                "status": incident.status,
                "target_type": target_type,
                "target_label": target_label,
                "time": _humanize_age(incident.detected_at, now),
                "repeat_count": repeat_count,
                "state_tags": tags or ["observed"],
                "detected_at": incident.detected_at or datetime.min.replace(tzinfo=timezone.utc),
            }
        )

    priority_investigations.sort(
        key=lambda item: (
            0 if item["status"] == "open" else 1,
            SEVERITY_ORDER.get(item["severity"], 99),
            -(item["repeat_count"]),
            -(item["detected_at"].timestamp() if item["detected_at"] else 0),
        )
    )
    priority_investigations = priority_investigations[:8]

    recent_incidents = [
        {
            "id": i.id,
            "title": i.type,
            "severity": i.severity,
            "time": _format_time(i.detected_at),
        }
        for i in incident_rows[:5]
    ]

    action_counts_result = await db.execute(
        select(
            BlockingRule.action,
            func.coalesce(func.sum(BlockingRule.hits), 0).label("hits"),
        )
        .group_by(BlockingRule.action)
    )
    action_hits = {row[0]: row[1] or 0 for row in action_counts_result.fetchall()}
    top_rule_result = await db.execute(
        select(BlockingRule)
        .order_by(BlockingRule.hits.desc(), BlockingRule.created_at.desc())
        .limit(1)
    )
    top_rule = top_rule_result.scalar_one_or_none()
    noisiest_source_result = await db.execute(
        select(BlockedIP).order_by(BlockedIP.hits.desc(), BlockedIP.blocked_at.desc()).limit(1)
    )
    noisiest_source = noisiest_source_result.scalar_one_or_none()
    current_reason_counts: dict[str, int] = {}
    previous_reason_counts: dict[str, int] = {}
    for incident in incident_rows:
        if incident.detected_at and incident.detected_at >= since:
            current_reason_counts[incident.type] = current_reason_counts.get(incident.type, 0) + 1
        else:
            previous_reason_counts[incident.type] = previous_reason_counts.get(incident.type, 0) + 1
    fastest_reason = None
    fastest_delta = None
    for reason, count in current_reason_counts.items():
        delta = _safe_ratio(count, previous_reason_counts.get(reason, 0))
        if fastest_delta is None or delta > fastest_delta:
            fastest_reason = reason
            fastest_delta = delta
    enforcement_pressure = {
        "totals": {
            "blocked": int((action_hits.get("block", 0) or 0) + blocked_attempts),
            "challenged": int(action_hits.get("challenge", 0) or 0),
            "rate_limited": int(action_hits.get("rate_limit", 0) or 0),
            "observed": int(total_detected),
        },
        "summaries": [
            {
                "label": "Top Rule",
                "value": (
                    f"{top_rule.reason or top_rule.type} ({top_rule.hits} hits)"
                    if top_rule else "No active rules"
                ),
            },
            {
                "label": "Noisiest Source",
                "value": (
                    f"{noisiest_source.ip} ({noisiest_source.hits} hits)"
                    if noisiest_source else "No blocked IPs"
                ),
            },
            {
                "label": "Fastest Reason",
                "value": (
                    f"{fastest_reason} ({fastest_delta:+d}%)"
                    if fastest_reason is not None and fastest_delta is not None
                    else "No growth signal"
                ),
            },
        ],
    }

    for item in priority_investigations:
        item.pop("detected_at", None)

    open_flags_count = (
        select(func.count())
        .select_from(AnomalyFlag)
        .where(
            AnomalyFlag.external_user_id == UserProfile.external_user_id,
            AnomalyFlag.status == "open",
        )
        .correlate(UserProfile)
        .scalar_subquery()
    )
    top_flag = (
        select(AnomalyFlag.flag_type)
        .where(
            AnomalyFlag.external_user_id == UserProfile.external_user_id,
            AnomalyFlag.status == "open",
        )
        .order_by(
            case(
                (AnomalyFlag.severity == "critical", 0),
                (AnomalyFlag.severity == "high", 1),
                (AnomalyFlag.severity == "medium", 2),
                else_=3,
            ),
            AnomalyFlag.detected_at.desc(),
        )
        .limit(1)
        .correlate(UserProfile)
        .scalar_subquery()
    )
    leaderboard_rows = (
        await db.execute(
            select(
                UserProfile,
                open_flags_count.label("open_flags_count"),
                top_flag.label("top_flag"),
            )
            .where(UserProfile.last_seen >= since)
            .order_by(
                UserProfile.current_risk_score.desc(),
                open_flags_count.desc(),
                UserProfile.last_seen.desc(),
            )
            .limit(5)
        )
    ).all()
    risk_leaderboard = [
        {
            "external_user_id": profile.external_user_id,
            "email": profile.email,
            "display_name": profile.display_name,
            "current_risk_score": profile.current_risk_score,
            "trust_level": profile.trust_level,
            "total_devices": profile.total_devices,
            "total_sessions": profile.total_sessions,
            "open_flags_count": int(flag_count or 0),
            "top_flag": flag_type,
            "last_seen": _isoformat(profile.last_seen),
            "last_country": profile.last_country,
            "enhanced_audit": profile.enhanced_audit,
        }
        for profile, flag_count, flag_type in leaderboard_rows
    ]
    gateway_dashboard = await summarize_gateway_dashboard(
        db,
        since=since,
        prev_since=prev_since,
    )

    return {
        "total_visitors": total_visitors,
        "unique_users": unique_users,
        "total_devices": total_devices,
        "total_blocked": total_blocked,
        "evasion_attempts": evasion_attempts,
        "spam_detected": spam_events,
        "visitors_change": visitors_change,
        "users_change": 0,
        "blocked_change": blocked_change,
        "traffic_heatmap": traffic_heatmap,
        "top_countries": top_countries,
        "blocking_chart": blocking_chart,
        "recent_incidents": recent_incidents,
        "threat_hotspots": threat_hotspots,
        "enforcement_pressure": enforcement_pressure,
        "gateway_dashboard": gateway_dashboard,
        "priority_investigations": priority_investigations,
        "risk_leaderboard": risk_leaderboard,
    }


@router.get("/realtime", response_model=RealtimeResponse)
async def realtime(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await get_realtime_snapshot(db)
