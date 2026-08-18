# Tuần 8 — Thực nghiệm, đo đạc và đánh giá

**Giai đoạn:** Tuần 8 (03/09 – 09/09) · **Hiện thực:** 30/07/2026, số đo cập nhật 18/08/2026
**Mục tiêu tuần:** Đo độ trễ đầu-cuối và tài nguyên; kiểm tra độ chính xác trên bộ câu tự xây dựng; chạy thử trên Windows và macOS.
**Kết quả mong đợi (đề cương `00` §5):** Báo cáo kết quả kiểm thử; ứng dụng chạy ổn định trong các kịch bản chính.

> Nguyên tắc của cả tuần: **mọi con số phải đo trên máy, không ước lượng**. Trước tuần
> này màn Chẩn đoán hiển thị vài giá trị chép tay; giờ tất cả đến từ hai endpoint mới.

---

## 1. Bộ đồ nghề đã xây dựng

| Công cụ               | Đo cái gì                                     | Gọi bằng                                      |
| --------------------- | --------------------------------------------- | --------------------------------------------- |
| `POST /api/benchmark` | Độ trễ từng khâu VAD/ASR/MT/TTS trên máy này  | nút "Chạy test" ở màn Chẩn đoán, `make bench` |
| `GET /api/resources`  | CPU% và RSS của chính tiến trình service      | màn Chẩn đoán (hỏi lại mỗi 2 s)               |
| `scripts/accuracy.py` | WER cho ASR, chrF cho MT trên bộ câu kiểm thử | `make accuracy`                               |

## 2. Đo độ trễ — hai cái bẫy phải tránh

**Bẫy 1: đo nguội.** Lần chạy đầu tiên gồm cả nạp model và dựng graph suy luận. Đo
nguội cho **34,7 s**; sau khi bắt buộc warm-up thì lần đầu 1,67 s ≈ lần hai 1,65 s.
Vì vậy `run_benchmark` **luôn** warm-up trước khi bấm giờ, và con số công bố là độ trễ
mỗi câu khi máy đã chạy ổn định — **không** gồm thời gian khởi động.

**Bẫy 2: khâu sau ăn theo khâu trước.** Nếu đưa transcript vừa nhận vào MT thì khi ASR
trả chuỗi rỗng, MT sẽ "nhanh" một cách giả tạo. Nên mỗi khâu chạy với **đầu vào cố
định, độc lập**:

- VAD/ASR: một đoạn sóng tổng hợp 3 giây (whisper.cpp phụ thuộc **độ dài** audio chứ
  gần như không phụ thuộc nội dung → khỏi phải đính file wav vào repo).
- MT/TTS: một câu mẫu cố định theo ngôn ngữ.

### Số đo tham chiếu (máy dev: MacBook Apple Silicon, preset Balanced, audio vào 3 giây)

| Chiều dịch | VAD | ASR  | MT  | TTS | Tổng |
| ---------- | --- | ---- | --- | --- | ---- |
| vi → en    | 46  | 1060 | 569 | 141 | 1819 |
| en → vi    | 46  | 991  | 579 | 148 | 1766 |
| vi → ja    | 48  | 1056 | 460 | 772 | 2338 |
| vi → zh    | 46  | 1038 | 558 | 969 | 2613 |

Đơn vị: mili giây. Đọc bảng này:

- **ASR là khâu nặng nhất** cho hai chiều Việt–Anh (~1 s cho 3 giây audio), đúng như dự
  đoán: `whisper-large-v3-turbo-q5` chạy Metal.
- vi→en tổng 1,82 s cho 3 giây tiếng nói → **≈ 0,6 lần thời gian thực**, tức pipeline
  theo kịp người nói bình thường.
- TTS tiếng Nhật (Kokoro) và tiếng Trung (VITS zh-ll) đắt hơn Piper 5–7 lần; hai chiều
  đó tổng vẫn dưới 3 s nhưng là chỗ tối ưu đầu tiên nếu cần.

**Tài nguyên:** sau khi nạp cả 4 giọng + whisper + NLLB, tiến trình service chiếm
**2055 MB RSS** với 32 luồng. Không đo VRAM: Apple Silicon dùng bộ nhớ hợp nhất (đã nằm
trong RSS), còn card rời cần thư viện riêng theo hãng — ngoài phạm vi đồ án. Renderer
nằm trong sandbox Chromium nên không tự đọc được phần này, đó là lý do phải có endpoint
`/api/resources` thay vì đọc ở phía UI.

## 3. Đo độ chính xác

`scripts/accuracy.py` + `accuracy_corpus.json` chạy hai chỉ số:

- **WER** cho ASR — khoảng cách Levenshtein trên chuỗi từ sau khi chuẩn hoá.
- **chrF** cho MT — F-score trên n-gram ký tự. Chọn chrF thay BLEU vì bộ câu nhỏ và
  tiếng Việt không cần tách từ; BLEU phạt quá nặng khi thiếu vài câu.

Bản dịch được sinh **từ câu tham chiếu**, không phải từ transcript — để lỗi của ASR
không cộng dồn vào điểm của MT.

Hai chế độ, tuỳ trường `audio` trong bộ câu:

| Chế độ                      | Khi nào dùng             | Giá trị của số liệu                                                                                               |
| --------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Audio thật do người đọc** | Có file wav 16 kHz mono  | Số duy nhất dùng được cho báo cáo                                                                                 |
| **Round-trip qua TTS**      | Chưa thu được giọng thật | Chỉ để biết pipeline còn sống; **WER lạc quan hơn thực tế** vì giọng máy sạch, không nhiễu, không giọng vùng miền |

Script đánh dấu từng dòng thuộc chế độ nào để hai loại số không bị trộn. Kết quả chạy
thử với model thật (10 câu, chế độ round-trip): **WER trung bình 12,5%**, **chrF 53,4%**.

## 4. Giao diện đọc số thật

Trước đợt này màn Chẩn đoán có ô "Chưa hỗ trợ" và vài giá trị phần cứng chép tay. Sau
đợt này: nút "Chạy test" gọi `POST /api/benchmark` thật, bốn ô "Phần cứng" hiện CPU của
service, RAM của service và RAM máy lấy từ `GET /api/resources`. Nguyên tắc giữ xuyên
suốt dự án: **thà để trống/đánh dấu chưa hỗ trợ còn hơn hiển thị số bịa**.

## 5. Còn nợ

- **Chạy thử trên Windows 11**: toàn bộ số ở trên là của máy macOS. Windows cần đo lại
  (đặc biệt: WASAPI loopback, VB-CABLE, và TTS int8 — trên x86 có AVX-VNNI thì bản int8
  của Kokoro nhiều khả năng nhanh hơn fp32, ngược với kết quả trên ARM).
- **Bộ câu thu bằng giọng người thật** để có WER dùng được cho báo cáo.
- **Kiểm thử chạy liên tục 60 phút** (tiêu chí nghiệm thu số 14 trong SPEC `01` §18).
- Kịch bản Google Meet đầy đủ — xem [`09_week7-two-way.md`](09_week7-two-way.md) mục 8.
