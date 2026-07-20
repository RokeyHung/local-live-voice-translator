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
| Application | `application/` | Pipeline, ModelManager, SessionService, Container | ports, domain |
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

Khung đã đầy đủ; các adapter AI là **stub** (raise `NotImplementedError` với mốc
tuần). Hiện thực thật: VAD (Tuần 2), ASR (Tuần 3), MT (Tuần 4), TTS (Tuần 5),
SQLite repository (Tuần 6).
