# LLVT — Local AI Service

Dịch vụ AI cục bộ (FastAPI + WebSocket) cho Local Live Voice Translator. Đảm nhiệm VAD, ASR, MT, TTS, quản lý model, hàng đợi và metrics. **Chỉ bind `127.0.0.1`.**

Khởi tạo bằng `uv init --package`; quản lý phụ thuộc bằng `uv`.

## Chạy

```bash
uv sync
uv run llvt-ai-service
```

Mặc định: `http://127.0.0.1:8756`. Kiểm tra: `GET /health`.

## Cấu hình

Qua biến môi trường (prefix `LLVT_`) hoặc file `.env`:

| Biến                 | Mặc định    | Ý nghĩa                              |
| -------------------- | ----------- | ------------------------------------ |
| `LLVT_HOST`          | `127.0.0.1` | Địa chỉ bind (giữ loopback)          |
| `LLVT_PORT`          | `8756`      | Cổng                                 |
| `LLVT_OFFLINE_READY` | `true`      | Cờ offline-ready trả trong `/health` |

## Cấu trúc

```text
src/llvt_ai_service/
├── __init__.py       # entry point main() -> uvicorn
├── server.py         # FastAPI app + CORS + mount router
├── config.py         # cấu hình (pydantic-settings)
├── protocol.py       # contract REST/WS (đồng bộ với desktop protocol.ts)
├── api/health.py     # REST: /health
└── ws/session.py     # WebSocket: /ws (envelope + state)
```

Từ Tuần 2, các provider VAD/ASR/MT/TTS được nối vào `ws/session.py` sau abstraction layer.
