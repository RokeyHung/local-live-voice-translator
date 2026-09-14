# Tài liệu cài đặt

Hướng dẫn cài và chạy ứng dụng trên **macOS 13+ (Apple Silicon)** và **Windows 11 x64**.
Có hai đường: [bộ cài sẵn](#3a-cài-từ-bộ-cài-khuyến-nghị) (người dùng cuối, không cần
cài công cụ gì) và [chạy từ mã nguồn](#3b-chạy-từ-mã-nguồn-máy-phát-triển) (máy phát
triển). Mục 2 chỉ cần cho đường thứ hai.

> **Phạm vi (chốt 10/09/2026):** ứng dụng dịch giọng nói và phát bản dịch ra loa/tai
> nghe. Phần đẩy tiếng dịch ngược vào Google Meet qua microphone ảo **đã bỏ**, nên
> không phải cài driver âm thanh ảo nào. Lý do bỏ ghi ở
> [`11_pham-vi-da-bo-google-meet.md`](11_pham-vi-da-bo-google-meet.md).

---

## 1. Yêu cầu

| Hạng mục      | Tối thiểu                                  | Ghi chú                                                                                              |
| ------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Hệ điều hành  | macOS 13+ (Apple Silicon) / Windows 11 x64 | Thu âm thanh hệ thống cần ScreenCaptureKit (macOS 13+) hoặc WASAPI loopback (Windows 10 1903+).      |
| RAM           | 8 GB, khuyến nghị 16 GB                    | Riêng tiến trình AI service chiếm ~2 GB khi đã nạp đủ model (đo ở [Tuần 8](03_nhat-ky-tuan-1-8.md)). |
| Ổ cứng trống  | ~5 GB                                      | Model chiếm ~4 GB; xem dung lượng thật ở màn **Quản lý model**.                                      |
| Python        | 3.11 hoặc 3.12                             | **Chỉ khi chạy từ mã nguồn.** Bộ cài đã mang sẵn Python riêng.                                       |
| Node.js       | ≥ 20                                       | **Chỉ khi chạy từ mã nguồn.** Cho phần desktop (Electron + Vite).                                    |
| Mạng Internet | Chỉ lần đầu                                | Để tải model. Sau đó chạy hoàn toàn offline.                                                         |

GPU không bắt buộc: whisper.cpp dùng Metal trên Apple Silicon, NLLB chạy MPS/CPU.
Máy không có tăng tốc vẫn chạy được nhưng độ trễ sẽ cao hơn số đo trong Tuần 8.

## 2. Cài công cụ — bỏ qua nếu dùng bộ cài sẵn

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

## 3a. Cài từ bộ cài (khuyến nghị)

Bộ cài đã mang sẵn cả AI service Python lẫn bộ thông dịch của nó, nên máy đích **không
cần** uv, Node hay Python.

| Hệ điều hành            | File                               | Dung lượng                          |
| ----------------------- | ---------------------------------- | ----------------------------------- |
| macOS 13+ Apple Silicon | `Voice Translator-1.0.0-arm64.dmg` | ~506 MB tải về, ~1,7 GB sau khi cài |
| Windows 11 x64          | `Voice Translator-1.0.0-setup.exe` | tương đương                         |

**macOS.** Mở `.dmg`, kéo **Voice Translator** vào Applications. Lần đầu mở phải
**chuột phải lên app → Mở → Mở**, chứ không phải nháy đúp.

> Vì sao: app ký ad-hoc, không có Developer ID của Apple (đồ án không có tài khoản
> Apple Developer). Nháy đúp sẽ bị Gatekeeper chặn với thông báo đại ý "không mở được
> vì không rõ nhà phát triển". Chuột phải → Mở là đường Apple để sẵn cho trường hợp
> này, chỉ cần làm một lần. Nếu máy vẫn báo app "bị hỏng", gỡ cờ tải-từ-Internet:
>
> ```bash
> xattr -dr com.apple.quarantine "/Applications/Voice Translator.app"
> ```

**Windows.** Chạy `.exe`, chọn thư mục cài (bản cài ~1,5 GB nên có thể muốn đổi khỏi ổ
C). SmartScreen sẽ cảnh báo vì bộ cài chưa mua chứng chỉ ký — bấm **More info → Run
anyway**.

Mở app xong là dùng được ngay: AI service tự chạy nền, không phải mở terminal. Nếu app
báo service không lên, log nằm ở:

- macOS: `~/Library/Application Support/voice-translator/ai-service.log`
- Windows: `%APPDATA%\voice-translator\ai-service.log`

### Tự dựng bộ cài

```bash
make dist        # bundle service + build desktop + đóng gói → dist/installer
```

`make dist` chạy ba bước: `tools/bundle_service.sh` dựng bộ Python tự chạy ở
`dist/service`, `make build` build renderer, rồi electron-builder gói cả hai lại.
**Phải build trên đúng hệ điều hành đích** — thư viện native của torch/sherpa-onnx
không biên dịch chéo được, nên bản Windows phải dựng trên máy Windows (trong Git Bash,
vì hai script là bash).

Bản macOS trên Apple Silicon **mặc định mang theo backend MLX** (+~430 MB): đó là backend
đã dùng để đo bảng WER trong báo cáo ([`05` mục 8](05_bo-danh-gia-fleurs.md)), nên bản
giao nộp phải chạy lại được đúng con số đó. Máy khác thì biến tự rỗng. Thêm bớt bằng
`make dist BUNDLE_EXTRAS="--with-mlx --with-diarization"` (rỗng = chỉ phụ thuộc lõi).

Backend nào không có trong bản cài thì **giao diện tự ẩn đi**: service chỉ trả về những
runtime thật sự import được, nên không còn chuyện chọn xong mới biết là thiếu.

Đổi icon: thay `apps/desktop/build/icon-source.png` rồi `make icons` (chỉ chạy trên
macOS, dùng `iconutil`/`sips`; ba file icon sinh ra đều được commit nên máy Windows
không phải chạy lại).

## 3b. Chạy từ mã nguồn (máy phát triển)

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

## 4b. Cấp quyền (chỉ macOS, lần đầu)

| Quyền            | Vì sao cần                                 | Cấp ở đâu                                                                                                          |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Microphone**   | Thu giọng của bạn                          | System Settings → Privacy & Security → Microphone                                                                  |
| **Ghi màn hình** | Thu âm thanh hệ thống (tiếng phía bên kia) | System Settings → Privacy & Security → Screen Recording (macOS 15 đổi tên thành "Screen & System Audio Recording") |

Quyền Ghi màn hình chỉ được hỏi ở **lần đầu bắt đầu phiên** ở chế độ Nghe hoặc Hai chiều.
Chưa cấp thì chiều nghe không chạy (chiều nói vẫn hoạt động bình thường), và sau khi cấp
phải **mở lại ứng dụng**.

Windows không cần bước này: WASAPI loopback không đòi quyền riêng.

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

Bản cài sẵn ghi thêm một file nhật ký của AI service, vì ở đó không có terminal nào để
đọc stdout: `~/Library/Application Support/voice-translator/ai-service.log` (macOS) hoặc
`%APPDATA%\voice-translator\ai-service.log` (Windows). Cùng thư mục đó là cache của
Chromium — đo và dọn được ở **Cài đặt → Dung lượng**.

Không có file âm thanh nào được lưu. Tắt lưu lịch sử ở **Cài đặt → Quyền riêng tư**;
xoá từng phiên hoặc xoá tất cả ở màn **Lịch sử**.

**Gỡ sạch**: xoá thư mục `~/.llvt`, thư mục userData nói trên, và app (kéo vào Thùng
rác / Add or remove programs). Với bản chạy từ mã nguồn thì `make clean` xoá `.venv`,
`node_modules`, thư mục build và cả `dist/`.

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
