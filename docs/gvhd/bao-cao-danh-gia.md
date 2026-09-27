# Báo cáo đánh giá hệ thống — WER/CER, spBLEU/chrF++, COMET, Total Inference Time và RTF

**Đề tài:** Xây dựng hệ thống dịch giọng nói đa ngôn ngữ gần thời gian thực bằng mô hình AI chạy cục bộ  
**Sinh viên:** Ngô Mạnh Hùng — 24410300 · **GVHD:** ThS. Nguyễn Thành Luân  
**Ngày:** 07/09/2026 · **Bổ sung:** 20/09/2026 · **Nguồn yêu cầu:** biên bản họp 19/08/2026, mục 3 và câu hỏi số 2

Báo cáo gồm 3 phần chính: cách đánh giá, kết quả đo và các vấn đề cần GVHD xác nhận.

**Hai phần cần GVHD xác nhận:** mục 3.5 về ngưỡng RTF và mục 9 về 5 vấn đề còn lại.

> **Mục 12 là phần bổ sung ngày 20/09.** Toàn bộ mục 1–11 giữ nguyên như bản đã gửi ngày
> 07/09 (số đo trên máy Apple M4). Sau đó em đã đo thêm trên máy Windows + card NVIDIA và
> ba trong bốn việc ở mục 11 đã xong — mục 13 ghi phần đó, và nêu hai chỗ làm **đổi kết
> luận** của mục 6 và mục 10.

---

## 1. Yêu cầu và mức độ hoàn thành

| Yêu cầu (biên bản mục 3)                                | Trạng thái | Kết quả                                                       |
| ------------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| Kiểm tra link FLEURS, xác nhận 4 ngôn ngữ, split `test` | Xong       | Đủ vi/en/zh/ja — mục 2                                        |
| Tìm hiểu WER, BLEU, COMET, RTF                          | Xong       | Mục 3                                                         |
| **(a)** WER cho ASR, từng ngôn ngữ                      | Xong       | 3.099 bản thu · vi 8,8% · en 4,8% · zh 8,1% · ja 4,7% — mục 4 |
| **(b)** BLEU + COMET cho MT, 6 chiều                    | Xong       | 2.022 cặp câu · spBLEU 10,96–37,13 · COMET 0,77–0,85 — mục 5  |
| **(c)** Total Inference Time + RTF                      | Xong       | 50 mẫu × 6 chiều · RTF p90 **0,395–0,786** — mục 6            |
| Tra công thức RTF + ngưỡng "đạt", báo cáo lại           | Xong       | **Mục 3.5** — cần GVHD duyệt                                  |
| **(d)** Thêm màn đánh giá vào trong ứng dụng            | Xong       | Chạy thật 22 câu, đủ 6 chiều — mục 7.2                        |

Toàn bộ số đo được thực hiện trên **Apple M4, macOS 26.6**, với `google/fleurs` split `test`, ngày 06–07/09/2026. Model chạy hoàn toàn cục bộ, không gọi API trong lúc dịch.

**Còn lại:**

- Chưa có lượt chạy đầy đủ của whisper.cpp để so với MLX.
- Chưa đo trên Windows + NVIDIA.
- Baseline cloud chưa có hướng dẫn; việc nhắc GVHD đang trễ 19 ngày so với mốc 2 tuần trong biên bản.

---

## 2. Dữ liệu đánh giá và cách tách lỗi

Dataset được kiểm tra bằng API của Hugging Face.

| Ngôn ngữ    | Config FLEURS | Có split `test` | Câu duy nhất ở `test` |
| ----------- | ------------- | --------------- | --------------------: |
| Tiếng Việt  | `vi_vn`       | có              |                   347 |
| Tiếng Anh   | `en_us`       | có              |                   347 |
| Tiếng Trung | `cmn_hans_cn` | có              |     346 (ghép với vi) |
| Tiếng Nhật  | `ja_jp`       | có              |     318 (ghép với vi) |

Cả 103 config đều có `train`/`validation`/`test`. Phần đánh giá dùng split `test` theo yêu cầu.

FLEURS có cùng `id` cho các câu tương ứng giữa các ngôn ngữ. Vì vậy có thể ghép câu trực tiếp để đánh giá MT, **không cần đi qua ASR**.

Một `id` có thể có nhiều bản thu. Với ASR giữ toàn bộ bản thu; với MT chỉ giữ một câu cho mỗi `id`. Với vi↔ja, lấy phần giao nên còn 318 cặp.

| Khâu          | Đánh giá                   | Đầu vào            |
| ------------- | -------------------------- | ------------------ |
| ASR           | WER (vi/en) · CER (zh/ja)  | Audio FLEURS       |
| MT            | spBLEU · chrF++ · COMET    | **Văn bản** FLEURS |
| Toàn hệ thống | Total Inference Time · RTF | Audio FLEURS       |

Tách riêng ASR và MT giúp xác định lỗi nằm ở bước nhận dạng hay bước dịch.

---

## 3. Các độ đo

### 3.1. WER và CER

**WER** đo số lỗi khi ASR chuyển audio thành văn bản:

$$\text{WER} = \frac{S + D + I}{N}$$

Trong đó:

- **S:** nghe nhầm từ
- **D:** bỏ sót từ
- **I:** thêm từ
- **N:** tổng số từ trong câu tham chiếu

WER càng thấp càng tốt.

Ví dụ: câu `"độ trễ hiện tại là hai giây"` thành `"vụ trễ hiện tại hai giây"` có 1 từ nghe nhầm và 1 từ bị bỏ sót, nên WER = 33,3%.

**Lưu ý:**

- WER có thể lớn hơn 100% vì lỗi thêm từ không bị giới hạn.
- Báo cáo tính lỗi trên toàn bộ tập test, không lấy trung bình WER của từng câu.
- WER chỉ đo khác nhau về từ, không đánh giá được mức độ thay đổi ý nghĩa.

**CER** cũng dùng khoảng cách Levenshtein nhưng tính trên ký tự. Tiếng Trung và tiếng Nhật không tách từ bằng khoảng trắng nên báo cáo dùng CER cho hai ngôn ngữ này.

WER và CER khác đơn vị nên **không lấy trung bình để so sánh bốn ngôn ngữ**.

Mốc tham khảo trong báo cáo:

- Dưới 5%: tốt trên audio sạch
- 5–10%: có thể dùng cho phụ đề
- 10–20%: vẫn hiểu được nhưng lỗi rõ
- Trên 25%: khó dùng để dịch tiếp

### 3.2. spBLEU và chrF++

**spBLEU** đo mức độ trùng giữa bản dịch máy và bản dịch tham chiếu dựa trên các n-gram. Điểm càng cao càng tốt.

Báo cáo dùng tokenizer `flores200` của FLORES-101. Cách này phù hợp với nhiều ngôn ngữ, trong đó có tiếng Trung và tiếng Nhật, và giúp kết quả có thể đặt cạnh số liệu của NLLB-200.

**chrF++** đánh giá dựa trên n-gram ký tự và thêm n-gram từ. Độ đo này ít phụ thuộc vào cách tách từ hơn BLEU.

Tuy nhiên, phần n-gram từ của chrF++ không phù hợp với zh/ja vì hai ngôn ngữ này không dùng khoảng trắng để tách từ. Vì vậy các kết quả chrF++ của zh/ja được đánh dấu riêng và không nên so trực tiếp với các ngôn ngữ còn lại.

Mốc tham khảo cho spBLEU:

- Dưới 20: khó hiểu
- 20–30: hiểu được ý nhưng câu còn vụng
- 30–40: chất lượng khá
- Trên 40: tốt

Không nên so BLEU/spBLEU giữa các cặp ngôn ngữ khác nhau chỉ dựa trên cùng một con số.

### 3.3. COMET

COMET đánh giá chất lượng dịch dựa trên **ý nghĩa**, thay vì chỉ đếm mức độ trùng từ như BLEU.

COMET nhận 3 đầu vào: câu nguồn, bản dịch máy và bản dịch tham chiếu. Báo cáo dùng checkpoint `Unbabel/wmt22-comet-da`.

Điểm COMET **không phải phần trăm**. Ví dụ 0,85 không có nghĩa là dịch đúng 85%.

COMET phù hợp để đánh giá chất lượng dịch, nhưng cần so sánh các model trên cùng checkpoint và cùng tập test.

Trong báo cáo:

- **COMET:** dùng để đánh giá chất lượng theo nghĩa.
- **spBLEU/chrF++:** dùng để đối chiếu bằng các độ đo dựa trên chuỗi.

COMET chạy ở môi trường riêng do xung đột thư viện với môi trường NLLB. Việc này chỉ phục vụ đánh giá offline và không nằm trong ứng dụng.

### 3.4. RTF

$$\text{RTF} = \frac{\text{thời gian xử lý}}{\text{thời lượng audio}}$$

RTF cho biết hệ thống xử lý nhanh hay chậm so với tốc độ nói. **RTF < 1** nghĩa là xử lý nhanh hơn thời gian thực; càng thấp càng tốt.

Trong báo cáo, Total Inference Time gồm:

**VAD → Whisper → NLLB → TTS**

Có tài liệu dùng chiều ngược lại là audio/thời gian xử lý. Báo cáo này dùng **thời gian xử lý/audio**.

### 3.5. Ngưỡng RTF

Có hai mức được đề xuất:

- **RTF p90 < 1:** điều kiện tối thiểu để hệ thống theo kịp luồng nói.
- **RTF p90 ≤ 0,5:** mức mục tiêu để có thêm dư địa khi máy còn chạy các tác vụ khác.

Báo cáo dùng **p90** thay vì trung bình để tránh trường hợp trung bình thấp nhưng một số câu dài xử lý quá chậm.

| Mức                  | Điều kiện                                   | Ý nghĩa                         |
| -------------------- | ------------------------------------------- | ------------------------------- |
| **Không đạt**        | RTF p90 ≥ 1                                 | Không theo kịp tốc độ nói       |
| **Đạt tối thiểu**    | RTF p90 < 1                                 | Theo kịp nhưng ít dư địa        |
| **Đạt để dùng thật** | **RTF p90 ≤ 0,5** và độ trễ cảm nhận ≤ ~3 s | Có thêm dư địa khi chạy thực tế |

RTF chỉ đo **thời gian tính toán**. Độ trễ người dùng cảm nhận còn có thời gian VAD chờ xác nhận hết câu và thời gian thu/phát.

Vì vậy báo cáo tách riêng cột **“chờ chốt”**, không đưa thời gian này vào RTF.

Mốc độ trễ cảm nhận đề xuất là **~3 giây**, lấy căn cứ từ nghiên cứu về phiên dịch:
ear-voice span của phiên dịch viên người thật trung bình khoảng 3 giây; phiên dịch viên
chịu được khoảng 3 giây độ trễ do công cụ thêm vào mà độ chính xác không giảm rõ rệt; và
người nghe hệ thống dịch nói đa số chọn mức 3–4 giây.

Báo cáo **cố ý không dùng** mốc 150 ms của ITU-T G.114, dù mốc này hay bị trích cho hệ
thống phiên dịch: G.114 là mốc cho **truyền dẫn thoại** (VoIP) — nó đo đường truyền chứ
không đo việc dịch, và bản thân người phiên dịch cũng trễ vài giây.

### 3.6. Tóm tắt

|             | WER / CER           | spBLEU                      | COMET                 | RTF                              |
| ----------- | ------------------- | --------------------------- | --------------------- | -------------------------------- |
| Đo cái gì   | ASR chép đúng không | Mức độ trùng với tham chiếu | Chất lượng theo nghĩa | Có theo kịp thời gian thực không |
| Kiểu đo     | Đếm lỗi             | Đếm n-gram                  | Mô hình neural        | Tỉ số thời gian                  |
| Thang       | 0 → ∞, **thấp tốt** | 0–100, **cao tốt**          | 0–1, **cao tốt**      | 0 → ∞, **thấp tốt**              |
| Mức đề xuất | ≤ 10%               | ≥ 30                        | Dùng để xếp hạng      | **p90 ≤ 0,5**                    |

---

## 4. Kết quả (a) — ASR trên toàn bộ FLEURS `test`

**3.099 bản thu, 10,22 giờ audio, 86 phút chạy.** Không có câu rỗng ở cả bốn ngôn ngữ.

Model: `mlx-community/whisper-large-v3-asr-8bit`, chạy trên Metal. Bộ lọc câu ma được tắt để đo trực tiếp chất lượng của model.

| Ngôn ngữ | Chỉ số | Giá trị |   Bản thu |         Audio |           ASR |       RTF | Câu rỗng |
| -------- | ------ | ------: | --------: | ------------: | ------------: | --------: | -------: |
| vi       | WER    |    8,8% |       857 |      10.814 s |       1.589 s |      0,15 |        0 |
| en       | WER    |    4,8% |       647 |       6.388 s |         911 s |      0,14 |        0 |
| zh       | CER    |    8,1% |       945 |      11.065 s |       1.577 s |      0,14 |        0 |
| ja       | CER    |    4,7% |       650 |       8.511 s |       1.105 s |      0,13 |        0 |
| **Gộp**  |        |         | **3.099** | **10,22 giờ** | **86,4 phút** | **0,141** |    **0** |

**Nhận xét:**

- Tiếng Việt có WER cao nhất: **8,8%**.
- Tiếng Anh: **4,8%**; tiếng Trung: **8,1%**; tiếng Nhật: **4,7%**.
- Không có câu rỗng.
- RTF khoảng **0,13–0,15** chỉ là RTF của ASR, chưa bao gồm MT và TTS.
- FLEURS là dữ liệu đọc rõ, ít nhiễu nên kết quả có thể tốt hơn khi chạy với giọng nói trong cuộc họp thực tế.

---

## 5. Kết quả (b) — MT trên 6 chiều

**2.022 cặp câu, 27,6 phút chạy.** Model `facebook/nllb-200-distilled-600M`.

Các câu được ghép theo `id` nên MT được đánh giá trực tiếp trên văn bản, không qua ASR.

| Chiều dịch | Câu | spBLEU |  chrF++ |      COMET |
| ---------- | --: | -----: | ------: | ---------: |
| vi→en      | 347 |  35,79 |   57,10 |     0,8525 |
| en→vi      | 347 |  37,13 |   54,69 |     0,8505 |
| vi→zh      | 346 |  17,15 | _16,14_ | **0,7729** |
| zh→vi      | 346 |  22,33 |   42,77 |     0,8213 |
| vi→ja      | 318 |  10,96 | _19,88_ |     0,8239 |
| ja→vi      | 318 |  19,91 |   40,19 |     0,8191 |

**Nhận xét:**

- **vi→zh là chiều yếu nhất theo cả spBLEU và COMET.**
- vi→ja có spBLEU thấp nhất (**10,96**) nhưng COMET (**0,8239**) cao hơn vi→zh (**0,7729**). Hai độ đo có thể cho thứ hạng khác nhau vì cách đánh giá khác nhau.
- chrF++ của zh/ja không nên so trực tiếp với các ngôn ngữ khác do vấn đề tách từ.
- Vì vậy, nếu cần ưu tiên cải thiện chất lượng dịch, báo cáo đề xuất tập trung vào **vi→zh**, thay vì ja→vi như kế hoạch ban đầu.
- Không lấy trung bình sáu chiều vì độ khó và đặc điểm từng cặp ngôn ngữ khác nhau.

---

## 6. Kết quả (c) — Total Inference Time và RTF

Có **50 mẫu mỗi chiều**, dùng cùng cấu hình đã đo WER.

| Chiều | Mẫu |  VAD |     ASR |      MT |     TTS |  Tổng TB |  Tổng p90 | RTF TB |   RTF p90 | Chờ chốt |
| ----- | --: | ---: | ------: | ------: | ------: | -------: | --------: | -----: | --------: | -------: |
| vi→en |  50 | 53ms | 4.595ms | 1.129ms |   318ms | 6.095 ms | 10.176 ms |  0,486 |     0,580 |    256ms |
| en→vi |  50 | 46ms | 2.421ms |   953ms |   273ms | 3.693 ms |  5.511 ms |  0,392 | **0,496** |    202ms |
| vi→zh |  50 | 52ms | 4.598ms | 1.134ms | 1.693ms | 7.478 ms | 12.593 ms |  0,595 |     0,727 |    256ms |
| zh→vi |  50 | 48ms | 2.623ms |   965ms |   274ms | 3.911 ms |  5.460 ms |  0,375 |     0,509 |    200ms |
| vi→ja |  50 | 55ms | 4.646ms | 1.025ms | 2.261ms | 7.987 ms | 13.256 ms |  0,639 | **0,786** |    256ms |
| ja→vi |  50 | 55ms | 2.859ms | 1.052ms |   290ms | 4.255 ms |  6.367 ms |  0,324 | **0,395** |    211ms |

### Đánh giá theo ngưỡng

| Mức                  | Chiều đạt                              |
| -------------------- | -------------------------------------- |
| **Đạt tối thiểu**    | **Cả 6 chiều** — xấu nhất vi→ja: 0,786 |
| **Đạt để dùng thật** | ja→vi 0,395 · en→vi 0,496              |
| **Không đạt**        | Không có                               |

**Kết luận:** cả 6 chiều đều đạt RTF p90 < 1. Tuy nhiên, chỉ 2 chiều đạt mức đề xuất p90 ≤ 0,5.

> _Đính chính 27/09/2026:_ bản gửi ngày 07/09 ghi "3 chiều đạt" và xếp zh→vi vào nhóm
> đạt. Đó là lỗi số học của em: zh→vi là 0,509, lớn hơn 0,5 nên **không** đạt, dù chỉ
> trượt sát mép. Số đo trong bảng không đổi, chỉ cách xếp nhóm và câu nhận xét ngay dưới
> đây được sửa lại cho đúng.

Bốn chiều chưa đạt gồm ba chiều **nguồn tiếng Việt** và chiều zh→vi. Nguyên nhân chính:

1. **ASR tiếng Việt chậm hơn**, khoảng 4,6 giây so với 2,4–2,9 giây ở các chiều nguồn khác.
2. **TTS tiếng Trung/Nhật chậm hơn**, đặc biệt TTS tiếng Nhật.

MT có thời gian khoảng 950–1.130 ms ở cả sáu chiều nên chưa phải phần cần ưu tiên tối ưu.

Nếu muốn cải thiện vi→ja xuống ≤ 0,5, nên ưu tiên **ASR tiếng Việt và TTS tiếng Nhật**.

**Lưu ý:** Tổng p90 10–13 giây ở các chiều nguồn tiếng Việt là thời gian xử lý toàn bộ một phát ngôn FLEURS dài khoảng 12 giây. RTF mới là chỉ số phù hợp để đánh giá khả năng theo kịp luồng nói liên tục.

Cột “chờ chốt câu” khoảng 200–256 ms là thời gian VAD chờ người nói dứt câu, không tính vào RTF.

---

## 7. Hai phần bổ trợ

### 7.1. Chọn model

Để chọn model, các model được chạy trên cùng 20 câu đầu tiếng Việt của FLEURS `test`, cùng tham số và cùng Apple M4.

| Model                                   | Trên đĩa |    WER |   RTF | Ước tính chạy đầy đủ 4 ngôn ngữ |
| --------------------------------------- | -------: | -----: | ----: | ------------------------------: |
| `whisper-large-v3-asr-fp16` (MLX)       |   2,9 GB |   6,7% |  0,18 |                       ~110 phút |
| `whisper-large-v3-asr-8bit` (MLX)       |   1,2 GB |   6,7% |  0,14 |          ~86 phút ← **đã chọn** |
| `whisper-large-v3-asr-4bit` (MLX)       |   852 MB |   7,2% |  0,13 |                        ~80 phút |
| `whisper-large-v3-turbo-asr-fp16` (MLX) |   1,5 GB |   8,1% |  0,08 |                        ~49 phút |
| `whisper-large-v3-turbo-asr-8bit` (MLX) |   829 MB |   8,1% |  0,08 |                        ~49 phút |
| `whisper-large-v3-turbo-asr-4bit` (MLX) |   447 MB |   8,9% |  0,08 |                        ~49 phút |
| `whisper-small-asr-fp16` (MLX)          |   490 MB | 133,5% |  0,14 |                 không dùng được |
| `large-v3-turbo-q5_0` (whisper.cpp)     |   570 MB |   8,6% | 0,089 |                        ~55 phút |

**Kết luận:**

- `large-v3 8bit` giữ nguyên WER so với fp16 nhưng nhỏ hơn và nhanh hơn → được chọn.
- Turbo nhanh gần gấp đôi nhưng WER tăng → phù hợp nếu ưu tiên tốc độ.
- Bản `small` của mlx-community có WER 133,5% và 10/20 câu rỗng nên không dùng.

Bảng này chỉ có 20 câu tiếng Việt nên chủ yếu dùng để **chọn model**, không dùng làm kết quả WER chính. Kết quả báo cáo chính vẫn là 8,8% trên toàn bộ FLEURS.

### 7.2. Màn hình đánh giá trong ứng dụng

Màn đánh giá đã hoàn thành và chạy thử với **22 câu**, đủ 6 chiều:

- Tỷ lệ lỗi nhận dạng: **6,7%**
- chrF: **43,9%**
- ASR p50 / p90: **819 / 856 ms**
- Dịch p90: **396 ms**
- Tổng p90: **1.227 ms**
- RTF p90: **0,818**

Màn hình dịch trực tiếp từ câu tham chiếu để đánh giá MT, không dùng kết quả ASR làm đầu vào. Những câu không có audio dùng giọng tổng hợp và có cảnh báo riêng.

**Lưu ý:** RTF p90 **0,818** ở màn đánh giá chỉ tính **ASR + MT**, không có TTS. Vì vậy không dùng con số này thay cho RTF **0,395–0,786** ở mục 6.

---

## 8. Ba chỗ làm khác kế hoạch, và lý do

**Dùng CER cho tiếng Trung và tiếng Nhật.** Kế hoạch ghi "WER" cho cả bốn ngôn ngữ, nhưng
zh/ja không tách từ bằng khoảng trắng nên chấm WER thực chất là chấm theo chỗ Whisper
_tình cờ_ chèn dấu cách — cùng một câu đúng nghĩa có thể ra 0% hay 100%. Bài báo FLEURS
và bài báo Whisper đều dùng CER cho nhóm CJK. Bảng kết quả ghi rõ từng dòng đang là chỉ
số nào, và **không** có dòng "trung bình bốn ngôn ngữ" vì WER với CER không so được với
nhau.

**COMET phải chạy ở môi trường riêng.** `unbabel-comet` ghim `numpy<2` và
`transformers<5`, trong khi NLLB cần `numpy>=2.4` và `transformers>=5.14` — hai bộ ràng
buộc này không cùng tồn tại trong một môi trường. Giải pháp là một script độc lập tự dựng
môi trường riêng, đọc file kết quả của bước dịch rồi ghi điểm COMET ngược vào. Xin nói
thêm: COMET chỉ chạy ở khâu **đánh giá offline**, không nằm trong ứng dụng người dùng
cài, nên nó không vi phạm nguyên tắc "chạy hoàn toàn cục bộ" của đề tài.

**Chọn model bằng số đo, không bằng suy đoán.** Biên bản mục 5 ghi hội đồng sẽ hỏi "tại
sao chọn những mô hình này". Bảng ở mục 7.1 là câu trả lời: 7 bản Whisper đo trên cùng
20 câu trước khi chạy bản đầy đủ, rút ra ba điều — lượng tử hoá 8-bit **không đổi WER**
so với fp16 (6,7% cả hai) nhưng nhỏ hơn 2,3 lần và nhanh hơn 22%; bản turbo nhanh gấp đôi
nhưng mất 1,4 điểm WER (đây là cơ sở cho ba preset Nhanh / Cân bằng / Chất lượng); và họ
model `small` của mlx-community **hỏng** — WER 133,5% do kẹt vòng lặp lặp chữ, trong khi
bản cùng cỡ ở định dạng khác chạy bình thường, nên lỗi nằm ở bản chuyển đổi chứ không
phải ở cỡ model.

---

## 9. Các điểm cần GVHD xác nhận

1. **CER thay WER cho zh/ja** — có tiếp tục dùng cách này không?
2. **Ngưỡng RTF:** dùng **p90 < 1** hay **p90 ≤ 0,5** làm ngưỡng đạt?
3. **Ngưỡng độ trễ cảm nhận:** có dùng mức **≤ ~3 giây** không?
4. **chrF++:** dùng làm độ đo MT chính thức hay chỉ để tham khảo?
5. **COMET:** có cần ghi việc chạy ở môi trường riêng trong nội dung chính hay đưa xuống phụ lục?

---

## 10. Hạn chế

- **FLEURS là giọng đọc**, không phải giọng họp. Vì vậy WER và RTF thực tế có thể xấu hơn.
- Chưa chuẩn hóa số và viết tắt khi tính WER, nên một số trường hợp nghe đúng nhưng vẫn bị tính là lỗi.
- RTF phụ thuộc phần cứng. Kết quả hiện tại chỉ phản ánh **Apple M4 + Metal**.
- Chưa có baseline cloud.
- WER/CER, spBLEU/chrF++ và COMET có thể lặp lại gần như giống nhau khi dùng cùng cấu hình; RTF sẽ thay đổi theo phần cứng.

---

## 11. Việc còn lại

- [ ] Chạy đầy đủ whisper.cpp để so sánh công bằng với MLX.
- [ ] Đo trên Windows + NVIDIA.
- [ ] Chuẩn bị bộ audio giọng nói hội thoại thực tế.
- [ ] Xác định baseline cloud theo hướng dẫn của GVHD.

Số liệu thô của các lượt chạy được lưu dạng JSON, gồm cả từng câu dịch của 2.022 câu MT để có thể kiểm tra lại khi cần.

---

## 12. Nguồn trích dẫn

**Độ đo ASR**

- Conneau, A. và cộng sự (2022). _FLEURS: Few-shot Learning Evaluation of Universal Representations of Speech._ — bộ dữ liệu của đề tài; dùng CER cho nhóm CJK.  
  <https://arxiv.org/pdf/2205.12446>
- Radford, A. và cộng sự (2023). _Robust Speech Recognition via Large-Scale Weak Supervision_ (Whisper).  
  <https://github.com/openai/whisper>
- Thông báo phát hành `large-v3`.  
  <https://github.com/openai/whisper/discussions/1762>
- _Advocating Character Error Rate for Multilingual ASR Evaluation_ (Findings of NAACL 2025).  
  <https://aclanthology.org/2025.findings-naacl.277.pdf>

**Độ đo MT**

- Papineni, K. và cộng sự (2002). _BLEU: a Method for Automatic Evaluation of Machine Translation._  
  <https://aclanthology.org/P02-1040/>
- Post, M. (2018). _A Call for Clarity in Reporting BLEU Scores._  
  <https://aclanthology.org/W18-6319/>
- Goyal, N. và cộng sự (2022). _The FLORES-101 Evaluation Benchmark._  
  <https://arxiv.org/pdf/2106.03193>
- NLLB Team (2022). _No Language Left Behind: Scaling Human-Centered Machine Translation._  
  <https://arxiv.org/pdf/2207.04672>
- Rei, R. và cộng sự (2022). _COMET-22: Unbabel-IST 2022 Submission for the Metrics Shared Task._  
  <https://aclanthology.org/2022.wmt-1.52/>
- Freitag, M. và cộng sự (2022). _Results of WMT22 Metrics Shared Task: Stop Using BLEU._  
  <https://statmt.org/wmt22/pdf/2022.wmt-1.2.pdf>
- Unbabel. _Introducing Unbabel-COMET v2.0._  
  <https://unbabel.com/introducing-unbabel-comet-v2-0-improved-models-and-metrics-for-better-machine-translation-evaluation/>
- Google Cloud Translation. _The BLEU translation quality metric._  
  <https://docs.cloud.google.com/translate/docs/bleu-scores>

**RTF và độ trễ**

- ExKaldi-RT (2021) — RTF trong hệ ASR trực tuyến.  
  <https://arxiv.org/pdf/2104.01384>
- _Conformer-Based Speech Recognition On Extreme Edge-Computing Devices_ (Apple, 2023).  
  <https://arxiv.org/pdf/2312.10359>
- _Evaluation of real-time transcriptions using end-to-end ASR models_ (2024).  
  <https://arxiv.org/html/2409.05674v1>
- _Low Latency ASR for Simultaneous Speech Translation_ (2020).  
  <https://arxiv.org/pdf/2003.09891>
- _Defining maximum acceptable latency of AI-enhanced CAI tools_ (2022).  
  <https://arxiv.org/pdf/2201.02792>
- _Spatial Speech Translation: Translating Across Space With Binaural Hearables_ (2025).  
  <https://arxiv.org/pdf/2504.18715>
- Lee, T.-H. _Ear Voice Span in English into Korean Simultaneous Interpretation._
- ITU-T Recommendation G.114.  
  <https://www.itu.int/rec/T-REC-G.114>

---

## 13. Bổ sung ngày 20/09/2026 — đo trên máy Windows + NVIDIA

Máy đo: Windows 11, Intel Core i5-12500H, NVIDIA GeForce RTX 4060 Laptop (8 GB), RAM 16 GB.
Cùng bộ `google/fleurs` split `test`, cùng số mẫu như mục 4 và mục 6.

### 13.1. Mục 11 — ba việc đã xong

| Việc (mục 11)                                   | Trạng thái 20/09                                         |
| ----------------------------------------------- | -------------------------------------------------------- |
| Chạy đầy đủ whisper.cpp để so công bằng với MLX | **Xong** — mục 13.2                                      |
| Đo trên Windows + NVIDIA                        | **Xong** — mục 13.2 và 13.3                              |
| Chuẩn bị bộ audio giọng nói hội thoại thực tế   | **Chưa** — vẫn là việc còn lại lớn nhất                  |
| Xác định baseline cloud theo hướng dẫn của GVHD | **Xin phép bỏ** — lý do ở mục 13.5, mong thầy cho ý kiến |

### 13.2. Mục (a) — cùng 3.099 bản thu, ba runtime ASR

| Runtime (máy)                    | vi (WER)  | en (WER) | zh (CER) | ja (CER) | RTF khâu ASR |
| -------------------------------- | --------- | -------- | -------- | -------- | ------------ |
| MLX / Metal — Apple M4 (mục 4)   | **8,8 %** | 4,8 %    | 8,1 %    | 4,7 %    | 0,141        |
| faster-whisper / CUDA — RTX 4060 | 9,2 %     | 5,0 %    | 8,3 %    | 4,7 %    | 0,034        |
| whisper.cpp / Vulkan — RTX 4060  | 10,4 %    | 5,0 %    | 8,6 %    | 4,9 %    | 0,018        |

Ba runtime xếp cùng một thứ tự ở cả bốn ngôn ngữ. Cần nói rõ để không đọc quá lên: đây
là ba **model khác nhau** (`large-v3` 8bit, `large-v3-turbo` fp16, `large-v3-turbo`
q5_0) vì ba runtime không dùng chung định dạng model, nên bảng này so **cấu hình**, không
so thuần runtime. Cặp so được sạch nhất là hai dòng dưới — cùng `large-v3-turbo`, chỉ
khác mức lượng tử hoá: q5_0 kém fp16 1,2 điểm WER tiếng Việt, đổi lại nhanh gấp đôi.

Hai cột RTF cuối không so được với dòng đầu vì khác máy.

### 13.3. Mục (c) — độ trễ, và chỗ này làm đổi kết luận của mục 6

| Chiều | ASR   | MT    | TTS     | Tổng TB  | RTF p90 (Windows) | RTF p90 (M4, mục 6) |
| ----- | ----- | ----- | ------- | -------- | ----------------- | ------------------- |
| vi→en | 570ms | 459ms | 373ms   | 1.531 ms | **0,146**         | 0,580               |
| en→vi | 308ms | 390ms | 327ms   | 1.137 ms | **0,148**         | 0,496               |
| vi→zh | 577ms | 458ms | 1.969ms | 3.133 ms | **0,273**         | 0,727               |
| zh→vi | 330ms | 392ms | 336ms   | 1.177 ms | **0,147**         | 0,509               |
| vi→ja | 612ms | 507ms | 2.510ms | 3.833 ms | **0,383**         | 0,786               |
| ja→vi | 360ms | 440ms | 352ms   | 1.288 ms | **0,114**         | 0,395               |

**Cả sáu chiều đạt mức đề xuất p90 ≤ 0,5**, trong khi ở mục 6 chỉ có hai chiều đạt. Vì vậy
hai câu kết luận của mục 6 chỉ còn đúng cho cấu hình Apple M4:

1. "Ba chiều chưa đạt đều có tiếng Việt ở đầu vào" — trên Windows không còn chiều nào chưa đạt.
2. "Nên ưu tiên ASR tiếng Việt và TTS tiếng Nhật" — **ASR không còn là khâu tốn nhất**.
   Giờ TTS chiếm 65% toàn chuỗi ở chiều vi→ja và 63% ở vi→zh, còn ASR chỉ 15–18%. Chỗ
   đáng tối ưu tiếp theo là **TTS cho hai đích ja/zh**, và nó đang chạy CPU.

Nguyên nhân của mức chênh: khâu ASR chạy GPU qua Vulkan, và khâu dịch (NLLB) trước đây
luôn chạy CPU do thiếu nhánh chọn thiết bị CUDA — sửa xong thì cùng một bộ câu, cùng một
máy, thời gian dịch trung vị giảm từ 789 ms xuống 181 ms.

### 13.4. Hai phép đo bổ sung

**Chạy liên tục 60 phút** (tiêu chí nghiệm thu số 14 của SPEC), lần đầu chạy với model
thật: **877 phát ngôn, 0 lỗi**, độ trễ p50 443 ms / p95 541 ms, độ trễ **không trôi**
(+2 ms giữa 10% đầu và 10% cuối), bộ nhớ service 1.110 → 1.122 MB.

**Rút ngắn ngữ cảnh encoder của Whisper** (`audio_ctx` 768 thay vì 1500) — một mẹo tăng
tốc hay được nhắc tới. Đo trên cùng 3.099 bản thu: WER/CER hỏng hẳn — vi 10,4 → 33,7%,
en 5,0 → 31,4%, zh 8,6 → 45,1%, ja 4,9 → 46,5% — đổi lại chỉ nhanh hơn 6–26% thời gian
ASR. Kết luận: không dùng. Em ghi lại đây vì đây là một điểm đo cho phần "đánh đổi độ
trễ ↔ chất lượng" mà thầy có thể sẽ hỏi.

### 13.5. Hai điểm xin thầy cho ý kiến

1. **Ngưỡng RTF (câu 2 của mục 9) giờ có hai đáp án khác nhau theo máy.** Nếu thầy chốt
   p90 ≤ 0,5 thì bản Windows đạt cả sáu chiều còn bản macOS chỉ đạt ba. Em đề nghị báo
   cáo ghi cả hai bảng kèm cấu hình máy, thay vì chọn một máy để báo cáo.
2. **Baseline cloud (Ưu tiên 3):** em xin phép bỏ. Mục đích của nó là có một mốc để đối
   chiếu chất lượng, và mốc đó giờ đã có từ hai nguồn: bảng ba runtime ở mục 13.2 và
   điểm COMET ở mục 5. Ngoài ra việc gọi API cloud đi ngược yêu cầu "chạy hoàn toàn cục
   bộ" của đề tài. Nếu thầy vẫn muốn có, em sẽ làm.

Số liệu thô của toàn bộ các lượt đo ở trên được lưu dạng JSON trong mã nguồn
(`docs/results/`), gồm cả từng mẫu của mỗi chiều.
