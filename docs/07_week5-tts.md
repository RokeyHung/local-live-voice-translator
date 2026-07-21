# Tuần 5 — Module TTS (sherpa-onnx)

**Giai đoạn:** Tuần 5 (13/08 – 19/08)
**Mục tiêu tuần:** Tích hợp sherpa-onnx + voice model, tổng hợp giọng nói offline, speed control; (định tuyến ra loa/mic ảo thuộc phần desktop).
**Kết quả mong đợi (đề cương `00` §5):** TTS offline phát được audio đã dịch (âm thanh ra loa và microphone ảo là bước desktop sau).

> Phạm vi đợt này: **tổng hợp TTS phía AI service** (text đích → PCM). MT (Tuần 4) đã cho text đích; đợt này biến text → audio. **Phát ra loa + định tuyến BlackHole/VB-CABLE** là code native phía desktop → để tuần tích hợp (6/7), giống cách Tuần 2 hoãn thu system audio.

---

## 1. Kết quả đạt được

- **Adapter TTS sherpa-onnx thật** (`apps/ai-service/.../adapters/tts/sherpa_onnx.py`): `OfflineTts` (VITS/Piper) tổng hợp offline, trả **PCM signed 16-bit mono** kèm `sample_rate`, `duration_ms`.
- **Tự tải voice model** từ GitHub releases của k2-fsa (tag `tts-models`, tarball `.tar.bz2`) vào `~/.llvt/models/sherpa-tts/`, giải nén an toàn (`filter="data"`), tải vào `.tmp` rồi mới dùng.
- **Nạp lười theo ngôn ngữ**: voice chỉ tải + khởi tạo khi synthesize lần đầu cho ngôn ngữ đó (không tải cả 4 voice khi chỉ dùng 1–2); cache theo tên voice.
- **Pipeline hoàn chỉnh:** với chiều outgoing, luồng VAD→ASR→MT→**TTS** giờ chạy trọn vẹn tới `Completed` và phát `tts.audio` qua WS.
- **Kiểm thử thật (Piper en/vi):** tổng hợp ra audio thật (không phải im lặng):
  - `en` "This is a local text to speech test." → 1892 ms @ 22050 Hz, peak 0.61, rms 0.09
  - `vi` "Đây là bài kiểm tra tổng hợp giọng nói." → 1962 ms @ 22050 Hz, peak 0.65, rms 0.12

```mermaid
flowchart LR
    MT["mt.result (text đích)"] --> TTS["SherpaOnnxTts"]
    TTS -->|"nạp lười voice theo ngôn ngữ"| DL["_download_voice (k2-fsa release .tar.bz2)"]
    DL --> ENG["OfflineTts (VITS/Piper, ONNX Runtime)"]
    ENG -->|"float32 [-1,1]"| TTS
    TTS -->|"clip → int16 PCM (mono)"| WS["tts.audio { pcm, sampleRate, durationMs } → desktop"]
    WS -.->|"loa + BlackHole/VB-CABLE (desktop, tuần sau)"| MIC["Virtual mic → Google Meet"]
```

## 2. Ghi chú tích hợp sherpa-onnx

- Pin **`sherpa-onnx==1.10.46`**: wheel này **bundle sẵn** `libonnxruntime` + C-API dylib. Bản mới hơn (1.13.x) tham chiếu `libonnxruntime.1.27.0.dylib` không kèm trong wheel → `dlopen` lỗi trên macOS. Nếu nâng version phải kiểm tra lại dylib.
- Voice model của sherpa-onnx **không ở trên HF** (khác whisper.cpp/NLLB) → tự viết downloader (stdlib `urllib` + `tarfile`), không thêm dependency runtime.

## 3. Thiết kế adapter

| Vấn đề                 | Cách xử lý                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Voice theo ngôn ngữ    | `DEFAULT_VOICE` map `Language`→tên voice (SPEC 02 §8.2). `synthesize(voice=...)` cho phép override.                           |
| Nạp lười + cache       | `load()` là no-op; `_ensure_engine(voice)` tải + dựng `OfflineTts` lần đầu, cache theo tên voice; `unload()` xóa cache.       |
| Tải blocking           | `_download_voice` + `generate` chạy trong `SerialExecutor` (worker thread + lock) → an toàn khi nhiều pipeline dùng chung.    |
| Dựng config VITS/Piper | `_default_engine_loader` tự tìm `*.onnx`, `tokens.txt`, gắn `espeak-ng-data` (Piper) và `lexicon.txt` nếu có.                 |
| Đầu ra                 | float32 [-1,1] → `clip` → int16 PCM mono. `duration_ms` tính từ số mẫu / sample rate. Text rỗng → PCM rỗng, không gọi engine. |
| Speed control          | Truyền thẳng `speed` vào `engine.generate`.                                                                                   |
| Testability            | `engine_loader` + `downloader` tiêm được; mặc định `_default_engine_loader`/`_download_voice`.                                |

Adapter **là nơi duy nhất** biết sherpa-onnx; pipeline chỉ thấy port `TextToSpeechProvider`. Registry truyền `models_dir = ~/.llvt/models/sherpa-tts`.

## 4. Kiểm thử

`apps/ai-service/tests/test_tts.py` + cập nhật `test_vad.py`/`conftest.py` (36 pass, 3 skip toàn suite):

- **Logic adapter (engine + downloader giả, xác định):** float32→PCM16 đúng biên độ; chọn voice mặc định theo ngôn ngữ + override; forward `speed`; cache (tải một lần); text rỗng bỏ qua engine; `unload` xóa cache (tải lại).
- **`conftest.py` autouse:** thêm `_fake_tts_engine` (patch `_download_voice` + `_default_engine_loader`) để `TestClient`/pipeline **không tải voice thật**; bỏ qua khi `LLVT_RUN_TTS_INTEGRATION=1`.
- **`test_vad.py` WS contract cập nhật:** pipeline giờ chạy trọn vẹn → khẳng định thấy `asr.final`/`mt.result`/`tts.audio` tới `Completed` (trước đây là `error: not_implemented`).
- **Tích hợp thật (opt-in):** `LLVT_RUN_TTS_INTEGRATION=1` — tải voice Piper en/vi và tổng hợp thật, ghi WAV để nghe.

## 5. Còn nợ / đợt sau

- **Voice ja/zh:** `supertonic-3-ja` và `vits-piper-zh_CN-xiao_ya-medium` trong `DEFAULT_VOICE` cần đối chiếu lại với danh sách release hiện tại của k2-fsa (có thể thay bằng model đã xác nhận) — mới kiểm thử thật en/vi.
- **Phát audio + định tuyến (desktop):** phát `tts.audio` ra loa; đưa vào BlackHole (macOS)/VB-CABLE (Windows) để Google Meet nhận — tuần tích hợp desktop.
- **Hàng đợi phát + cancel** (đề cương §5 Tuần 5): quản lý hàng đợi TTS và hủy câu ở phía phát (desktop) / điều phối phiên.
- Cân nhắc `provider="coreml"` trên Apple Silicon để tăng tốc; hiện dùng `cpu` cho ổn định/di động.
