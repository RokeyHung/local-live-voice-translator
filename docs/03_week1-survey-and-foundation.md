# Tuần 1 — Khảo sát và chuẩn bị nền tảng

**Giai đoạn:** Tuần 1 (16/07 – 22/07)
**Mục tiêu tuần:** Tổng hợp yêu cầu, khảo sát giải pháp ASR/MT/TTS/VAD chạy local, chốt kiến trúc sơ bộ và quy ước giao tiếp, dựng môi trường phát triển chạy được trên cả Windows và macOS.
**Kết quả mong đợi:** Tài liệu khảo sát + kiến trúc sơ bộ (tài liệu này) và môi trường phát triển hai tiến trình hoạt động trên hai nền tảng.

Tài liệu này bám theo đề cương [`00_project-outline.md`](00_project-outline.md), SPEC [`01`](<01_SPEC: Real-Time Voice Translation Application Using Local AI Models.md>) và SPEC Addendum [`02`](<02_SPEC Addendum: Operating Systems, Technology Stack, and AI Models.md>).

---

## 1. Tổng hợp yêu cầu cốt lõi

| Nhóm | Yêu cầu rút gọn |
| ---- | --------------- |
| Chức năng | Thu microphone + system audio → VAD → ASR → MT → (Subtitle / TTS) → virtual microphone |
| Ngôn ngữ | 6 chiều: Việt ↔ Anh, Việt ↔ Nhật, Việt ↔ Trung (giản thể) |
| Nền tảng | Windows 11 x64; macOS 13+ Apple Silicon (arm64) |
| Riêng tư | Không cloud trong lúc phiên dịch; xử lý hoàn toàn local; không lưu audio mặc định |
| Độ trễ | "Gần thời gian thực" theo từng utterance; outgoing tổng ~≤4s, subtitle incoming ~≤3s (máy có GPU phù hợp) |
| Ổn định | Chạy liên tục ≥60 phút, không rò rỉ RAM, khôi phục pipeline độc lập |
| Kiến trúc | 2 tiến trình: Electron desktop client + Python local AI service, giao tiếp REST + WebSocket qua `127.0.0.1` |

---

## 2. Khảo sát giải pháp theo từng thành phần

### 2.1. Voice Activity Detection (VAD)

| Giải pháp | Ưu điểm | Hạn chế | Kết luận |
| --------- | ------- | ------- | -------- |
| **Silero VAD** | Nhẹ, chính xác cao, đa ngôn ngữ, chạy CPU tốt, ONNX/PyTorch | Cần load model nhỏ | **Chọn làm mặc định** |
| WebRTC VAD | Cực nhẹ, latency ~0 | Chỉ dựa trên năng lượng, dễ nhầm tiếng ồn | Dùng làm energy gate / fallback |

> Quyết định: **Silero VAD** là bộ phát hiện chính; WebRTC VAD làm cổng năng lượng sơ bộ và fallback khi Silero chưa load được.

### 2.2. Automatic Speech Recognition (ASR)

| Runtime | Nền tảng mạnh | Ghi chú |
| ------- | ------------- | ------- |
| **whisper.cpp** | Windows (CPU/CUDA/Vulkan), macOS (Metal/CoreML) | Chạy chung một runtime cho cả 2 OS, hỗ trợ model quantized, C API dễ nhúng → **runtime mặc định** |
| faster-whisper (CTranslate2) | Windows + NVIDIA CUDA | Backend tăng tốc tùy chọn (giai đoạn tối ưu) |
| MLX Whisper | macOS Apple Silicon | Backend tối ưu tùy chọn cho Apple Silicon |

**Model mặc định:** Whisper `large-v3-turbo` quantized **Q5** (preset Balanced). Chỉ dùng task `transcribe` (không dùng `translate` của Whisper) rồi chuyển text sang module dịch riêng. Ngôn ngữ đầu vào truyền tường minh: `vi`, `en`, `ja`, `zh`.

### 2.3. Machine Translation (MT)

| Model | Ưu điểm | Hạn chế | Kết luận |
| ----- | ------- | ------- | -------- |
| **NLLB-200 distilled 600M** | Bao phủ 4 ngôn ngữ mục tiêu, dịch câu/đoạn ngắn ổn định, nhẹ | Giấy phép CC-BY-NC-4.0 (phi thương mại), yếu với văn bản dài | **Mặc định** cho Fast/Balanced |
| Qwen3-4B-Instruct | Dịch tự nhiên, tận dụng ngữ cảnh | Generative → nguy cơ thêm/bớt nội dung, tốn RAM/VRAM, độ trễ cao | Tùy chọn cho preset Quality |

Mã ngôn ngữ NLLB: `vie_Latn`, `eng_Latn`, `jpn_Jpan`, `zho_Hans`. Chỉ dịch trên transcript **final** (không dịch partial liên tục).

### 2.4. Text-to-Speech (TTS)

Runtime: **sherpa-onnx** (offline, ONNX, đa nền tảng, một runtime chung để giảm dependency native).

| Ngôn ngữ | Voice model đề xuất |
| -------- | ------------------- |
| Việt | `vits-piper-vi_VN-vais1000-medium` |
| Anh | `vits-piper-en_US-lessac-medium` |
| Nhật | `supertonic-3-ja` |
| Trung | `vits-piper-zh_CN-xiao_ya-medium` |

> Lưu ý: kiểm tra giấy phép từng voice model trước khi đóng gói phân phối (runtime và voice có thể khác license).

### 2.5. Thu và định tuyến âm thanh theo nền tảng

| Chức năng | Windows 11 x64 | macOS 13+ (Apple Silicon) |
| --------- | -------------- | ------------------------- |
| Thu microphone | WASAPI | CoreAudio |
| Thu system audio | **WASAPI Loopback** | **ScreenCaptureKit** (bật loại trừ audio của chính app) |
| Virtual microphone (đưa TTS vào Google Meet) | **VB-CABLE** | **BlackHole 2ch** |
| Quyền cần xin | — | Microphone + Screen & System Audio Recording |

Logic đặc thù OS phải nằm sau abstraction layer (`AudioCaptureAdapter` / `AudioOutputAdapter` / `AudioDeviceManager`), Electron không phụ thuộc trực tiếp API của OS.

---

## 3. Kiến trúc sơ bộ

### 3.1. Hai tiến trình

```text
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ Electron Desktop Client       │  REST  │ Python Local AI Service       │
│ React + TS + Tailwind         │◀──────▶│ FastAPI + SQLite              │
│ Zustand + TanStack Query      │   WS   │ VAD · ASR · MT · TTS          │
│ Audio abstraction (native)    │◀──────▶│ Model manager · Metrics       │
└──────────────────────────────┘  127.0.0.1 (localhost-only)            
```

- **Desktop client:** UI, chọn thiết bị, điều khiển phiên, subtitle, lịch sử, phát audio ra output device, thu/định tuyến audio native.
- **AI service:** VAD, ASR, MT, TTS, model manager, hàng đợi, đo latency + tài nguyên, lưu lịch sử. Chỉ bind `127.0.0.1`, không mở ra LAN/Internet.

### 3.2. Provider abstraction (đổi model/runtime không ảnh hưởng pipeline)

```text
VoiceActivityDetectionProvider ── SileroVadProvider (+ WebRTC gate)
SpeechToTextProvider ─────────── WhisperCppProvider [MVP] · FasterWhisperProvider · MLXWhisperProvider
TranslationProvider ──────────── NLLBProvider [MVP] · QwenTranslationProvider
TextToSpeechProvider ─────────── SherpaOnnxProvider [MVP]
```

MVP bắt buộc hoàn thiện các provider `[MVP]`; các provider còn lại thuộc giai đoạn tối ưu.

### 3.3. Vòng đời utterance

```text
Idle → Listening → SpeechDetected → Recognizing → Translating
     → (WaitingForConfirmation) → Synthesizing → Queued → Speaking → Completed
                                                                   ↘ Error / Stopped
```

Mỗi utterance có `id` duy nhất, không xử lý trùng, theo dõi xuyên suốt Audio → ASR → MT → TTS → Output.

---

## 4. Quy ước giao tiếp (Communication Contract)

Định nghĩa dùng chung giữa hai tiến trình. Bản Pydantic: `apps/ai-service/src/llvt_ai_service/protocol.py`; bản TypeScript mirror: `apps/desktop/src/renderer/src/api/protocol.ts`.

### 4.1. REST (cấu hình / model / lịch sử)

| Method | Path | Mục đích |
| ------ | ---- | -------- |
| GET | `/health` | Trạng thái service, version, `offlineReady`, platform |
| GET | `/api/config` | Lấy cấu hình hiện tại |
| PUT | `/api/config` | Cập nhật cấu hình (ngôn ngữ, preset, thiết bị) |
| GET | `/api/models` | Danh sách model + trạng thái cài đặt |
| GET | `/api/sessions` | Lịch sử phiên |
| DELETE | `/api/sessions/{id}` | Xóa phiên |

### 4.2. WebSocket `/ws` — envelope chung

Mọi message là JSON có `type`, `ts` (epoch ms) và `payload`:

```json
{ "type": "asr.partial", "ts": 1721500000000, "payload": { "utteranceId": "…", "text": "…" } }
```

| Hướng | `type` | payload chính |
| ----- | ------ | ------------- |
| Client→Service | `session.start` | mode, incoming/outgoing language, preset |
| Client→Service | `session.stop` | — |
| Client→Service | `audio.chunk` | source (`microphone`/`system`), pcm base64, seq |
| Client→Service | `control.ptt` | pressed (bool) |
| Service→Client | `state` | utteranceId, state |
| Service→Client | `asr.partial` / `asr.final` | utteranceId, language, text, confidence |
| Service→Client | `mt.result` | utteranceId, sourceText, translatedText |
| Service→Client | `tts.audio` | requestId, pcm base64, sampleRate |
| Service→Client | `metrics` | asrMs, mtMs, ttsMs, cpu, ram, gpu, vram |
| Service→Client | `error` | code, message, utteranceId? |

Audio format nội bộ ASR: PCM signed 16-bit, mono, 16 kHz, frame 20–100 ms. Module audio tự resample về định dạng model yêu cầu.

---

## 5. Cấu trúc repository

```text
local-live-voice-translator/
├── docs/                     # đề cương, SPEC, tài liệu tuần
├── apps/
│   ├── desktop/              # Electron + React + TS + Vite + Tailwind
│   └── ai-service/           # Python + FastAPI + WebSocket + SQLite
├── README.md
└── .gitignore
```

---

## 6. Môi trường phát triển (hai nền tảng)

**Yêu cầu chung:** Node ≥ 20, Python 3.11/3.12 (đã kiểm thử chạy được trên 3.13), `uv` (hoặc `venv`+`pip`).

**AI service:**
```bash
cd apps/ai-service
uv sync                      # hoặc: python3 -m venv .venv && pip install -e .
uv run llvt-ai-service       # hoặc: uvicorn app.main:app --host 127.0.0.1 --port 8756
```

**Desktop client:**
```bash
cd apps/desktop
npm install
npm run dev                  # Vite + Electron
```

**Thiết bị âm thanh ảo (thủ công một lần):** cài VB-CABLE (Windows) hoặc BlackHole 2ch (macOS); cấu hình Google Meet dùng thiết bị ảo làm microphone. Chi tiết ở SPEC 02 §12.

Khi service chạy, mở `http://127.0.0.1:8756/health` phải trả `{"status":"ok", ...}`; desktop client hiển thị trạng thái kết nối REST + WS là *Connected*.

---

## 7. Rủi ro & bước tiếp theo (Tuần 2)

- **Rủi ro:** khác biệt audio loopback/virtual device giữa 2 OS; độ trễ trên CPU-only; giấy phép voice model.
- **Tuần 2 — Audio Capture & VAD:** thu microphone + system audio (WASAPI Loopback / ScreenCaptureKit), chuẩn hóa PCM 16 kHz mono, buffering, tích hợp Silero VAD, phân đoạn utterance + timestamp, gắn nhãn nguồn audio.
