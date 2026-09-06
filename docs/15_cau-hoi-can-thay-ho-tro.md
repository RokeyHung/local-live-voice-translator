# Các câu hỏi cần CBHD cho ý kiến

**Ngày họp:** \_\_\_\_ · **SV:** Ngô Mạnh Hùng – 24410300 · **CBHD:** ThS. Nguyễn Thành Luân

Mỗi câu gồm: **bối cảnh** (vì sao vướng) → **phương án em đề xuất** → **thứ cần thầy quyết**.
Đặt sẵn phương án để thầy chỉ cần xác nhận hoặc chỉnh, không phải nghĩ từ đầu.

> **Trạng thái 07/09 — nhóm A đã có câu trả lời, giữ nguyên phần dưới làm bản ghi.**
> Thầy chốt ở [biên bản 19/08](meetings/bien-ban-hop-GVHD-2026-08-19.md) mục 3: đo trên
> **FLEURS** thay vì bộ câu tự dựng, và **dùng cả BLEU lẫn COMET** — ngược với đề xuất
> "không dùng BLEU/COMET" ở mục A1 dưới đây. Hai lý do em nêu lúc đó cũng không còn
> đúng: bộ dữ liệu giờ là 2.022 cặp câu chứ không phải 30, và COMET chấm hết trong ~4
> phút chứ không "chạy chậm". Số thật ở [`17` mục 8](17_bo-danh-gia-fleurs.md), phần
> giải thích bốn độ đo ở [`26`](26_do-do-danh-gia-wer-bleu-comet-rtf.md).

---

## Nhóm A — Thực nghiệm và đánh giá

### A1. Quy mô và chỉ số đánh giá đến đâu là đủ cho khoá luận?

**Câu hỏi thực chất là:** lấy gì làm **bằng chứng bằng số** rằng hệ thống dịch đúng, và
**bao nhiêu câu kiểm thử** thì đủ cho một khoá luận?

**Bối cảnh.** Đề cương ghi "bộ câu thoại kiểm thử quy mô nhỏ do sinh viên tự xây dựng",
đánh giá ASR bằng WER/CER, MT chủ yếu **thủ công**, chỉ số tự động chỉ bổ trợ. Hiện em đã có
script đo WER (ASR) và chrF (MT) chạy được bằng một lệnh.

**Năm cách chấm điểm đang cân nhắc:**

| Chỉ số    | Chấm khâu nào | Cách hoạt động                                                                                           |
| --------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| **WER**   | ASR           | Tỉ lệ **từ** nghe sai. Nói `hôm nay trời rất đẹp` → máy ra `hôm nay trời rất đẹt` = 1/5 → **20%**.       |
| **CER**   | ASR           | Như trên nhưng đếm **ký tự** — bắt buộc cho ja/zh vì `今日はいい天気です` viết liền, không tách từ được. |
| **chrF**  | MT            | So bản dịch máy với bản dịch mẫu do người làm, đếm cụm **ký tự** trùng. Thang 0–100, cao là tốt.         |
| **BLEU**  | MT            | Cũng vậy nhưng đếm cụm **từ** (thường 4 từ liên tiếp).                                                   |
| **COMET** | MT            | Chấm bằng một mô hình neural, sát cảm nhận người nhất.                                                   |

**Phương án em đề xuất.**

- **30 câu × 4 ngôn ngữ nguồn** (vi/en/ja/zh), gồm hội thoại thường + một ít thuật ngữ kỹ thuật.
- ASR: **WER** cho vi/en, **CER** cho ja/zh.
- MT: **chrF** làm chỉ số tự động + bảng chấm thủ công 3 mức (đúng nghĩa / thiếu ý / sai nghĩa).
- **Không dùng BLEU:** nó đòi trùng nguyên cụm 4 từ mới ăn điểm, nên câu dịch **đúng nghĩa
  nhưng diễn đạt khác** vẫn bị điểm thấp; với bộ chỉ 30 câu thì điểm dao động mạnh, không đáng tin.
- **Không dùng COMET:** phải tải thêm ~2 GB model, chạy chậm, và 30 câu thì quá ít để điểm
  có ý nghĩa thống kê.

**Cần thầy quyết.**

1. **30 câu/ngôn ngữ** có đủ không? — Nếu thầy muốn nhiều hơn thì em phải **bắt đầu thu âm
   và gõ lời ngay**, vì đây là việc thủ công tốn thời gian nhất trong phần còn lại của đồ án.
2. Có **bắt buộc phải có BLEU** không, dù em thấy nó không hợp với bộ câu nhỏ? Hội đồng
   thường quen nhìn BLEU trong báo cáo dịch máy.
3. **COMET** có cần không?

---

### A2. Đánh giá TTS: có phải làm MOS đúng chuẩn ITU-T P.800 không?

**Bối cảnh.** Đề cương có trích P.800 trong tài liệu tham khảo nhưng phần phương pháp chỉ
ghi "kiểm tra khả năng phát âm rõ ràng và mức độ người nghe hiểu được". MOS đúng chuẩn cần
tối thiểu ~15–20 người nghe trong điều kiện kiểm soát — em làm đồ án một mình, hệ đào tạo
từ xa, khó tổ chức.

**Phương án em đề xuất.** MOS **rút gọn**: 5 người nghe, mỗi người chấm 12 mẫu (3 mẫu × 4
ngôn ngữ) theo thang 1–5 về độ dễ nghe và độ dễ hiểu, báo cáo kèm ghi rõ đây **không** phải
MOS chuẩn P.800.

**Cần thầy quyết.** Chấp nhận MOS rút gọn có ghi chú, hay chỉ cần nhận xét định tính là đủ?

---

### A3. Ngưỡng nào được coi là "đạt" cho gần thời gian thực?

**Bối cảnh.** Số đo hiện tại (macOS, preset Balanced, audio 3 giây): vi→en **1,82 s**,
en→vi **1,77 s**, vi→ja **2,34 s**, vi→zh **2,61 s** — chưa tính thời gian người nói im lặng
để VAD chốt câu (~0,5 s nữa).

**Phương án em đề xuất.** Lấy mốc **≤ 3 s từ lúc dứt câu đến lúc nghe được bản dịch** là
"đạt" cho hội thoại luân phiên, và báo cáo kèm hệ số so với thời gian thực (0,6×).

**Cần thầy quyết.** Mốc 3 s có hợp lý để đưa vào tiêu chí nghiệm thu không? Hội đồng
thường kỳ vọng con số nào?

---

## Nhóm B — Dữ liệu và pháp lý

### B1. Lấy giọng người thật ở đâu cho hợp lệ?

**Bối cảnh.** WER chỉ có giá trị khi đo trên **giọng người thật** và câu tham chiếu do
**người gõ**. Em đã viết công cụ cắt đoạn (đã thử: tách 115 đoạn từ một bản ghi 8 phút),
nhưng bản ghi đó là vlog của người khác trên mạng.

**Ba lựa chọn:**

| Cách                                           | Ưu                                      | Nhược                                        |
| ---------------------------------------------- | --------------------------------------- | -------------------------------------------- |
| Tự thu giọng mình + 2–3 người quen             | Chủ động, không vướng bản quyền         | Ít giọng, thiên lệch vùng miền               |
| Common Voice (Mozilla, CC0) cho tiếng Việt/Anh | Có sẵn transcript chuẩn, trích dẫn được | Câu đọc rời rạc, không giống hội thoại họp   |
| Cắt từ video công khai trên mạng               | Giống hội thoại thật nhất               | Bản quyền + không có transcript, phải gõ tay |

**Phương án em đề xuất.** Chủ yếu **tự thu** (mình + 2–3 người quen, có ghi nhận đồng ý bằng
lời trong file ghi âm), bổ sung một phần **Common Voice** để có mẫu đa dạng hơn.

**Cần thầy quyết.** Hướng nào thầy thấy an toàn nhất? Trường có yêu cầu **phiếu đồng ý ghi âm**
bằng văn bản khi thu giọng người khác không?

---

### B2. Giấy phép NLLB-200 là CC-BY-NC-4.0 (phi thương mại)

**Bối cảnh.** Mô hình dịch chính của đề tài **cấm dùng thương mại**. Whisper (MIT), Silero
(MIT), sherpa-onnx (Apache-2.0) thì không vướng.

**Phương án em đề xuất.** Ghi rõ một mục "Giấy phép mô hình" trong báo cáo, nêu đây là sản
phẩm học thuật/demo phi thương mại, và ghi chú rằng nếu thương mại hoá thì phải thay MT bằng
mô hình giấy phép mở (kiến trúc hexagonal cho phép thay bằng **1 adapter**).

**Cần thầy quyết.** Cách ghi chú như vậy có đủ không, hay cần trình bày kỹ hơn?

---

## Nhóm C — Điều kiện thực nghiệm

### C1. Máy Windows 11 để đo đối chứng

**Bối cảnh.** Đề cương cam kết chạy trên **cả** Windows 11 và macOS. Toàn bộ số liệu hiện
có là của máy macOS Apple Silicon. Riêng Windows còn ba thứ chưa được kiểm chứng: thu âm
thanh hệ thống bằng **WASAPI loopback**, microphone ảo **VB-CABLE**, và hiệu năng TTS bản
**int8** (trên CPU x86 có AVX-VNNI nhiều khả năng nhanh hơn fp32 — ngược với kết quả trên ARM).

**Cần thầy hỗ trợ.** Khoa/lab có máy Windows 11 cho mượn vài buổi không? Nếu máy không có
GPU rời (chạy CPU-only) thì số đo có được chấp nhận không, hay bắt buộc phải có bản đo
trên GPU NVIDIA?

---

### C2. Kịch bản Google Meet cần người thứ hai

**Bối cảnh.** Hạng mục cuối của Tuần 7 (W7-4) là chạy thật trong một cuộc Meet: cài mic ảo,
chọn nó làm micro trong Meet, đeo tai nghe, và kiểm tra không bị vọng âm. Việc này **bắt buộc
có người thứ hai ở đầu bên kia**.

**Cần thầy hỗ trợ.** Thầy có thể dành ~20 phút vào một buổi để làm người đối thoại trong
phiên Meet thử (đồng thời là dịp thầy nghiệm thu trực tiếp) không? Nếu không, em nhờ người
quen và quay lại toàn bộ màn hình + audio làm bằng chứng.

---

## Nhóm D — Báo cáo và bảo vệ

### D1. Trọng tâm báo cáo nghiêng về đâu?

**Bối cảnh.** Đề tài **không đề xuất mô hình AI mới** — đóng góp nằm ở phần tích hợp hệ
thống: kiến trúc thay-thế-được, xử lý âm thanh hai chiều, chống vòng lặp, đo đạc độ trễ
từng khâu. Nhưng tên đề tài có chữ "mô hình AI" nên hội đồng có thể kỳ vọng phần mô hình.

**Phương án em đề xuất.** Tỉ trọng ~60% kỹ thuật hệ thống + đo đạc, ~40% khảo sát và lựa
chọn mô hình (kèm lý giải đánh đổi chất lượng/độ trễ/RAM qua ba preset Fast–Balanced–Quality).

**Cần thầy quyết.** Tỉ trọng này có hợp lý không? Có cần thêm một chương thực nghiệm so
sánh nhiều model ASR/MT khác nhau để phần "nghiên cứu" dày hơn không?

---

### D2. Có nên so sánh với giải pháp cloud làm đối chứng?

**Bối cảnh.** Một baseline tự nhiên là phụ đề dịch sẵn có của Google Meet. So sánh sẽ làm
rõ cái giá phải trả của việc chạy local (chất lượng thấp hơn) và cái được (riêng tư, không
phí, không cần mạng). Nhưng phạm vi đề tài ghi rõ "không dùng cloud **trong quá trình phiên dịch**".

**Phương án em đề xuất.** Có so sánh, nhưng chỉ như một **bảng đối chứng ngoài hệ thống**
(chạy tay vài câu, ghi kết quả), nói rõ đây không phải một thành phần của ứng dụng.

**Cần thầy quyết.** Nên làm hay bỏ? Nếu làm thì đặt ở chương khảo sát hay chương thực nghiệm?

---

### D3. Trích dẫn TranscriptionSuite cho đúng mực

**Bối cảnh.** Kiến trúc "Electron client + Python service" tham khảo từ dự án mã nguồn mở
TranscriptionSuite (đã ghi ở tài liệu tham khảo [1]). Em **không** dùng lại mã nguồn của họ,
nhưng có học cách họ tách tiến trình và cách tự tải model.

**Cần thầy quyết.** Cần trình bày ở mức nào để rõ ràng: một đoạn trong chương khảo sát, hay
một bảng "cái gì tham khảo / cái gì tự làm thêm" (MT, TTS, định tuyến âm thanh hai chiều,
mic ảo, đo đạc)?

---

### D4. Hình thức demo lúc bảo vệ

**Phương án em đề xuất.** **Video quay sẵn 3–4 phút** làm bản chính (không phụ thuộc mạng
phòng bảo vệ, không phụ thuộc người thứ hai), kèm **demo live rút gọn** trên laptop cá nhân
nếu hội đồng yêu cầu.

**Cần thầy quyết.** Thầy thấy nên ưu tiên cái nào? Trường có yêu cầu nộp video demo riêng không?

---

### D5. Mẫu báo cáo và mốc thời gian

**Cần thầy cho biết.**

- Mẫu (template) báo cáo khoá luận mới nhất của trường và số trang kỳ vọng.
- Hạn nộp bản nháp để thầy đọc trước — em dự kiến gửi **bản nháp đầy đủ trước hạn ít nhất 7 ngày**.
- Ngoài báo cáo + mã nguồn + video, còn phải nộp gì nữa (poster, tóm tắt, bản in...)?

---

## Tóm tắt việc cần thầy

| #   | Việc                                                 | Loại             |
| --- | ---------------------------------------------------- | ---------------- |
| A1  | Chốt quy mô bộ câu + chỉ số (BLEU/COMET có cần?)     | Quyết định       |
| A2  | Chấp nhận MOS rút gọn 5 người nghe?                  | Quyết định       |
| A3  | Chốt ngưỡng độ trễ "đạt"                             | Quyết định       |
| B1  | Hướng lấy giọng thật + có cần phiếu đồng ý?          | Tư vấn           |
| B2  | Cách ghi chú giấy phép NLLB phi thương mại           | Tư vấn           |
| C1  | **Mượn máy Windows 11**                              | Hỗ trợ nguồn lực |
| C2  | **20 phút làm người đối thoại trong phiên Meet thử** | Hỗ trợ nguồn lực |
| D1  | Tỉ trọng hệ thống / mô hình trong báo cáo            | Quyết định       |
| D2  | Có so sánh baseline cloud không                      | Quyết định       |
| D3  | Mức độ trình bày phần tham khảo TranscriptionSuite   | Tư vấn           |
| D4  | Video demo hay demo live                             | Quyết định       |
| D5  | Template báo cáo, hạn nộp nháp, danh mục nộp         | Thông tin        |
