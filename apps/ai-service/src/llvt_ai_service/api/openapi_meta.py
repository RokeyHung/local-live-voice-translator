"""Mô tả hiển thị trên Swagger UI.

Tách khỏi ``app.py`` để composition root gọn. Phần mô tả cố tình nói cả về
WebSocket: OpenAPI 3.x không mô tả được WS, mà /ws lại là giao diện chính của
service — thiếu nó thì trang tài liệu chỉ kể được nửa câu chuyện.
"""

from __future__ import annotations

DESCRIPTION = """
Dịch vụ AI cục bộ của **Local Live Voice Translator**.

Chạy toàn bộ pipeline trên máy người dùng: `Audio → VAD (Silero) → ASR
(whisper.cpp) → MT (NLLB-200) → TTS (sherpa-onnx)`. Service chỉ lắng nghe trên
`127.0.0.1`, không mở ra LAN/Internet, và không gửi dữ liệu nào ra ngoài.

## WebSocket `/ws` — giao diện chính

REST bên dưới chỉ để cấu hình và chẩn đoán. Luồng dịch thật chạy trên WebSocket,
mỗi kết nối là một phiên. OpenAPI không mô tả được WS nên contract ghi ở đây.

Envelope chung: `{ "type": string, "ts": number, "payload": object }`

**Client → server**

| type | payload | ý nghĩa |
| --- | --- | --- |
| `session.start` | `mode`, `preset`, `incomingSource/Target`, `outgoingSource/Target`, `title` | mở phiên, dựng pipeline cho từng chiều; `title` là tên phiên trong lịch sử |
| `session.stop` | — | đóng phiên |
| `audio.chunk` | `source` (`microphone`\\|`system`), `pcm` (base64 PCM16 mono 16 kHz), `seq`, `sampleRate` | đẩy một khung audio |
| `control.ptt` | `pressed` | giữ/nhả Push-to-talk; nhả thì chốt câu đang nói dở |
| `control.mute` | `muted` | tắt/bật mic; bật mute sẽ bỏ đoạn đang nói dở |

**Server → client**

| type | payload |
| --- | --- |
| `state` | `state` (Idle/Listening/Recognizing/Translating/Synthesizing/Completed/…), `utteranceId`, `sessionId` (chỉ ở mốc bắt đầu/kết thúc phiên) |
| `asr.partial` | `utteranceId`, `language`, `text` |
| `asr.final` | `utteranceId`, `language`, `text`, `confidence`, `processingMs` |
| `mt.result` | `utteranceId`, `sourceText`, `translatedText`, `processingMs` |
| `tts.audio` | `utteranceId`, `pcm` (base64), `sampleRate`, `durationMs` |
| `metrics` | `asrMs`, `mtMs`, `ttsMs` |
| `error` | `code`, `message`, `utteranceId` |

Ghi chú về hai chiều dịch: chiều **outgoing** (mic của người dùng) có tổng hợp
giọng và bị chặn bởi Push-to-talk; chiều **incoming** (âm thanh hệ thống, giọng
phía cuộc họp) chạy liên tục và **không** tổng hợp giọng — nếu tổng hợp thì bản
dịch sẽ nói đè lên người thật đang nói.
"""

TAGS_METADATA = [
    {
        "name": "system",
        "description": "Kiểm tra service sống và đọc thông tin phiên bản.",
    },
    {
        "name": "config",
        "description": (
            "Preset hiệu năng, thư mục lưu model và trạng thái model. `stages` lấy trực "
            "tiếp từ provider đang chạy nên luôn khớp với thứ service thật sự dùng; "
            "`stages` rỗng nghĩa là model chưa nạp (vừa đổi thư mục hoặc vừa xoá) và sẽ "
            "tự nạp lại ở phiên kế tiếp."
        ),
    },
    {
        "name": "diagnostics",
        "description": (
            "Đo độ trễ từng khâu và tài nguyên tiến trình. Dùng cho màn Chẩn đoán "
            "của ứng dụng desktop và cho phần thực nghiệm của báo cáo."
        ),
    },
    {
        "name": "sessions",
        "description": (
            "Lịch sử phiên: mỗi câu lưu kèm cặp ngôn ngữ, câu gốc, bản dịch, thời gian "
            "xử lý từng khâu và trạng thái. Dữ liệu nằm trong một file SQLite trên máy "
            "người dùng (`LLVT_DB_PATH`, xem `historyDbPath` ở `GET /api/config`); "
            "không lưu audio. Tắt lưu bằng `historyEnabled` thì chỉ ngừng ghi — đọc và "
            "xoá vẫn hoạt động."
        ),
    },
]
