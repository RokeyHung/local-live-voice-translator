# Local Live Voice Translator

Ứng dụng desktop dịch giọng nói **gần thời gian thực**, chạy hoàn toàn bằng mô hình AI **cục bộ** (không dùng cloud khi phiên dịch). Hỗ trợ dịch hai chiều Việt ↔ Anh / Nhật / Trung trong các cuộc họp trực tuyến (Google Meet…), trên **Windows 11 x64** và **macOS 13+ Apple Silicon**.

Pipeline: `Audio → VAD (Silero) → ASR (whisper.cpp) → MT (NLLB-200) → TTS (sherpa-onnx) → Virtual Mic`.

> Tài liệu: [đề cương](docs/00_project-outline.md) · [SPEC](docs/01_spec-realtime-voice-translation.md) · [SPEC Addendum](docs/02_spec-addendum-os-stack-models.md) · [Khảo sát & nền tảng (Tuần 1)](docs/03_week1-survey-and-foundation.md)

## Cấu trúc

```text
apps/
├── desktop/      # Electron + React + TypeScript + Vite + Tailwind (client)
└── ai-service/   # Python + FastAPI + WebSocket + SQLite (local AI service)
```

Hai tiến trình giao tiếp qua REST + WebSocket trên `127.0.0.1` (chỉ localhost).

## Bắt đầu nhanh (Makefile)

Cách nhanh nhất — cần `uv` và `npm` trên PATH (nếu vừa cài uv: `source "$HOME/.local/bin/env"` hoặc mở lại terminal):

```bash
make setup     # cài phụ thuộc cho cả hai app (lần đầu)
make dev       # chạy đồng thời AI service + desktop (Ctrl+C dừng cả hai)
```

Các lệnh khác: `make help` để xem đầy đủ.

| Lệnh                            | Tác dụng                              |
| ------------------------------- | ------------------------------------- |
| `make setup`                    | Cài phụ thuộc (uv sync + npm install) |
| `make dev`                      | Chạy AI service + desktop cùng lúc    |
| `make service` / `make desktop` | Chạy riêng từng phần                  |
| `make build`                    | Typecheck + build desktop             |
| `make test`                     | Chạy pytest cho AI service            |
| `make lint` / `make format`     | Lint / format cả hai app              |
| `make health`                   | Gọi thử `GET /health`                 |
| `make clean`                    | Xóa venv, node_modules, build output  |

## Chạy thủ công

**1. Local AI service** (Python 3.11/3.12, đã chạy được trên 3.13):

```bash
cd apps/ai-service
uv sync && uv run llvt-ai-service
# hoặc không dùng uv:
# python3 -m venv .venv && source .venv/bin/activate && pip install -e . && llvt-ai-service
```

Kiểm tra: mở http://127.0.0.1:8756/health → `{"status":"ok", ...}`.

**2. Desktop client** (Node ≥ 20):

```bash
cd apps/desktop
npm install
npm run dev
```

Cửa sổ Electron sẽ hiển thị trạng thái kết nối REST + WebSocket tới AI service.

## Trạng thái

Đang ở **Tuần 1 — Khảo sát và chuẩn bị nền tảng**: đã dựng khung hai tiến trình, quy ước giao tiếp REST/WS và UI kiểm tra kết nối. Pipeline AI (VAD/ASR/MT/TTS) sẽ được hiện thực từ Tuần 2.
