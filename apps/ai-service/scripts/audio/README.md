# Audio tham chiếu cho bộ đo độ chính xác

Thư mục chứa các đoạn ghi âm **giọng người thật** dùng cho `make accuracy` (WER) và
làm đầu vào cho `make soak`. File audio ở đây **không được commit** (xem `.gitignore`),
chỉ README này nằm trong repo — đó là dữ liệu giọng nói, không thuộc về repo mã nguồn.

## Cách 1 — có sẵn bản ghi dài (vlog, ghi âm buổi họp)

```bash
cd apps/ai-service
uv run python scripts/segment_audio.py ../../ban-ghi.mov --prefix vlog --limit 20
# hoặc từ thư mục gốc: make segment MEDIA=ban-ghi.mov PREFIX=vlog
```

Script dùng chính Silero VAD của dự án để tách các đoạn có tiếng nói, ghi mỗi đoạn
thành `vlog-01.wav`, `vlog-02.wav`… (16 kHz mono) và sinh `vlog-draft.json` — khung
sẵn để điền lời. Đoạn quá ngắn (<1,5 s) hoặc quá dài (>12 s) bị loại.

Sau đó **nghe từng file và gõ đúng lời** vào `transcript`, dịch sang ngôn ngữ đích ở
`translation`, rồi chép các case sang [`../accuracy_corpus.json`](../accuracy_corpus.json)
và chạy `make accuracy`.

> Bước gõ lời **không tự động được**. Lấy chính đầu ra của ASR làm câu tham chiếu thì
> WER luôn ≈ 0% và con số đó vô nghĩa — nó chỉ chứng minh ASR bằng chính nó.

## Cách 2 — tự thu từng câu

Thu mỗi câu một file, đặt vào đây, rồi điền tên file vào trường `audio`:

```json
{
  "id": "vi-01",
  "language": "vi",
  "target": "en",
  "audio": "audio/vi-01.mp3",
  "transcript": "Tôi đã hoàn thành phần triển khai API.",
  "translation": "I have finished the API implementation."
}
```

Câu nào chưa có file thì để `"audio": ""` — script chạy chế độ round-trip qua TTS và
**đánh dấu rõ** dòng đó, vì WER của giọng máy lạc quan hơn thực tế.

## Định dạng

Nhận **wav, mp3, m4a**; `segment_audio.py` nhận thêm cả **mov/mp4**. File nào không
phải wav PCM16 mono 16 kHz sẽ được `ffmpeg` chuyển tự động — cần ffmpeg trên PATH
(`brew install ffmpeg` / `winget install Gyan.FFmpeg`). Chuyển sẵn bằng tay:

```bash
ffmpeg -i vi-01.mp3 -ac 1 -ar 16000 -c:a pcm_s16le vi-01.wav
```

## Ghi âm thế nào cho số đo có giá trị

Điểm WER chỉ dùng được cho báo cáo khi audio giống lúc dùng thật:

- Đọc/nói **đúng** nội dung sẽ ghi vào `transcript` — sai một từ tính thành lỗi của ASR.
- Thu bằng chính microphone sẽ dùng khi họp, ở khoảng cách bình thường.
- Giữ tạp âm nền tự nhiên của phòng làm việc; đừng thu trong phòng cách âm rồi báo cáo
  con số đó là điều kiện thực tế.
- Nên có vài giọng khác nhau (nam/nữ, vùng miền) nếu định nhận xét về độ ổn định.
- Bản ghi lấy từ nguồn của người khác (vlog, podcast) dùng để thử pipeline thì tiện,
  nhưng nếu đưa số liệu vào báo cáo thì **ghi rõ nguồn**, hoặc thay bằng giọng tự thu.

## Dùng làm đầu vào cho bài chạy dài

```bash
make soak MINUTES=15 AUDIO=apps/ai-service/scripts/audio        # cả thư mục: mỗi wav một lượt nói
```

Không truyền `AUDIO` thì soak dùng sóng tổng hợp — đủ để kiểm tra ổn định, nhưng
giọng thật mới cho thấy VAD/ASR cư xử thế nào với ngắt nghỉ và tạp âm thật.
