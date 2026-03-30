from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.blocking import BlockingRule, BlockedIP
from ...schemas.blocking import CreateRuleRequest, BlockIPRequest
from ...services.audit import log_action, request_ip
import uuid

router = APIRouter(prefix="/blocking", tags=["blocking"])


@router.get("/rules")
async def list_rules(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(BlockingRule).order_by(BlockingRule.created_at.desc()))
    rules = result.scalars().all()
    return [
        {
            "id": r.id, "type": r.type, "value": r.value,
            "reason": r.reason, "action": r.action, "hits": r.hits,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M"),
        }
        for r in rules
    ]


@router.post("/rules")
async def create_rule(body: CreateRuleRequest, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    rule = BlockingRule(id=str(uuid.uuid4()), **body.model_dump())
    db.add(rule)
    log_action(db, action="CREATE_BLOCK_RULE", actor_id=current.id, target_type="blocking_rule", target_id=rule.id, ip=request_ip(request), extra={"type": rule.type, "action": rule.action})
    await db.commit()
    return {"id": rule.id, "message": "Rule created"}


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    r = await db.get(BlockingRule, rule_id)
    if not r:
        raise HTTPException(404, "Not found")
    log_action(db, action="DELETE_BLOCK_RULE", actor_id=current.id, target_type="blocking_rule", target_id=r.id, ip=request_ip(request))
    await db.delete(r)
    await db.commit()
    return {"message": "Deleted"}


@router.get("/ips")
async def list_blocked_ips(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    search: str = Query(""),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(BlockedIP)
    cq = select(func.count()).select_from(BlockedIP)
    if search:
        s = f"%{search}%"
        q = q.where(BlockedIP.ip.ilike(s))
        cq = cq.where(BlockedIP.ip.ilike(s))

    total = await db.scalar(cq) or 0
    result = await db.execute(q.order_by(BlockedIP.blocked_at.desc()).offset((page - 1) * page_size).limit(page_size))
    ips = result.scalars().all()
    return {
        "total": total,
        "items": [
            {
                "ip": i.ip, "country": i.country, "country_flag": i.country_flag,
                "reason": i.reason, "hits": i.hits,
                "blocked_at": i.blocked_at.strftime("%Y-%m-%d %H:%M"),
            }
            for i in ips
        ],
    }


@router.post("/ips")
async def block_ip(body: BlockIPRequest, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    existing = await db.get(BlockedIP, body.ip)
    if existing:
        raise HTTPException(409, "IP already blocked")
    ip = BlockedIP(ip=body.ip, reason=body.reason)
    db.add(ip)
    log_action(db, action="BLOCK_IP", actor_id=current.id, target_type="ip", target_id=body.ip, ip=request_ip(request), extra={"reason": body.reason})
    await db.commit()
    return {"message": "Blocked"}


@router.delete("/ips/{ip}")
async def unblock_ip(ip: str, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    i = await db.get(BlockedIP, ip)
    if not i:
        raise HTTPException(404, "Not found")
    log_action(db, action="UNBLOCK_IP", actor_id=current.id, target_type="ip", target_id=ip, ip=request_ip(request))
    await db.delete(i)
    await db.commit()
    return {"message": "Unblocked"}
