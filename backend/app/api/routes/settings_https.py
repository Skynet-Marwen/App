from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...schemas.https_settings import SelfSignedCertificateRequest
from ...services.audit import log_action, request_ip
from ...services.https_assets import certificate_status, generate_self_signed_certificate, save_uploaded_certificate
from ...services.runtime_config import runtime_settings, save_runtime_settings_cache

router = APIRouter(prefix="/settings/https", tags=["settings-https"])

_settings = runtime_settings()


@router.get("/status")
async def https_status(_: User = Depends(get_current_user)):
    return certificate_status()


@router.post("/upload")
async def upload_https_certificate(
    request: Request,
    certificate: UploadFile = File(...),
    private_key: UploadFile = File(...),
    chain: UploadFile | None = File(default=None),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    try:
        uploaded = save_uploaded_certificate(
            cert_bytes=await certificate.read(),
            key_bytes=await private_key.read(),
            chain_bytes=await chain.read() if chain else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    _settings["https_certificate_strategy"] = "uploaded"
    _settings["https_uploaded_cert_path"] = uploaded["cert_path"]
    _settings["https_uploaded_key_path"] = uploaded["key_path"]
    await save_runtime_settings_cache(db)
    log_action(
        db,
        action="CONFIG_CHANGE",
        actor_id=current.id,
        target_type="settings",
        target_id="https-upload",
        ip=request_ip(request),
        extra={"updated_keys": ["https_certificate_strategy", "https_uploaded_cert_path", "https_uploaded_key_path"]},
    )
    await db.commit()
    return uploaded


@router.post("/self-signed")
async def create_self_signed_certificate(
    body: SelfSignedCertificateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    try:
        created = generate_self_signed_certificate(body.common_name, body.valid_days)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    _settings["https_certificate_strategy"] = "self_signed"
    _settings["https_self_signed_common_name"] = body.common_name
    _settings["https_self_signed_valid_days"] = body.valid_days
    await save_runtime_settings_cache(db)
    log_action(
        db,
        action="CONFIG_CHANGE",
        actor_id=current.id,
        target_type="settings",
        target_id="https-self-signed",
        ip=request_ip(request),
        extra={"updated_keys": ["https_certificate_strategy", "https_self_signed_common_name", "https_self_signed_valid_days"]},
    )
    await db.commit()
    return created
