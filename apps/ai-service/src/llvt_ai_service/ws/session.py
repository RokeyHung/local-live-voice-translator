"""WebSocket transport (mỏng): cầu nối message ↔ SessionController.

Không chứa logic nghiệp vụ — chỉ parse message, gọi controller và stream event.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from llvt_ai_service.application.container import Container
from llvt_ai_service.application.session_service import SessionController
from llvt_ai_service.domain import events as ev
from llvt_ai_service.domain.enums import PipelineState
from llvt_ai_service.ws.protocol import (
    WsMessage,
    event_to_wire,
    parse_audio_chunk,
    parse_session_config,
)

logger = logging.getLogger("llvt.ws")

router = APIRouter()


@router.websocket("/ws")
async def ws_session(ws: WebSocket) -> None:
    await ws.accept()
    container: Container = ws.app.state.container

    out_queue: asyncio.Queue[ev.PipelineEvent] = asyncio.Queue()

    async def emit(event: ev.PipelineEvent) -> None:
        await out_queue.put(event)

    controller = container.session_service.new_controller(emit)
    await emit(ev.StateChanged(PipelineState.idle))

    sender = asyncio.create_task(_pump(ws, out_queue))
    try:
        while True:
            raw = await ws.receive_json()
            await _dispatch(controller, raw, emit)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    finally:
        sender.cancel()


async def _pump(ws: WebSocket, queue: asyncio.Queue[ev.PipelineEvent]) -> None:
    """Đọc event từ queue và đẩy ra client (tách khỏi vòng nhận để stream song song)."""
    while True:
        event = await queue.get()
        await ws.send_json(event_to_wire(event))


async def _dispatch(controller: SessionController, raw: object, emit) -> None:
    try:
        msg = WsMessage.model_validate(raw)
    except ValidationError as exc:
        await emit(ev.PipelineError(code="bad_message", message=str(exc)))
        return

    if msg.type == "session.start":
        await controller.start(parse_session_config(msg.payload))
    elif msg.type == "session.stop":
        await controller.stop()
    elif msg.type == "control.ptt":
        await controller.on_ptt(bool(msg.payload.get("pressed")))
    elif msg.type == "audio.chunk":
        await controller.on_audio(parse_audio_chunk("", msg.payload))
    else:
        await emit(ev.PipelineError(code="unknown_type", message=f"Unsupported type: {msg.type}"))
