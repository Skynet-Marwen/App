import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ...core.database import AsyncSessionLocal
from ...services.overview_realtime import authenticate_realtime_socket, get_realtime_snapshot

router = APIRouter(prefix="/stats", tags=["stats"])

SOCKET_PUSH_INTERVAL_SEC = 5


@router.websocket("/realtime/ws")
async def realtime_socket(websocket: WebSocket):
    await authenticate_realtime_socket(websocket)
    await websocket.accept()
    try:
        while True:
            async with AsyncSessionLocal() as db:
                payload = await get_realtime_snapshot(db)
            await websocket.send_json({"type": "realtime", "data": payload})
            await asyncio.sleep(SOCKET_PUSH_INTERVAL_SEC)
    except WebSocketDisconnect:
        return
