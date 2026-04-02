from sqlalchemy.ext.asyncio import AsyncSession

from .runtime_config import (
    DEFAULT_ANTI_EVASION_CONFIG,
    anti_evasion_settings_snapshot,
    load_anti_evasion_config as load_anti_evasion_config_from_store,
    update_anti_evasion_settings,
)


def get_anti_evasion_config() -> dict:
    return anti_evasion_settings_snapshot()


async def load_anti_evasion_config(db: AsyncSession) -> dict:
    return await load_anti_evasion_config_from_store(db)


async def update_anti_evasion_config(db: AsyncSession, data: dict) -> dict:
    return await update_anti_evasion_settings(db, data)
