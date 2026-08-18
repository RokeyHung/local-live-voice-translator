# Kiến trúc AI Service — Hexagonal (Ports & Adapters)

Mục tiêu: đổi được model/runtime (whisper.cpp ↔ MLX, NLLB ↔ Qwen…) và test dễ mà
không sửa logic pipeline. Đạt được bằng cách cô lập nghiệp vụ khỏi hạ tầng.

## Quy tắc phụ thuộc

```
adapters ─▶ ports ◀─ application ─▶ domain
   (hạ tầng)  (interface)  (use-case)   (thuần)
      ▲                                    ▲
   transport (api, ws) ────────────────────┘
```

**Chiều phụ thuộc luôn hướng vào trong.** `domain` không import gì; `application`
chỉ biết `ports` + `domain`; `adapters` và `transport` là vòng ngoài, có thể thay.

## Các tầng

| Tầng | Thư mục | Vai trò | Được phép import |
| ---- | ------- | ------- | ---------------- |
| Domain | `domain/` | Model + enum + event thuần | (không gì) |
| Ports | `ports/` | Interface (ABC) cho VAD/ASR/MT/TTS/Repository | domain |
| Application | `application/` | Pipeline, ModelManager, SessionService, HistoryPolicy, Container | ports, domain |
| Adapters | `adapters/` | Hiện thực port: whisper.cpp, NLLB, sherpa-onnx, memory/SQLite | ports, domain |
| Config | `config/` | Settings + preset → chọn adapter/model | domain |
| Transport | `api/`, `ws/` | REST + WebSocket mỏng, gọi application | application, schemas |
| Schemas | `schemas.py`, `ws/protocol.py` | DTO/wire format (tách khỏi domain) | domain |

## Luồng runtime

1. `app.py` (lifespan) dựng `Container` = Settings + Repository + ModelManager + SessionService, gắn vào `app.state`.
2. `ModelManager.load_preset()` đọc `config/presets.py`, tra registry → tạo `ProviderSet` (vad/asr/mt/tts) và `load()`.
3. WebSocket `/ws` tạo `SessionController`; message → controller → `TranslationPipeline` (VAD→ASR→MT→TTS) → phát `PipelineEvent`.
4. `ws/protocol.py` dịch event → JSON gửi client. Model blocking chạy trong `SerialExecutor` (thread + lock).

## Thêm một backend mới (ví dụ MLX Whisper)

1. Tạo `adapters/asr/mlx_whisper.py` implement `SpeechToTextProvider`.
2. Đăng ký 1 dòng trong `application/model_manager.py` (`ASR_REGISTRY["mlx_whisper"] = ...`).
3. Trỏ preset tới adapter đó trong `config/presets.py`.

Không đụng `application/pipeline.py` hay transport. Đó là mục tiêu của kiến trúc này.

## Trạng thái hiện tại

Mọi adapter trong pipeline đã chạy model thật: VAD Silero (Tuần 2), ASR whisper.cpp
(Tuần 3), MT NLLB-200 (Tuần 4), TTS sherpa-onnx cho vi/en/zh (Tuần 5) và Kokoro +
G2P OpenJTalk cho tiếng Nhật (`adapters/tts/kokoro_ja.py`), lịch sử phiên trong SQLite
(`adapters/persistence/sqlite.py`, món nợ của Tuần 6). Còn **stub**:
`adapters/asr/faster_whisper.py` (thuộc giai đoạn tối ưu).

Khâu TTS chạy hai engine nên có `application/tts_router.py` (`LanguageRoutedTts`):
cũng hiện thực port `TextToSpeechProvider`, chọn engine theo ngôn ngữ đích. Pipeline
vẫn chỉ thấy một provider.

Ghi lịch sử đi qua `application/history.py` (`HistoryPolicy`) — một decorator hiện
thực chính port `SessionRepository`, cho phép tắt việc GHI mà vẫn đọc/xoá được, đúng
yêu cầu quyền riêng tư ở SPEC 14.4.
