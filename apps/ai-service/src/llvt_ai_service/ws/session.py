"""WebSocket phiên dịch.

Tuần 1: chỉ thiết lập kênh + envelope và phản hồi trạng thái cơ bản để kiểm
tra kết nối. Pipeline VAD/ASR/MT/TTS sẽ được nối vào từ các tuần sau.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from llvt_ai_service.protocol import PipelineState, WsMessage, server_message

logger = logging.getLogger("llvt.ws")

router = APIRouter()


@router.websocket("/ws")
async def ws_session(ws: WebSocket) -> None:
    await ws.accept()
    # Báo cho client biết kênh đã sẵn sàng.
    await ws.send_json(server_message("state", state=PipelineState.idle.value).model_dump())

    try:
        while True:
            raw = await ws.receive_json()
            try:
                msg = WsMessage.model_validate(raw)
            except ValidationError as exc:
                await ws.send_json(
                    server_message("error", code="bad_message", message=str(exc)).model_dump()
                )
                continue

            await _handle(ws, msg)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")


async def _handle(ws: WebSocket, msg: WsMessage) -> None:
    """Router message tối thiểu cho Tuần 1."""
    if msg.type == "session.start":
        await ws.send_json(
            server_message("state", state=PipelineState.listening.value).model_dump()
        )
    elif msg.type == "session.stop":
        await ws.send_json(
            server_message("state", state=PipelineState.stopped.value).model_dump()
        )
    elif msg.type == "control.ptt":
        pressed = bool(msg.payload.get("pressed"))
        state = PipelineState.speech_detected if pressed else PipelineState.listening
        await ws.send_json(server_message("state", state=state.value).model_dump())
    elif msg.type == "audio.chunk":
        # Placeholder: các tuần sau đẩy chunk vào VAD/ASR.
        pass
    else:
        await ws.send_json(
            server_message(
                "error", code="unknown_type", message=f"Unsupported type: {msg.type}"
            ).model_dump()
        )
