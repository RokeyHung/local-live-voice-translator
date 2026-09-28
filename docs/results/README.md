# Kết quả đo thô — chép vào repo để báo cáo tra lại được

Toàn bộ số trong [`05` mục 8/8b/8c/8d/8e/8f](../05_bo-danh-gia-fleurs.md) và
[`04` mục 3.3](../04_cac-dot-bo-sung.md) sinh ra từ đúng những file
này. Chép vào repo vì bảng trong tài liệu chỉ có phần tổng hợp: người đọc muốn kiểm lại
một con số, hay muốn soi câu nào dịch sai, thì phải có file gốc.

Đây là **ngoại lệ** của quy tắc `eval-*.json` trong `.gitignore`. Kết quả của những lượt
chạy thử, chạy dở hay chạy trên máy khác thì vẫn không commit — chỉ các lượt đã chốt và
đã được trích vào tài liệu mới nằm ở đây.

**Máy đo:** Apple M4, macOS 26.6 · **Ngày:** 06–07/09/2026 · **Dữ liệu:** `google/fleurs`
split `test`.

**Ngoại lệ — các lượt chạy trên Windows, 20/09/2026** (đuôi `-win`): Windows 11, Intel
Core i5-12500H + NVIDIA GeForce RTX 4060 Laptop GPU, 64 GB RAM. Đừng đọc RTF của hai máy
trong cùng một cột.

Hai file `eval-asr-*-win.json` ghi sẵn máy đo ở trường `hardware` và thiết bị ASR ở
`runtime.accel`. **Ba file của mục 8f** (`accuracy-phongvan-win.json`, `phongvan-corpus.json`,
`endpointing-3-nguon.txt`, 20–22/09) cũng đo trên máy này; WER và bảng tách câu không phụ
thuộc thiết bị. File audio của chúng không nằm trong repo — là giọng của người khác, lấy từ
YouTube; `phongvan-corpus.json` ghi lệnh dựng lại. **Sáu file `eval-latency-*-win.json` thì không**: script lúc chạy chưa
ghi hai trường đó, nên máy đo của chúng chỉ nằm ở đây và ở
[`05` mục 8e](../05_bo-danh-gia-fleurs.md). Cấu hình của sáu lượt đó là whisper.cpp trên
Vulkan + NLLB trên CUDA + TTS trên CPU.

## Gộp chung

| File                                     | Nội dung                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| [`eval-summary.json`](eval-summary.json) | **Cả ba khối trong một file** — chỉ phần tổng hợp, không có chi tiết từng câu |

## Kết quả đầy đủ

| File                                                                       | Lượt chạy                                                                                          | Dùng ở      |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------- |
| [`eval-asr-fleurs-full.json`](eval-asr-fleurs-full.json)                   | ASR, 3.099 bản thu, 4 ngôn ngữ, `mlx-community/whisper-large-v3-asr-8bit`                          | `05` mục 8  |
| [`eval-mt-fleurs-full.json`](eval-mt-fleurs-full.json)                     | MT, 2.022 cặp câu, 6 chiều, có COMET, **kèm từng câu** (nguồn/dịch/tham chiếu)                     | `05` mục 8b |
| `eval-latency-<nguồn>-<đích>.json` (6 file)                                | Độ trễ cả chuỗi VAD→ASR→MT→TTS, 50 mẫu mỗi chiều, **kèm từng mẫu**                                 | `05` mục 8c |
| [`eval-asr-ggml-win-vulkan.json`](eval-asr-ggml-win-vulkan.json)           | ASR, 3.099 bản thu, 4 ngôn ngữ, `ggml-large-v3-turbo-q5_0` trên **whisper.cpp + Vulkan** (Windows) | `05` mục 8d |
| [`eval-asr-fasterwhisper-win.json`](eval-asr-fasterwhisper-win.json)       | ASR, 3.099 bản thu, 4 ngôn ngữ, `large-v3-turbo-ct2` trên **faster-whisper + CUDA** (Windows)      | `05` mục 8d |
| `eval-latency-<nguồn>-<đích>-win.json` (6 file)                            | Độ trễ cả chuỗi trên Windows: whisper.cpp/Vulkan + NLLB/CUDA                                       | `05` mục 8e |
| [`eval-asr-ggml-win-audioctx768.json`](eval-asr-ggml-win-audioctx768.json) | Cùng lượt trên, bật `LLVT_ASR_AUDIO_CTX=768` — bằng chứng để **giữ tắt** tuỳ chọn đó               | `05` mục 8d |
| [`soak-60min-win.json`](soak-60min-win.json)                               | Chạy liên tục 60 phút với model thật: 877 câu, 0 lỗi, RSS +12 MB (SPEC tiêu chí 14)                | `08` mục 1  |
| [`accuracy-phongvan-win.json`](accuracy-phongvan-win.json)                 | ASR + MT trên 25 đoạn phỏng vấn **giọng người thật**, × 3 đích en/ja/zh, **kèm từng câu**          | `05` mục 8f |
| [`phongvan-corpus.json`](phongvan-corpus.json)                             | Bộ câu của lượt trên — chỉ phần chữ, kèm lệnh dựng lại file audio từ video gốc                     | `05` mục 8f |
| [`endpointing-3-nguon.txt`](endpointing-3-nguon.txt)                       | `make endpointing` trên ba bản ghi: bản tin, phỏng vấn, TEDx — bốn cấu hình VAD                    | `05` mục 8f |

`eval-mt-fleurs-full.json` nặng ~1,1 MB vì giữ cả 2.022 câu dịch — đó là phần có ích
nhất khi viết mục phân tích lỗi: soi được câu nào sai và sai kiểu gì, thay vì chỉ có một
con số spBLEU.

## Chọn model (20 câu mỗi lượt)

`model-selection/` giữ các lượt đo ngắn dùng để **chọn** model trước khi chạy bản đầy đủ.
Mỗi file là 20 câu đầu của một ngôn ngữ — đủ để xếp hạng tương đối, **không đủ** làm số
báo cáo (cùng model đó, 20 câu cho WER 6,7% còn toàn bộ 857 bản thu cho 8,8%).

| File                               | Model                                 | Kết quả            |
| ---------------------------------- | ------------------------------------- | ------------------ |
| `asr-20cau-mlx-large-v3-fp16.json` | `whisper-large-v3-asr-fp16`           | vi WER 6,7 %       |
| `asr-20cau-mlx-large-v3-8bit.json` | `whisper-large-v3-asr-8bit` ← đã chọn | vi WER 6,7 %       |
| `asr-20cau-mlx-large-v3-4bit.json` | `whisper-large-v3-asr-4bit`           | vi WER 7,2 %       |
| `asr-20cau-mlx-turbo-fp16.json`    | `whisper-large-v3-turbo-asr-fp16`     | vi WER 8,1 %       |
| `asr-20cau-mlx-turbo-8bit.json`    | `whisper-large-v3-turbo-asr-8bit`     | vi WER 8,1 %       |
| `asr-20cau-mlx-turbo-4bit.json`    | `whisper-large-v3-turbo-asr-4bit`     | vi WER 8,9 %       |
| `asr-20cau-mlx-small-fp16.json`    | `whisper-small-asr-fp16`              | vi WER **133,5 %** |
| `asr-20cau-mlx-small-8bit-vi.json` | `whisper-small-asr-8bit`              | vi WER **125,4 %** |
| `asr-20cau-mlx-small-8bit-en.json` | `whisper-small-asr-8bit`              | en WER **162,1 %** |
| `asr-20cau-ggml-small-q5.json`     | `ggml-small-q5_1` (whisper.cpp)       | vi WER 20,6 %      |

Ba file `small` của mlx-community là bằng chứng cho [`04` mục 3.3](../04_cac-dot-bo-sung.md):
họ model đó hỏng (một nửa số câu trả rỗng, phần còn lại kẹt vòng lặp lặp chữ), trong khi
bản GGML **cùng cỡ** chạy bình thường — nên lỗi nằm ở bản chuyển đổi chứ không phải ở
cỡ model hay tham số giải mã. Đó là lý do preset Fast phải đổi model MLX.

## Sinh lại

```bash
make fetch-fleurs
make eval-asr ADAPTER=mlx_whisper MODEL=mlx-community/whisper-large-v3-asr-8bit \
  JSON=eval-asr-fleurs-full.json
# cột whisper.cpp trên Windows: phải cài wheel Vulkan trước, không thì chạy CPU
# (RTF 1,5 thay vì 0,02) mà WER vẫn đúng nên rất dễ không nhận ra
make setup-eval && make setup-vulkan
UV_NO_SYNC=1 make eval-asr JSON=eval-asr-ggml-win-vulkan.json
UV_NO_SYNC=1 make eval-asr ADAPTER=faster_whisper JSON=eval-asr-fasterwhisper-win.json
UV_NO_SYNC=1 make eval-latency-all LIMIT=50 SUFFIX=-win

make eval-mt && make eval-comet
# độ trễ: xem lệnh sáu chiều ở docs/05 mục 2
```

Chạy lại trên máy khác sẽ ra **RTF khác** (gắn với phần cứng) nhưng **WER/BLEU/COMET
gần như trùng**: cả ba script đều tắt fallback nhiệt độ nên giải mã là tất định.
