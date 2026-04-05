from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ...models.device import Device
from .. import risk_engine
from .common import group_settings, severity_for_modifier, sync_group_flag
from .exact_device import summarize_exact_device
from .strict_group import summarize_strict_group
from .user_parent import summarize_user_parent


def _device_block_threshold() -> int:
    return 95


def apply_device_parent_score(
    device: Device,
    *,
    computed_score: int,
    enforce_block: bool,
) -> tuple[int, int, str]:
    previous_score = int(device.risk_score or 0)
    new_score = min(100, max(previous_score, computed_score))
    device.risk_score = new_score
    if enforce_block and new_score >= _device_block_threshold():
        device.status = "blocked"
    return previous_score, new_score, device.status


async def recompute_device_parent_posture(
    db: AsyncSession,
    device_id: str,
    site_id: str | None = None,
    trigger_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    device = await db.get(Device, device_id)
    if not device:
        return {"ok": False, "device_id": device_id, "reason": "not_found"}

    settings = group_settings()
    if not settings["enabled"]:
        return {
            "ok": True,
            "device_id": device.id,
            "previous_score": int(device.risk_score or 0),
            "new_score": int(device.risk_score or 0),
            "status": device.status,
            "modifier": 0.0,
            "external_user_id": device.owner_user_id if (device.shared_user_count or 0) == 0 else None,
        }

    exact_signal = await summarize_exact_device(db, device=device, site_id=site_id)
    strict_signal = await summarize_strict_group(db, device=device)
    modifier = min(float(exact_signal["modifier"]) + float(strict_signal["modifier"]), 1.0)
    computed_score = min(100, int(round(modifier * 100)))
    previous_score, new_score, status = apply_device_parent_score(
        device,
        computed_score=computed_score,
        enforce_block=bool(risk_engine.runtime_settings().get("risk_auto_block_enforced", True)),
    )

    external_user_id = device.owner_user_id if (device.shared_user_count or 0) == 0 else None
    if external_user_id:
        evidence = {
            "modifier": round(modifier, 4),
            "computed_score": computed_score,
            "trigger_context": trigger_context or {},
            "exact_device": exact_signal["evidence"],
            "strict_group": strict_signal["evidence"],
        }
        await sync_group_flag(
            db,
            external_user_id=external_user_id,
            flag_type="group_device_risk",
            should_open=modifier > 0,
            severity=severity_for_modifier(modifier),
            related_device_id=device.id,
            evidence=evidence,
        )
        await sync_group_flag(
            db,
            external_user_id=external_user_id,
            flag_type="coordinated_group_behavior",
            should_open=bool(exact_signal["coordinated"] or strict_signal["coordinated"]),
            severity=severity_for_modifier(max(exact_signal["modifier"], strict_signal["modifier"])),
            related_device_id=device.id,
            evidence=evidence,
        )
        await sync_group_flag(
            db,
            external_user_id=external_user_id,
            flag_type="repeated_group_spike",
            should_open=bool(exact_signal["repeated_spike"] or strict_signal["repeated_spike"]),
            severity=severity_for_modifier(max(exact_signal["modifier"], strict_signal["modifier"])),
            related_device_id=device.id,
            evidence=evidence,
        )

    return {
        "ok": True,
        "device_id": device.id,
        "previous_score": previous_score,
        "new_score": new_score,
        "status": status,
        "modifier": round(modifier, 4),
        "external_user_id": external_user_id,
        "evidence": {
            "exact_device": exact_signal["evidence"],
            "strict_group": strict_signal["evidence"],
        },
    }


async def recompute_user_parent_posture(
    db: AsyncSession,
    external_user_id: str,
    trigger_context: dict[str, Any] | None = None,
) -> tuple[float, float, str]:
    settings = group_settings()
    trigger_context = trigger_context or {}
    trigger_type = str(trigger_context.get("trigger_type") or "manual")

    if not settings["enabled"]:
        return await risk_engine.recompute(
            db,
            external_user_id,
            trigger_type=trigger_type,
            trigger_detail=trigger_context,
        )

    parent_signal = await summarize_user_parent(db, external_user_id=external_user_id)
    extra_modifiers = parent_signal["extra_modifiers"]
    base_evidence = {
        "trigger_context": trigger_context,
        "summary": parent_signal["evidence"],
        "extra_modifiers": extra_modifiers,
    }

    group_user_modifier = sum(
        float(extra_modifiers.get(key, 0.0))
        for key in ("group_user_risk", "strict_group_risky_siblings")
    )
    await sync_group_flag(
        db,
        external_user_id=external_user_id,
        flag_type="group_user_risk",
        should_open=group_user_modifier > 0,
        severity=severity_for_modifier(group_user_modifier),
        evidence=base_evidence,
    )
    await sync_group_flag(
        db,
        external_user_id=external_user_id,
        flag_type="coordinated_group_behavior",
        should_open="coordinated_group_behavior" in extra_modifiers,
        severity=severity_for_modifier(float(extra_modifiers.get("coordinated_group_behavior", 0.0))),
        evidence=base_evidence,
    )
    await sync_group_flag(
        db,
        external_user_id=external_user_id,
        flag_type="repeated_group_spike",
        should_open="repeated_group_spike" in extra_modifiers,
        severity=severity_for_modifier(float(extra_modifiers.get("repeated_group_spike", 0.0))),
        evidence=base_evidence,
    )

    return await risk_engine.recompute(
        db,
        external_user_id,
        trigger_type=trigger_type,
        trigger_detail=base_evidence,
        extra_modifiers=extra_modifiers,
    )
