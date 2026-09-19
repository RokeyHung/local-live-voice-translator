# Local Live Voice Translator

Ứng dụng desktop dịch giọng nói **gần thời gian thực**, chạy hoàn toàn bằng mô hình AI **cục bộ** (không dùng cloud khi phiên dịch). Dịch hai chiều Việt ↔ Anh / Nhật / Trung: vừa nghe micro của bạn, vừa nghe âm thanh đang phát trên máy (cuộc gọi, video, bài giảng). Chạy trên **Windows 11 x64** và **macOS 13+ Apple Silicon**.

Pipeline: `Audio → VAD (Silero) → ASR (whisper.cpp) → MT (NLLB-200) → TTS (sherpa-onnx) → Loa`.

> **Hướng dẫn dùng:** [cài đặt](docs/09_huong-dan-cai-dat.md)
>
> **Phạm vi (chốt 10/09/2026):** ứng dụng dịch và phát ra loa/tai nghe, **không** đẩy tiếng dịch ngược vào phần mềm họp qua microphone ảo. Lý do bỏ phần đó: [docs/11](docs/11_pham-vi-da-bo-google-meet.md).
>
> **Tài liệu kỹ thuật** (`docs/`): [đề cương](docs/00_project-outline.md) · [SPEC](docs/01_spec-realtime-voice-translation.md) + [Addendum](docs/02_spec-addendum-os-stack-models.md) · [nhật ký tuần 1–8](docs/03_nhat-ky-tuan-1-8.md) · [các đợt bổ sung](docs/04_cac-dot-bo-sung.md) · [bộ đánh giá FLEURS](docs/05_bo-danh-gia-fleurs.md) · [bốn độ đo](docs/06_bon-do-do-wer-bleu-comet-rtf.md) · [kết quả chạy thử](docs/07_ket-qua-chay-thu-e2e.md) · [việc còn lại](docs/08_viec-con-lai.md) · [slides](docs/10_slides-bao-cao.md) · [biên bản họp](docs/meetings/) · [báo cáo gửi GVHD](docs/gvhd/)

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
make setup     # cài đầy đủ cho cả hai app (lần đầu) — thêm make setup-min nếu chỉ chạy app
make dev       # chạy đồng thời AI service + desktop (Ctrl+C dừng cả hai)
```

Các lệnh khác: `make help` để xem đầy đủ.

| Lệnh                            | Tác dụng                                   |
| ------------------------------- | ------------------------------------------ |
| `make setup`                    | Cài đầy đủ (lõi + eval + backend tuỳ chọn) |
| `make setup-min`                | Chỉ phụ thuộc để chạy app                  |
| `make dev`                      | Chạy AI service + desktop cùng lúc         |
| `make service` / `make desktop` | Chạy riêng từng phần                       |
| `make build`                    | Typecheck + build desktop                  |
| `make test`                     | Chạy pytest cho AI service                 |
| `make lint` / `make format`     | Lint / format cả hai app                   |
| `make health`                   | Gọi thử `GET /health`                      |
| `make bench`                    | Đo độ trễ từng khâu trên máy này           |
| `make accuracy`                 | Đo WER/chrF trên bộ câu kiểm thử           |
| `make soak MINUTES=60`          | Chạy liên tục kiểm tra ổn định             |
| `make segment MEDIA=x.mov`      | Cắt bản ghi dài thành bộ câu đo WER        |
| `make fetch-fleurs`             | Tải trước dữ liệu đánh giá FLEURS          |
| `make clean`                    | Xóa venv, node_modules, build output       |

`make bench` và `make soak` cần AI service **đang chạy** (`make service`) và model đã tải.

## Chạy thủ công

**1. Local AI service** (Python 3.11/3.12, đã chạy được trên 3.13):

```bash
cd apps/ai-service
uv sync && uv run llvt-ai-service
# hoặc không dùng uv:
# python3 -m venv .venv && source .venv/bin/activate && pip install -e . && llvt-ai-service
```

Kiểm tra: mở <http://127.0.0.1:8756/health> → `{"status":"ok", ...}`.

Service **không nạp model lúc khởi động** (mở trong ~0,4 giây). Model vào bộ nhớ khi bấm **Khởi động model** ở màn Quản lý model, khi bắt đầu một phiên, hoặc khi chạy đo độ trễ. Muốn nạp sẵn như trước (chạy tự động, đo benchmark): `LLVT_PRELOAD_MODELS=true`.

**2. Desktop client** (Node ≥ 20):

```bash
cd apps/desktop
npm install
npm run dev
```

Cửa sổ Electron sẽ hiển thị trạng thái kết nối REST + WebSocket tới AI service.

## Dữ liệu trên máy

| Đường dẫn               | Nội dung                                                       | Đổi bằng          |
| ----------------------- | -------------------------------------------------------------- | ----------------- |
| `~/.llvt/models/`       | Model đã tải (whisper.cpp, NLLB, voice TTS, Kokoro tiếng Nhật) | `LLVT_MODELS_DIR` |
| `~/.llvt/history.db`    | Lịch sử phiên: câu gốc, bản dịch, độ trễ                       | `LLVT_DB_PATH`    |
| `~/.llvt/settings.json` | Tuỳ chọn đổi trong app (thư mục lưu model)                     | —                 |
| `fleurs-cache/`         | Dữ liệu FLEURS cho bộ đánh giá (`make fetch-fleurs`, ~2,3 GB)  | `FLEURS_CACHE`    |

`fleurs-cache/` chỉ phục vụ bộ đánh giá ([docs/05](docs/05_bo-danh-gia-fleurs.md)), không liên quan tới lúc dùng app — xoá lúc nào cũng được, `make fetch-fleurs` tải lại.

Không lưu file âm thanh. Tắt lưu lịch sử ở màn **Cài đặt → Quyền riêng tư** (hoặc `LLVT_HISTORY_ENABLED=false`); xóa từng phiên hoặc xóa tất cả ở màn **Lịch sử**.

Đổi chỗ lưu model ở màn **Cài đặt → Thư mục lưu model** (model đã tải không tự chuyển sang chỗ mới). Đặt `LLVT_MODELS_DIR` thì biến môi trường thắng và giao diện khoá ô này lại.

## Trạng thái

Pipeline chạy **model thật** đầy đủ: VAD (Tuần 2) → ASR (Tuần 3) → MT (Tuần 4) → TTS (Tuần 5), giao diện desktop 8 màn (Tuần 6), dịch hai chiều + microphone ảo + thu âm thanh hệ thống (Tuần 7), đo độ trễ/tài nguyên/độ chính xác (Tuần 8), lịch sử phiên lưu SQLite, TTS đủ bốn ngôn ngữ (tiếng Nhật dùng Kokoro + G2P OpenJTalk vì sherpa-onnx không đọc được tiếng Nhật).

Đã có **bộ số đo trên FLEURS** (bộ dữ liệu chuẩn, tham chiếu do người gõ) — chi tiết ở [docs/05 mục 8](docs/05_bo-danh-gia-fleurs.md):

| Khâu                                | Kết quả                                               |
| ----------------------------------- | ----------------------------------------------------- |
| ASR (3.099 bản thu, 10,2 giờ audio) | vi WER 8,8% · en WER 4,8% · zh CER 8,1% · ja CER 4,7% |
| MT (2.022 cặp câu, 6 chiều)         | spBLEU 11,0–37,1 · COMET 0,773–0,853                  |
| Độ trễ cả chuỗi (50 mẫu × 6 chiều)  | RTF p90 **0,395–0,786** — dưới 1 ở mọi chiều          |

Còn lại: chạy thử thật trên Windows 11, thu bộ câu bằng giọng người thật để biết WER trong điều kiện họp thật cao hơn bao nhiêu, và Tuần 9 (báo cáo, đóng gói, video demo).
