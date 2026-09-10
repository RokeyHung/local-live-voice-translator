# Kết quả đo thô — chép vào repo để báo cáo tra lại được

Toàn bộ số trong [`05` mục 8/8b/8c](../05_bo-danh-gia-fleurs.md) và
[`04` mục 3.3](../04_cac-dot-bo-sung.md) sinh ra từ đúng những file
này. Chép vào repo vì bảng trong tài liệu chỉ có phần tổng hợp: người đọc muốn kiểm lại
một con số, hay muốn soi câu nào dịch sai, thì phải có file gốc.

Đây là **ngoại lệ** của quy tắc `eval-*.json` trong `.gitignore`. Kết quả của những lượt
chạy thử, chạy dở hay chạy trên máy khác thì vẫn không commit — chỉ các lượt đã chốt và
đã được trích vào tài liệu mới nằm ở đây.

**Máy đo:** Apple M4, macOS 26.6 · **Ngày:** 06–07/09/2026 · **Dữ liệu:** `google/fleurs`
split `test`.

## Gộp chung

| File                                     | Nội dung                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| [`eval-summary.json`](eval-summary.json) | **Cả ba khối trong một file** — chỉ phần tổng hợp, không có chi tiết từng câu |

## Kết quả đầy đủ

| File                                                     | Lượt chạy                                                                      | Dùng ở      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------- |
| [`eval-asr-fleurs-full.json`](eval-asr-fleurs-full.json) | ASR, 3.099 bản thu, 4 ngôn ngữ, `mlx-community/whisper-large-v3-asr-8bit`      | `17` mục 8  |
| [`eval-mt-fleurs-full.json`](eval-mt-fleurs-full.json)   | MT, 2.022 cặp câu, 6 chiều, có COMET, **kèm từng câu** (nguồn/dịch/tham chiếu) | `17` mục 8b |
| `eval-latency-<nguồn>-<đích>.json` (6 file)              | Độ trễ cả chuỗi VAD→ASR→MT→TTS, 50 mẫu mỗi chiều, **kèm từng mẫu**             | `17` mục 8c |

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
make eval-mt && make eval-comet
# độ trễ: xem lệnh sáu chiều ở docs/05 mục 2
```

Chạy lại trên máy khác sẽ ra **RTF khác** (gắn với phần cứng) nhưng **WER/BLEU/COMET
gần như trùng**: cả ba script đều tắt fallback nhiệt độ nên giải mã là tất định.
