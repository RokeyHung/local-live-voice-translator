# Local Live Voice Translator

Ứng dụng desktop dịch giọng nói **gần thời gian thực**, chạy hoàn toàn bằng mô hình AI **cục bộ** (không dùng cloud khi phiên dịch). Hỗ trợ dịch hai chiều Việt ↔ Anh / Nhật / Trung trong các cuộc họp trực tuyến (Google Meet…), trên **Windows 11 x64** và **macOS 13+ Apple Silicon**.

Pipeline: `Audio → VAD (Silero) → ASR (whisper.cpp) → MT (NLLB-200) → TTS (sherpa-onnx) → Virtual Mic`.

> Tài liệu: [đề cương](docs/00_project-outline.md) · [SPEC](docs/01_spec-realtime-voice-translation.md) · [SPEC Addendum](docs/02_spec-addendum-os-stack-models.md) · ghi chú từng tuần: [T1](docs/03_week1-survey-and-foundation.md) · [T2](docs/04_week2-audio-capture-and-vad.md) · [T3](docs/05_week3-asr.md) · [T4](docs/06_week4-mt.md) · [T5](docs/07_week5-tts.md) · [T6](docs/08_week6-desktop.md) · [T7](docs/09_week7-two-way.md) · [T8](docs/10_week8-experiments.md)

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

Service **không nạp model lúc khởi động** (mở trong ~0,4 giây). Model vào bộ nhớ khi bấm **Khởi động model** ở màn Quản lý model, khi bắt đầu một phiên, hoặc khi chạy đo độ trễ. Muốn nạp sẵn như trước (chạy tự động, đo benchmark): `LLVT_PRELOAD_MODELS=true`.

**2. Desktop client** (Node ≥ 20):

```bash
cd apps/desktop
npm install
npm run dev
```

Cửa sổ Electron sẽ hiển thị trạng thái kết nối REST + WebSocket tới AI service.

## Dữ liệu trên máy

| Đường dẫn            | Nội dung                                                  | Đổi bằng          |
| -------------------- | --------------------------------------------------------- | ----------------- |
| `~/.llvt/models/`    | Model đã tải (whisper.cpp, NLLB, voice TTS, Kokoro tiếng Nhật) | `LLVT_MODELS_DIR` |
| `~/.llvt/history.db` | Lịch sử phiên: câu gốc, bản dịch, độ trễ                  | `LLVT_DB_PATH`    |
| `~/.llvt/settings.json` | Tuỳ chọn đổi trong app (thư mục lưu model)             | —                 |

Không lưu file âm thanh. Tắt lưu lịch sử ở màn **Cài đặt → Quyền riêng tư** (hoặc `LLVT_HISTORY_ENABLED=false`); xóa từng phiên hoặc xóa tất cả ở màn **Lịch sử**.

Đổi chỗ lưu model ở màn **Cài đặt → Thư mục lưu model** (model đã tải không tự chuyển sang chỗ mới). Đặt `LLVT_MODELS_DIR` thì biến môi trường thắng và giao diện khoá ô này lại.

## Trạng thái

Pipeline chạy **model thật** đầy đủ: VAD (Tuần 2) → ASR (Tuần 3) → MT (Tuần 4) → TTS (Tuần 5), giao diện desktop 8 màn (Tuần 6), dịch hai chiều + microphone ảo + thu âm thanh hệ thống (Tuần 7), đo độ trễ/tài nguyên/độ chính xác (Tuần 8), lịch sử phiên lưu SQLite, TTS đủ bốn ngôn ngữ (tiếng Nhật dùng Kokoro + G2P OpenJTalk vì sherpa-onnx không đọc được tiếng Nhật).

Còn lại: chạy thử thật trong Google Meet và trên Windows 11, và Tuần 9 (báo cáo, đóng gói, video demo).
