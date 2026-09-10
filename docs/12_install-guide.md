# Tài liệu cài đặt

Hướng dẫn cài và chạy ứng dụng từ mã nguồn, trên **macOS 13+ (Apple Silicon)** và
**Windows 11 x64**.

> **Phạm vi (chốt 10/09/2026):** ứng dụng dịch giọng nói và phát bản dịch ra loa/tai
> nghe. Phần đẩy tiếng dịch ngược vào Google Meet qua microphone ảo **đã bỏ**, nên
> không phải cài driver âm thanh ảo nào. Lý do bỏ ghi ở
> [`13_google-meet-and-virtual-mic.md`](13_google-meet-and-virtual-mic.md).

---

## 1. Yêu cầu

| Hạng mục      | Tối thiểu                                  | Ghi chú                                                                                               |
| ------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Hệ điều hành  | macOS 13+ (Apple Silicon) / Windows 11 x64 | Thu âm thanh hệ thống cần ScreenCaptureKit (macOS 13+) hoặc WASAPI loopback (Windows 10 1903+).       |
| RAM           | 8 GB, khuyến nghị 16 GB                    | Riêng tiến trình AI service chiếm ~2 GB khi đã nạp đủ model (đo ở [Tuần 8](10_week8-experiments.md)). |
| Ổ cứng trống  | ~5 GB                                      | Model chiếm ~4 GB; xem dung lượng thật ở màn **Quản lý model**.                                       |
| Python        | 3.11 hoặc 3.12                             | `uv` tự tải đúng bản, không cần cài Python sẵn.                                                       |
| Node.js       | ≥ 20                                       | Cho phần desktop (Electron + Vite).                                                                   |
| Mạng Internet | Chỉ lần đầu                                | Để tải model. Sau đó chạy hoàn toàn offline.                                                          |

GPU không bắt buộc: whisper.cpp dùng Metal trên Apple Silicon, NLLB chạy MPS/CPU.
Máy không có tăng tốc vẫn chạy được nhưng độ trễ sẽ cao hơn số đo trong Tuần 8.

## 2. Cài công cụ

**uv** (quản lý Python + phụ thuộc):

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
source "$HOME/.local/bin/env"       # nếu terminal chưa thấy lệnh uv

# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**Node.js ≥ 20**: tải từ nodejs.org, hoặc `brew install node` (macOS) /
`winget install OpenJS.NodeJS.LTS` (Windows).

**ffmpeg** (tuỳ chọn): chỉ cần khi chạy bộ đo độ chính xác với file ghi âm không phải
wav 16 kHz mono — `brew install ffmpeg` / `winget install Gyan.FFmpeg`.

## 3. Cài ứng dụng

```bash
git clone <repo> local-live-voice-translator
cd local-live-voice-translator
make setup-min  # chỉ phụ thuộc cần để chạy app (uv sync + npm install)
make dev        # chạy AI service + desktop, Ctrl+C dừng cả hai
```

Chỉ dùng app thì `make setup-min` là đủ. `make setup` cài **thêm** bộ đánh giá FLEURS và
các backend tuỳ chọn (MLX, faster-whisper, tách người nói) — dành cho máy phát triển,
nặng hơn vài trăm MB.

Trên Windows không có `make`: chạy hai lệnh trong hai cửa sổ terminal —

```powershell
cd apps\ai-service ; uv sync ; uv run llvt-ai-service
cd apps\desktop    ; npm install ; npm run dev
```

Kiểm tra service sống: mở http://127.0.0.1:8756/health → `{"status":"ok", ...}`
(hoặc `make health`). Tài liệu API đầy đủ ở http://127.0.0.1:8756/docs — trang này
chạy được cả khi không có mạng vì Swagger UI được đóng gói sẵn trong repo.

## 4. Tải model (lần đầu, cần Internet)

Service **không** nạp model lúc khởi động — mở app chỉ mất chưa tới một giây. Model
được tải và nạp khi bấm **Khởi động model** ở màn **Quản lý model**, hoặc tự động khi
bắt đầu phiên dịch đầu tiên (lúc đó câu đầu sẽ phải chờ hàng chục giây).

| Khâu | Model mặc định (preset Balanced)   | Nguồn tải                                   |
| ---- | ---------------------------------- | ------------------------------------------- |
| VAD  | Silero VAD                         | gói `silero-vad` trên PyPI (không tải thêm) |
| ASR  | `ggml-large-v3-turbo-q5_0.bin`     | GGML qua pywhispercpp                       |
| MT   | `facebook/nllb-200-distilled-600M` | Hugging Face                                |
| TTS  | Piper vi/en, VITS zh-ll            | GitHub release `tts-models` của k2-fsa      |
| TTS  | Kokoro v1.0 (tiếng Nhật)           | GitHub release của kokoro-onnx              |

Preset **Fast** dùng `ggml-small-q5_1.bin` + NLLB int8 (nhẹ và nhanh hơn, chính xác kém
hơn); **Quality** dùng `ggml-large-v3-turbo-q8_0.bin`. Đổi ở màn **Cài đặt**.

**Chỗ lưu model** mặc định là `~/.llvt/models` (Windows: `C:\Users\<tên>\.llvt\models`).
Đổi ở màn **Cài đặt → Thư mục lưu model**; model đã tải **không** tự chuyển sang chỗ
mới, tải lại từ đầu. Xoá model đã tải cũng ở màn đó — chỉ bốn thư mục do app tạo
(`whisper-cpp/`, `nllb/`, `sherpa-tts/`, `kokoro-ja/`) bị xoá.

## 5. Chạy không cần Internet

Sau khi model đã nằm trên đĩa, toàn bộ pipeline chạy cục bộ: rút mạng vẫn dịch được
(đây là tiêu chí nghiệm thu 12). AI service chỉ lắng nghe trên `127.0.0.1` và không
gửi bất kỳ dữ liệu âm thanh hay hội thoại nào ra ngoài.

## 6. Dữ liệu ứng dụng ghi trên máy

| Đường dẫn               | Nội dung                                   | Đổi bằng          |
| ----------------------- | ------------------------------------------ | ----------------- |
| `~/.llvt/models/`       | Model đã tải                               | `LLVT_MODELS_DIR` |
| `~/.llvt/history.db`    | Lịch sử phiên: câu gốc, bản dịch, độ trễ   | `LLVT_DB_PATH`    |
| `~/.llvt/settings.json` | Tuỳ chọn đổi trong app (thư mục lưu model) | —                 |

Không có file âm thanh nào được lưu. Tắt lưu lịch sử ở **Cài đặt → Quyền riêng tư**;
xoá từng phiên hoặc xoá tất cả ở màn **Lịch sử**.

**Gỡ sạch**: xoá thư mục `~/.llvt` và thư mục mã nguồn. `make clean` chỉ xoá
`.venv`, `node_modules` và thư mục build.

## 7. Biến môi trường

Đặt trước khi chạy service (biến môi trường luôn **thắng** tuỳ chọn đổi trong app).

| Biến                      | Mặc định             | Tác dụng                                                   |
| ------------------------- | -------------------- | ---------------------------------------------------------- |
| `LLVT_HOST` / `LLVT_PORT` | `127.0.0.1` / `8756` | Địa chỉ service. **Đừng** đổi host ra ngoài loopback.      |
| `LLVT_DEFAULT_PRESET`     | `balanced`           | Preset lúc khởi động: `fast` / `balanced` / `quality`.     |
| `LLVT_PRELOAD_MODELS`     | `false`              | `true` = nạp model ngay lúc khởi động (chạy headless, CI). |
| `LLVT_MODELS_DIR`         | `~/.llvt/models`     | Thư mục model; đặt biến này thì giao diện khoá ô chọn lại. |
| `LLVT_DB_PATH`            | `~/.llvt/history.db` | File lịch sử phiên.                                        |
| `LLVT_HISTORY_ENABLED`    | `true`               | `false` = không ghi lịch sử.                               |

## 8. Kiểm tra sau khi cài

```bash
make health                 # service trả lời
make test                   # test của AI service
make bench                  # độ trễ từng khâu trên máy này (cần model đã tải)
make soak MINUTES=5         # chạy liên tục, kiểm tra ổn định
make accuracy               # WER/chrF trên bộ câu kiểm thử
```

## 9. Sự cố thường gặp

| Hiện tượng                                     | Nguyên nhân / cách xử lý                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `uv: command not found` ngay sau khi cài       | Terminal chưa nạp PATH mới: `source "$HOME/.local/bin/env"` hoặc mở lại terminal.                      |
| Giao diện báo "Không kết nối được service"     | AI service chưa chạy hoặc cổng 8756 bị chiếm. Kiểm tra `make health`, đổi cổng bằng `LLVT_PORT`.       |
| Câu đầu tiên của phiên chờ rất lâu             | Bình thường: model đang được nạp (lần đầu còn tải về). Bấm **Khởi động model** trước khi họp để tránh. |
| Tải model lỗi giữa chừng                       | Xoá model ở màn **Quản lý model** rồi tải lại; file tải dở không được dùng lại.                        |
| `nodename nor servname provided` khi tải model | DNS trượt nhất thời. Kiểm tra mạng, **khởi động lại service** rồi bấm lại — xem ghi chú bên dưới bảng. |
| Hết chỗ trên ổ hệ thống                        | **Cài đặt → Thư mục lưu model**, trỏ sang ổ khác rồi tải lại.                                          |
| macOS không cho thu âm thanh hệ thống          | Cấp quyền **Ghi màn hình** cho ứng dụng trong System Settings → Privacy & Security, rồi mở lại app.    |

**Vì sao mất mạng lúc tải model lại phải khởi động lại service:** `huggingface_hub`
dùng chung một client `httpx` cho cả tiến trình. Lần gọi đầu hỏng vì DNS thì client đó
bị đóng, nên **cả 5 lần thử lại** đều chết ngay với `RuntimeError: Cannot send a
request, as the client has been closed` — kể cả khi mạng đã có lại. Đây là hành vi của
thư viện, không phải của ứng dụng; cách duy nhất là chạy lại tiến trình service. Model
đã tải xong trước đó (ví dụ whisper) vẫn nằm trên đĩa và không phải tải lại.
