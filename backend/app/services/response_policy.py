from __future__ import annotations

import ipaddress

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.blocking import BlockingRule

_ACTION_RANK = {"allow": 0, "observe": 0, "rate_limit": 1, "challenge": 2, "block": 3}


def action_rank(action: str | None) -> int:
    return _ACTION_RANK.get(str(action or "").strip().lower(), 0)


def strongest_action(*actions: str | None) -> str:
    normalized = [str(action or "allow").strip().lower() for action in actions if action is not None]
    if not normalized:
        return "allow"
    return max(normalized, key=action_rank)


def _match_ip_rule(rule_value: str, ip: str) -> bool:
    try:
        if "/" in rule_value:
            return ipaddress.ip_address(ip) in ipaddress.ip_network(rule_value, strict=False)
        return ipaddress.ip_address(ip) == ipaddress.ip_address(rule_value)
    except ValueError:
        return False


def _match_country_rule(rule_value: str, geo: dict | None) -> bool:
    geo = geo or {}
    wanted = rule_value.strip().lower()
    return wanted in {
        str(geo.get("country_code") or "").strip().lower(),
        str(geo.get("country") or "").strip().lower(),
    }


def _match_device_rule(rule_value: str, device) -> bool:
    if not device:
        return False
    wanted = rule_value.strip().lower()
    candidates = {
        str(getattr(device, "id", "") or "").strip().lower(),
        str(getattr(device, "fingerprint", "") or "").strip().lower(),
        str(getattr(device, "composite_fingerprint", "") or "").strip().lower(),
    }
    return wanted in candidates


def _match_user_agent_rule(rule_value: str, user_agent: str) -> bool:
    wanted = rule_value.strip().lower()
    return bool(wanted) and wanted in str(user_agent or "").lower()


def _match_asn_rule(rule_value: str, geo: dict | None) -> bool:
    geo = geo or {}
    wanted = rule_value.strip().lower()
    haystacks = [
        geo.get("isp"),
        geo.get("org"),
        geo.get("as"),
        geo.get("asn"),
    ]
    return any(wanted and wanted in str(value or "").lower() for value in haystacks)


def _rule_matches(rule: BlockingRule, *, ip: str, geo: dict | None, device, user_agent: str) -> bool:
    rule_type = str(rule.type or "").strip().lower()
    if rule_type == "ip":
        return _match_ip_rule(rule.value, ip)
    if rule_type == "country":
        return _match_country_rule(rule.value, geo)
    if rule_type == "device":
        return _match_device_rule(rule.value, device)
    if rule_type == "user_agent":
        return _match_user_agent_rule(rule.value, user_agent)
    if rule_type == "asn":
        return _match_asn_rule(rule.value, geo)
    return False


async def evaluate_response_rules(
    db: AsyncSession,
    *,
    ip: str,
    geo: dict | None,
    device,
    user_agent: str,
) -> dict | None:
    result = await db.execute(select(BlockingRule).order_by(BlockingRule.created_at.desc()))
    rules = result.scalars().all()
    matches = [
        rule for rule in rules if _rule_matches(rule, ip=ip, geo=geo, device=device, user_agent=user_agent)
    ]
    if not matches:
        return None

    chosen = max(matches, key=lambda rule: (action_rank(rule.action), rule.created_at))
    chosen.hits = int(chosen.hits or 0) + 1
    await db.flush()
    return {
        "action": str(chosen.action or "block"),
        "reason": "blocking_rule",
        "rule_id": chosen.id,
        "rule_type": chosen.type,
        "rule_value": chosen.value,
        "rule_reason": chosen.reason,
    }
