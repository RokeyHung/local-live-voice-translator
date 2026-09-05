# Màn Đánh giá trong app + backend ASR thứ ba (faster-whisper)

**Giai đoạn:** ngoài lịch tuần · **Hiện thực:** 05/09/2026
**Nguồn yêu cầu:** [biên bản GVHD 19/08](meetings/bien-ban-hop-GVHD-2026-08-19.md) mục 3d
(Ưu tiên 2) và mục 7 Ưu tiên 3 (tích hợp thêm model để so sánh).

> Đóng nốt hai việc **code** cuối cùng còn thiếu của đồ án. Sau đợt này, mọi thứ còn
> lại là chạy thật, đo, và Tuần 9.

---

## 1. Màn Đánh giá — thầy yêu cầu ở mục 3d

Yêu cầu nguyên văn: _chọn câu mẫu có bản dịch tham chiếu, chạy qua hệ thống, app tự
tính độ trễ **và** chất lượng._ Trước đợt này đã có đủ thứ để làm việc đó, nhưng chỉ
ở dạng CLI (`make accuracy`) — phải mở terminal mới xem được số.

### 1.1. Độ đo: vì sao không dùng jiwer/sacrebleu trong app

Hai gói đó nằm ở nhóm phụ thuộc `eval`, **không có** trong bản cài của người dùng. Tệ
hơn: tokenizer `flores200` của sacrebleu **tải thêm một model** lần đầu dùng — trái
với "cài xong là chạy offline", thứ là toàn bộ lý do tồn tại của đồ án.

Nên phần tính trong app là Levenshtein + chrF thuần Python (`application/evaluation.py`),
chạy trên vài trăm câu thì thừa nhanh. Đổi lại phải nói rõ, và giao diện có nói rõ:

|                                     | Màn Đánh giá trong app              | `make eval-asr` / `make eval-mt`         |
| ----------------------------------- | ----------------------------------- | ---------------------------------------- |
| Độ đo                               | WER/CER + chrF thuần Python         | jiwer + **spBLEU** (tokenizer flores200) |
| Cần mạng                            | không                               | có, lần đầu                              |
| Dùng để                             | thử nhanh, so các cấu hình với nhau | **bảng đưa vào báo cáo**                 |
| So được với số công bố của NLLB-200 | không                               | có                                       |

Bản trong package là **nguồn duy nhất**: `scripts/accuracy.py` đã bỏ phần chép tay và
import từ đây, `scripts/eval_latency.py` cũng gọi chung hàm `percentile` — cùng một bộ
dữ liệu phải ra cùng một con số p90, dù đọc ở đâu. Nhân tiện, bản trong package có
**CER cho zh/ja**, thứ bản CLI cũ thiếu (nó chỉ có WER).

### 1.2. Ba điều màn hình phải nói thật

**Dịch từ câu tham chiếu, không dịch từ đầu ra ASR.** Dịch từ cái ASR vừa nghe được
thì lỗi hai khâu cộng dồn, không biết chất lượng dịch thật sự là bao nhiêu.

**Câu không có bản ghi thì chạy bằng giọng tổng hợp.** Máy tự đọc câu tham chiếu rồi
tự nghe lại. Tiện để thử pipeline còn sống, nhưng giọng tổng hợp sạch và đều nên số
**lạc quan hơn thực tế**. Kết quả trả cờ `hasSyntheticAudio`, và màn hình hiện một dải
cảnh báo riêng trước khi người đọc kịp chép con số vào báo cáo. Từng câu cũng có nhãn
_giọng máy_.

**Khai báo `audio` mà sai đường dẫn thì BÁO LỖI**, không lặng lẽ rơi về giọng tổng hợp
— người chạy sẽ tưởng mình đang có số đo giọng thật.

### 1.3. Báo p50/p90, không báo trung bình

Người dùng cảm nhận được đúng những câu chậm nhất; trung bình thì che mất chúng. Bảng
tổng có `ASR p50/p90`, `MT p90`, `Total p90` và `RTF p90` — cùng bộ chỉ số với
[`17_bo-danh-gia-fleurs.md`](17_bo-danh-gia-fleurs.md) để hai bảng đọc cạnh nhau được.

### 1.4. Số thật đo được khi làm

Chạy 2 câu đầu của bộ mẫu trên MacBook (whisper large-v3-turbo-q5 + NLLB-600M):

|                 |               |
| --------------- | ------------- |
| WER trung bình  | 18,8 %        |
| chrF trung bình | 35,9 %        |
| ASR p50 / p90   | 970 / 1046 ms |
| MT p50 / p90    | 246 / 733 ms  |
| RTF p90         | 1,022         |

Cả hai câu đều là **giọng tổng hợp**, nên đây chưa phải số dùng được cho báo cáo —
đúng như dải cảnh báo trên màn hình nói. Hai điều đáng chú ý:

- ASR nghe "API" thành "A.V." và "kiểm thử" thành "kiểm thư" — lỗi đúng kiểu Whisper
  trên từ mượn và thanh điệu.
- chrF chỉ ~36 % dù bản dịch **đúng nghĩa** ("I've completed the API deployment" vs
  tham chiếu "I have finished the API implementation"). Đây là hành vi đúng của chrF
  trên câu ngắn có cách diễn đạt khác, không phải lỗi — và cũng là lý do bảng báo cáo
  cần thêm COMET (chấm theo ngữ nghĩa), thứ `make eval-comet` đã có.

### 1.5. Chạy thử thật

Đã kiểm cả ba đường: tiến trình báo đúng `done/total` giữa chừng, bấm Huỷ thì lượt
chạy dừng và **giữ lại 3 câu đã chấm xong** (`cancelled: true`), và gửi lượt thứ hai
trong lúc đang chạy thì trả **409** chứ không chen ngang.

---

## 2. faster-whisper — backend ASR thứ ba

Adapter này là stub từ Tuần 3 ("thuộc giai đoạn tối ưu"). Giờ hiện thực thật, vì hai
lý do đều đã đến hạn:

- **Windows 11 là một trong hai nền tảng mục tiêu.** Ở đó whisper.cpp không có Metal,
  mà nhân CUDA của nó cũng không bằng CTranslate2. Đây là backend đáng đo nhất trên
  máy Windows + NVIDIA.
- Thầy giao ở Ưu tiên 3: _tích hợp thêm model khác, lập bảng so sánh trên cùng tiêu
  chí_. Có ba runtime cho **cùng một model Whisper** là bảng so sánh sạch nhất có
  thể — khác nhau đúng ở engine, không lẫn khác biệt về model.

Ba backend giờ đối xứng nhau:

|          | whisper.cpp        | MLX                      | faster-whisper                     |
| -------- | ------------------ | ------------------------ | ---------------------------------- |
| Engine   | C++ + Metal shader | framework mảng của Apple | CTranslate2                        |
| Thiết bị | Metal / CPU        | Metal (bắt buộc)         | CUDA fp16 / CPU int8               |
| Nền tảng | cả hai             | macOS Apple Silicon      | cả hai, mạnh nhất ở Windows+NVIDIA |
| Gói      | mặc định           | `--extra mlx`            | `--extra ctranslate2`              |

Ba chi tiết khi làm:

**Tham số giải mã đối xứng** với hai adapter kia (tắt fallback nhiệt độ, không mang
ngữ cảnh sang câu sau). So ba runtime chỉ có nghĩa khi chính sách giải mã giống nhau.
`temperature=(0.0,)` là cách faster-whisper tắt fallback: tham số nhận một dãy, đưa
đúng một phần tử thì nó không còn nhiệt độ nào để lùi về.

**VAD riêng của nó: TẮT.** Đoạn vào đây đã do Silero cắt sẵn; cắt thêm lần nữa là bỏ
mất phần đệm đầu/cuối câu mà khâu VAD cố tình chừa (`speech_pad_ms`).

**Phải duyệt hết generator trong worker thread.** `transcribe()` trả `(generator, info)`
và phần giải mã thật sự chạy khi duyệt — trả generator ra ngoài thì phần nặng lại chạy
trên event loop. Có một test riêng cho chuyện này.

`accel` báo kèm kiểu tính toán (`cuda (float16)`, `cpu (int8)`): cùng một GPU nhưng
fp16 và int8 cho hai con số tốc độ khác hẳn, thiếu nó thì bảng đo không đọc được.

---

## 3. Kiểm thử

37 test mới (**280 passed, 4 skipped**):

| File                         | Số  | Kiểm gì                                                                                                         |
| ---------------------------- | --- | --------------------------------------------------------------------------------------------------------------- |
| `test_evaluation.py`         | 20  | Độ đo tính tay được, dịch từ tham chiếu, cờ giọng tổng hợp, huỷ giữ phần đã chấm, và các đường từ chối của REST |
| `test_asr_faster_whisper.py` | 15  | Ánh xạ tên, thiết bị + kiểu tính toán, tham số giải mã, duyệt hết generator                                     |
| `test_asr_backend_switch.py` | +2  | Cả ba backend đều đăng ký, mọi preset đều có cột faster-whisper                                                 |

## 4. Còn lại

- [ ] **Thay bộ câu mẫu bằng câu thoại họp thật, có thu âm giọng người.** Đây là việc
      quyết định giá trị của mọi con số ở mục 1 — bộ mẫu 10 câu đi kèm chỉ để màn hình
      có thứ chạy được ngay.
- [ ] **Đo faster-whisper trên máy Windows + NVIDIA** rồi thêm cột thứ ba vào bảng của
      [`17`](17_bo-danh-gia-fleurs.md): `make setup-ctranslate2` rồi
      `LLVT_ASR_ADAPTER=faster_whisper make eval-asr`.
