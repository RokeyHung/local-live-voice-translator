# Tuần 2 — Audio Capture & VAD

**Giai đoạn:** Tuần 2 (23/07 – 29/07)
**Mục tiêu tuần:** Thu microphone ổn định, chuẩn hóa PCM 16 kHz mono, tích hợp Silero VAD và phân đoạn utterance có timestamp.
**Kết quả mong đợi (đề cương `00` §5):** Nguồn audio được thu ổn định; utterance được phân đoạn và gắn timestamp.

> Phạm vi đợt này: **microphone (outgoing)** + **Silero VAD server-side**. Thu **system audio** (WASAPI Loopback / ScreenCaptureKit) cần code native theo OS và không kiểm thử được trên máy dev hiện tại → để đợt sau.

---

## 1. Kết quả đạt được

- **Silero VAD adapter** (`apps/ai-service/.../adapters/vad/silero.py`) chạy thật (gói `silero-vad`, backend torch), cắt utterance kèm timestamp.
- **Thu microphone** ở desktop qua WebAudio → PCM signed 16-bit, mono, **16 kHz** → gửi `audio.chunk` qua WebSocket.
- Luồng `mic → audio.chunk → VAD → utterance → pipeline` đã thông (kiểm chứng bằng test WS).

## 2. Kiến trúc VAD: tách "model" khỏi "state theo luồng"

`ProviderSet` (gồm 1 `SileroVad`) dùng chung cho mọi kết nối, trong khi VAD có **state theo từng luồng** (buffer + hidden-state RNN của Silero). Nếu hai pipeline incoming/outgoing dùng chung một VAD → hỏng state.

Giải pháp — port VAD tách hai vai:

| Khái niệm                          | Vai trò                                           | Vòng đời                   |
| ---------------------------------- | ------------------------------------------------- | -------------------------- |
| `VoiceActivityDetector` (Provider) | `load()`/`unload()` model                         | 1 lần, dùng chung          |
| `VadStream`                        | `accept()`/`reset()` — buffer + trạng thái speech | 1 stream/nguồn audio/phiên |

`TranslationPipeline` mở `vad.open_stream()` riêng trong `__init__`, nên mic và system (và nhiều phiên) không đụng state của nhau.

## 3. Thuật toán phân đoạn (`SileroVadStream`)

- Gói PCM đến (khung 20–100 ms) thành **cửa sổ 512 mẫu** (yêu cầu của Silero ở 16 kHz); phần dư giữ ở `pending` cho lần sau.
- Bọc `VADIterator` của Silero (đã lo hysteresis + `min_silence` + `speech_pad`); nhận event `{'start'}`/`{'end'}` theo chỉ số mẫu tuyệt đối.
- Giữ audio để **cắt đúng đoạn** `[start, end]`, tính `started_at_ms`/`ended_at_ms` theo offset mẫu (xác định, dễ test).
- Bổ sung: **ép cắt** khi câu vượt `max_speech_ms`; **bỏ đoạn** ngắn hơn `min_speech_ms`; trim audio cũ khi rảnh (chỉ giữ đuôi đủ `speech_pad`).
- Tham số `VadParams`: `threshold=0.5`, `min_silence_ms=300`, `speech_pad_ms=120`, `min_speech_ms=250`, `max_speech_ms=20000`.

## 4. Thu microphone (desktop)

- Port `AudioCapture` (`ports/audio-capture.ts`) — application/UI không phụ thuộc WebAudio.
- Adapter `MicCapture` (`adapters/mic-capture.ts`): `getUserMedia` (mono, AEC/NS/AGC) → `AudioContext({ sampleRate: 16000 })` (ép sample rate, **không cần resample thủ công**) → `AudioWorklet` gom khung ~100 ms, Float32 → Int16, chuyển về renderer.
- `SessionController` base64-hóa Int16 và gửi `audio.chunk { source, pcm, seq, sampleRate }`. Main process cấp quyền `media` cho `getUserMedia` (macOS: `askForMediaAccess`).
- Mặc định Tuần 2: `session.start` kèm chiều outgoing `vi→en` để AI service tạo pipeline chạy VAD (chọn ngôn ngữ trong UI thuộc giai đoạn sau).

## 5. Kiểm thử

`apps/ai-service/tests/test_vad.py` (12/12 pass toàn suite):

- Logic phân đoạn qua **iterator giả** (xác định): cắt đúng lát + timestamp; bỏ đoạn ngắn; ép cắt `max_speech`; gộp khung lệch nửa cửa sổ; sai sample rate → `ValueError`.
- **Tích hợp Silero thật**: tín hiệu giọng-tổng-hợp offline (harmonic + AM envelope) → có segment ~1 s; im lặng → rỗng.
- **Contract WS**: `audio.chunk` giọng nói → VAD cắt segment → pipeline chạy tới ASR stub (`error: not_implemented`), chứng minh luồng thông.

## 6. Còn nợ (đợt sau)

- Thu **system audio**: macOS `getDisplayMedia`/ScreenCaptureKit (loại trừ audio của app), Windows WASAPI Loopback (native) — sau abstraction layer, không để Electron phụ thuộc trực tiếp API OS.
- WebRTC VAD làm energy-gate/fallback (theo khảo sát Tuần 1).
- Đo/hiển thị mức âm lượng realtime; xử lý mất/đổi thiết bị.
