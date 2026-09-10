# Báo cáo GVHD — Bộ đánh giá: kết quả đo và ngưỡng đề xuất

**Đề tài:** Xây dựng hệ thống dịch giọng nói đa ngôn ngữ gần thời gian thực bằng mô hình AI chạy cục bộ
**Sinh viên:** Ngô Mạnh Hùng — 24410300 · **GVHD:** ThS. Nguyễn Thành Luân
**Ngày:** 07/09/2026 · **Nguồn yêu cầu:** biên bản họp 19/08/2026, mục 3 và câu hỏi số 2

> Gửi kèm một file nữa — **Phụ lục: bốn độ đo** — chứa công thức đầy đủ, ví dụ tính tay,
> các bẫy khi diễn giải và danh sách nguồn trích dẫn. File này là phần kết quả; file kia
> là phần lý thuyết. Hai file đọc độc lập được.
>
> **Mục 3** (công thức RTF + ngưỡng đề xuất) và **mục 9** (5 điểm cần thầy chốt) là hai
> phần em xin thầy cho ý kiến.

---

## 1. Thầy giao gì, em làm tới đâu

| Thầy giao (biên bản mục 3)                              | Trạng thái | Kết quả                                                       |
| ------------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| Kiểm tra link FLEURS, xác nhận 4 ngôn ngữ, split `test` | Xong       | Đủ vi/en/zh/ja — mục 2                                        |
| Tự tìm hiểu WER, BLEU, COMET, RTF                       | Xong       | File phụ lục gửi kèm                                          |
| **(a)** WER cho ASR, từng ngôn ngữ                      | Xong       | 3.099 bản thu · vi 8,8% · en 4,8% · zh 8,1% · ja 4,7% — mục 4 |
| **(b)** BLEU + COMET cho MT, 6 chiều                    | Xong       | 2.022 cặp câu · spBLEU 10,96–37,13 · COMET 0,77–0,85 — mục 5  |
| **(c)** Total Inference Time + RTF                      | Xong       | 50 mẫu × 6 chiều · RTF p90 **0,395–0,786** — mục 6            |
| Tra công thức RTF + ngưỡng "đạt", báo cáo lại           | Xong       | **Mục 3** — phần cần thầy duyệt                               |
| **(d)** Thêm màn đánh giá vào trong ứng dụng            | Xong       | Chạy thật 22 câu, đủ 6 chiều — mục 7                          |

Toàn bộ số đo trên **Apple M4, macOS 26.6**, dữ liệu `google/fleurs` split `test`, ngày
06–07/09/2026. Model chạy hoàn toàn cục bộ, không gọi API nào trong lúc dịch.

Ba việc còn treo em xin báo luôn thay vì để thầy hỏi: chưa có lượt chạy đầy đủ của
whisper.cpp để so cùng thang với MLX, chưa đo trên Windows + NVIDIA, và **em đang trễ
việc nhắc thầy về baseline cloud** (biên bản ghi "nhắc sau 2 tuần", tính tới hôm nay là
19 ngày).

---

## 2. Kiểm tra dataset — việc thầy dặn làm trước

Em kiểm bằng API của Hugging Face chứ không chỉ mở Dataset Viewer:

| Ngôn ngữ    | Config FLEURS | Có split `test` | Câu duy nhất ở `test` |
| ----------- | ------------- | --------------- | --------------------- |
| Tiếng Việt  | `vi_vn`       | có              | 347                   |
| Tiếng Anh   | `en_us`       | có              | 347                   |
| Tiếng Trung | `cmn_hans_cn` | có              | 346 (ghép với vi)     |
| Tiếng Nhật  | `ja_jp`       | có              | 318 (ghép với vi)     |

Cả 103 config đều có đủ ba split. Phần đo dùng **`test`** đúng như thầy dặn.

Hai tính chất của FLEURS quyết định cách em viết code. Thứ nhất, **FLEURS là bản tiếng
nói của FLoRes**: mỗi câu mang một `id` dùng chung giữa mọi ngôn ngữ, nên ghép theo `id`
là ra ngay cặp câu song ngữ — phần đánh giá MT **không phải đi qua ASR**, đúng ý thầy là
tách bạch lỗi từng khối. Thứ hai, **một `id` có nhiều bản thu**: với ASR đó là các mẫu
khác nhau nên giữ hết, còn với MT phải khử trùng lặp theo `id`. Con số 318 cặp cho vi↔ja
là do bản ghi tiếng Nhật thiếu một ít câu; code lấy **giao** của hai tập `id` nên không
bao giờ so lệch cặp.

---

## 3. RTF — phần thầy dặn tra rồi báo cáo lại

### Công thức

$$\text{RTF} = \frac{\text{thời gian xử lý (wall-clock)}}{\text{thời lượng audio đầu vào}}$$

Đây là định nghĩa dùng trong Kaldi, whisper.cpp, ESPnet và các bài báo ASR: **máy giải mã
chậm hơn người nói bao nhiêu lần**. RTF 0,5 là xử lý 1 giây audio hết 0,5 giây. Càng nhỏ
càng tốt.

Tử số trong đề tài là **Total Inference Time** — tổng thời gian tính toán của cả chuỗi
VAD → Whisper → NLLB → TTS, đúng phạm vi thầy giao (_"từ khi ASR nhận input speech cho
đến khi TTS generate ra translated speech"_).

**Một cái bẫy khi trích nguồn:** có tài liệu định nghĩa ngược lại — audio ÷ xử lý — lúc
đó "càng lớn càng tốt" và ngưỡng đảo chiều; chiều đó thường được gọi là **RTFx**. Báo cáo
phải ghi rõ đang dùng chiều nào. Đề tài dùng chiều **xử lý ÷ audio**.

### Ngưỡng "đạt" — trả lời câu hỏi số 2 của thầy

Em nghĩ chỉ nói mỗi "RTF < 1" là trả lời hụt trước hội đồng. Có hai ngưỡng:

**RTF < 1 là điều kiện cần, và nó cứng.** Nếu RTF ≥ 1 thì mỗi giây người dùng nói lại
sinh ra hơn một giây việc phải làm; hàng đợi audio dài ra **vô hạn** và độ trễ tăng
**không giới hạn** theo thời lượng cuộc họp. Nói 10 phút thì câu cuối trễ hàng phút. Đây
không phải "hơi chậm" mà là hệ thống hỏng theo kiểu tích luỹ.

**RTF ≤ 0,5 là mức nên nhắm để dùng thật.** RTF ≈ 1,0 quá sát trong triển khai thật.
Nghiên cứu ASR trên thiết bị của Apple (2023) lập luận rằng vì người dùng còn chạy việc
khác và hệ điều hành còn chiếm CPU nền, RTF ít nhất 0,5 mới là mục tiêu hợp lý. Đề tài
này còn ba lý do riêng để đòi thêm dư địa: máy đang chạy Google Meet cùng lúc, pipeline
có bốn model nối tiếp, và hai chiều nghe/nói chạy đồng thời tranh tài nguyên.

**Lấy p90 chứ không lấy trung bình.** Trung bình 0,8 mà 10% số câu vượt 1 thì hệ thống
vẫn dồn hàng đợi, đúng ở những câu dài — mà câu dài mới là câu mang nhiều thông tin.

| Mức                  | Điều kiện                                     | Ý nghĩa                                               |
| -------------------- | --------------------------------------------- | ----------------------------------------------------- |
| **Không đạt**        | RTF p90 ≥ 1                                   | Dồn hàng đợi, độ trễ tăng vô hạn theo thời gian nói   |
| **Đạt tối thiểu**    | RTF p90 < 1                                   | Theo kịp luồng vào, nhưng không còn dư địa            |
| **Đạt để dùng thật** | **RTF p90 ≤ 0,5** _và_ độ trễ cảm nhận ≤ ~3 s | Còn dư nửa ngân sách cho phần chờ chốt câu và tải máy |

Dòng thứ ba là **đề xuất của em**, ghép ngưỡng 0,5 có nguồn với mốc độ trễ cảm nhận dưới
đây. Đây là chỗ em xin thầy chốt.

### RTF không phải độ trễ người dùng cảm nhận

Đây là điểm em nghĩ hội đồng dễ hỏi vặn nhất. RTF đo **tốc độ tính toán**; cái người dùng
cảm nhận còn gồm thời gian chờ VAD xác nhận hết câu, độ trễ thu/phát của hệ điều hành và
đường truyền qua mic ảo. Vì vậy bảng ở mục 6 in thêm cột **"chờ chốt"** tách riêng — nó
không phải thời gian tính toán nên không được đưa vào RTF, nhưng bỏ qua nó thì báo cáo sẽ
nói hệ thống nhanh hơn cái người dùng thật sự cảm thấy.

Mốc cho độ trễ cảm nhận em đề xuất là **~3 giây**, lấy từ nghiên cứu về phiên dịch: ear-voice
span của phiên dịch viên người thật trung bình ~3 giây; phiên dịch viên chịu được ~3 giây
độ trễ do công cụ thêm vào mà không giảm rõ rệt độ chính xác; người nghe hệ thống dịch
nói đa số chọn mức 3–4 giây.

**Em cố ý không dùng mốc 150 ms của ITU-T G.114**, dù nó rất hay bị trích cho hệ thống
phiên dịch. G.114 là mốc cho **truyền dẫn thoại** (VoIP) — nó đo đường truyền chứ không
đo việc dịch, và bản thân người phiên dịch cũng trễ vài giây.

---

## 4. Kết quả (a) — ASR trên toàn bộ FLEURS `test`

**3.099 bản thu, 10,22 giờ audio, 86 phút chạy.** Không bỏ câu nào, **0 câu rỗng** ở cả
bốn ngôn ngữ. Model `mlx-community/whisper-large-v3-asr-8bit`, chạy trên Metal. Bộ lọc
câu ma **tắt** — mục (a) đo chất lượng của mô hình, không đo lớp xử lý sản phẩm nằm sau nó.

| Ngôn ngữ | Chỉ số | Giá trị |   Bản thu |         Audio |           ASR | RTF       | Câu rỗng |
| -------- | ------ | ------: | --------: | ------------: | ------------: | --------- | -------: |
| vi       | WER    |    8,8% |       857 |      10.814 s |       1.589 s | 0,15      |        0 |
| en       | WER    |    4,8% |       647 |       6.388 s |         911 s | 0,14      |        0 |
| zh       | CER    |    8,1% |       945 |      11.065 s |       1.577 s | 0,14      |        0 |
| ja       | CER    |    4,7% |       650 |       8.511 s |       1.105 s | 0,13      |        0 |
| **Gộp**  |        |         | **3.099** | **10,22 giờ** | **86,4 phút** | **0,141** |    **0** |

**Cột "câu rỗng" bằng 0 là thứ phải nhìn trước tiên** — nó là chốt chặn chống đo hỏng,
vì sai mã ngôn ngữ hay sai đường đọc audio là đúng loại lỗi từng làm cả bảng thành 100%.

**Tiếng Việt (8,8%) khó gần gấp đôi tiếng Anh (4,8%).** Đây là chiều quan trọng nhất của
đề tài, và cả bốn con số đều là **mức sàn**: FLEURS là giọng đọc rõ, không từ đệm, ít
nhiễu, nên WER trong cuộc họp thật sẽ cao hơn.

**RTF 0,14 ở đây là của riêng khâu ASR**, không phải RTF toàn hệ thống — cái đó ở mục 6
và cao hơn vì gồm cả VAD/MT/TTS.

---

## 5. Kết quả (b) — MT trên 6 chiều

**2.022 cặp câu, 27,6 phút chạy.** Model `facebook/nllb-200-distilled-600M`, ghép câu
theo `id` nên **không đi qua ASR**. Độ đo: spBLEU (tokenizer `flores200`), chrF++, và
COMET `Unbabel/wmt22-comet-da` đúng bản thầy chỉ định.

| Chiều dịch | Câu | spBLEU |  chrF++ | COMET      |
| ---------- | --: | -----: | ------: | ---------- |
| vi→en      | 347 |  35,79 |   57,10 | 0,8525     |
| en→vi      | 347 |  37,13 |   54,69 | 0,8505     |
| vi→zh      | 346 |  17,15 | _16,14_ | **0,7729** |
| zh→vi      | 346 |  22,33 |   42,77 | 0,8213     |
| vi→ja      | 318 |  10,96 | _19,88_ | 0,8239     |
| ja→vi      | 318 |  19,91 |   40,19 | 0,8191     |

**COMET xếp hạng khác hẳn spBLEU — đây là lý do thầy giao cả hai độ đo.** Theo spBLEU,
vi→ja (10,96) tệ hơn vi→zh (17,15) tới 6 điểm; theo COMET thì ngược lại, vi→ja 0,8239 cao
hơn vi→zh 0,7729. Sáu chiều nằm gọn trong dải COMET 0,77–0,85 trong khi spBLEU trải từ
10,96 tới 37,13.

**Chiều yếu nhất là vi→zh**, và cả hai độ đo cùng chỉ vào đó. Chỗ này làm em phải sửa một
việc trong kế hoạch: biên bản ghi _"cải thiện chất lượng dịch Nhật → Việt"_, nhưng đo
xong thì ja→vi không phải chiều tệ nhất (spBLEU 19,91 · COMET 0,8191). Em sẽ **nhắm vào
vi→zh** thay vì ja→vi.

**chrF++ ở hai chiều đích zh/ja không so ngang được** (in nghiêng trong bảng). vi→zh có
chrF++ 16,14, thấp hơn cả spBLEU của chính nó. Không phải bản dịch tệ tới mức đó: dấu
`++` là phần n-gram cấp **từ**, mà tiếng Trung/Nhật không tách từ bằng khoảng trắng nên
phần đó gần bằng 0 và kéo tụt điểm tổng.

**Không lấy trung bình sáu chiều.** Sáu chiều khác độ khó và khác đơn vị; một con số gộp
chỉ nói lên việc đã trộn hai nhóm không cùng thang.

---

## 6. Kết quả (c) — Total Inference Time và RTF, đủ sáu chiều

50 mẫu mỗi chiều, **cùng cấu hình đã đo WER ở mục 4** — bảng độ trễ và bảng WER phải nói
về cùng một hệ thống.

| Chiều | Mẫu |  VAD |     ASR |      MT |     TTS | Tổng TB  | Tổng p90  | RTF TB | RTF p90   | Chờ chốt |
| ----- | --: | ---: | ------: | ------: | ------: | -------- | --------- | -----: | --------- | -------: |
| vi→en |  50 | 53ms | 4.595ms | 1.129ms |   318ms | 6.095 ms | 10.176 ms |  0,486 | 0,580     |    256ms |
| en→vi |  50 | 46ms | 2.421ms |   953ms |   273ms | 3.693 ms | 5.511 ms  |  0,392 | **0,496** |    202ms |
| vi→zh |  50 | 52ms | 4.598ms | 1.134ms | 1.693ms | 7.478 ms | 12.593 ms |  0,595 | 0,727     |    256ms |
| zh→vi |  50 | 48ms | 2.623ms |   965ms |   274ms | 3.911 ms | 5.460 ms  |  0,375 | 0,509     |    200ms |
| vi→ja |  50 | 55ms | 4.646ms | 1.025ms | 2.261ms | 7.987 ms | 13.256 ms |  0,639 | **0,786** |    256ms |
| ja→vi |  50 | 55ms | 2.859ms | 1.052ms |   290ms | 4.255 ms | 6.367 ms  |  0,324 | **0,395** |    211ms |

Đối chiếu với bảng ngưỡng ở mục 3:

| Mức              | Chiều đạt                                         |
| ---------------- | ------------------------------------------------- |
| Đạt tối thiểu    | **cả sáu** (xấu nhất là vi→ja với 0,786)          |
| Đạt để dùng thật | ja→vi 0,395 · en→vi 0,496 · zh→vi 0,509 (sát mép) |
| Không đạt        | không có chiều nào                                |

Nên câu trả lời không phải "đạt hay chưa" mà là: **đạt ngưỡng cứng ở mọi chiều, còn
ngưỡng đề xuất thì phụ thuộc chiều nào.** Ba chiều trượt đều là ba chiều **có tiếng Việt
ở đầu vào**, và nguyên nhân tách bạch được, nằm ở hai đầu khác nhau:

1. **Nguồn tiếng Việt thì ASR đắt gần gấp đôi** — 4,6 giây so với 2,4–2,9 giây, và ASR
   chiếm 58–75% tổng thời gian ở mọi chiều. Khớp với bảng WER ở mục 4: tiếng Việt vừa khó
   hơn vừa tốn hơn cho cùng một model.
2. **Đích tiếng Trung/Nhật thì TTS đắt gấp 6–8 lần** — 1.693 ms cho zh và 2.261 ms cho ja
   so với 273–318 ms cho vi/en, tức 22,6% tổng thời gian ở vi→zh và **28,3%** ở vi→ja
   trong khi bốn chiều còn lại chỉ 5–7%. Tiếng Nhật phải đi qua Kokoro + G2P OpenJTalk vì
   sherpa-onnx không có front-end tiếng Nhật chạy được.

Muốn kéo vi→ja xuống dưới 0,5 thì hai chỗ đáng sửa là ASR cho nguồn tiếng Việt và TTS cho
đích tiếng Nhật — **không phải MT**, vốn ổn định 950–1.130 ms ở cả sáu chiều.

**Tổng p90 10–13 giây** ở ba chiều nguồn tiếng Việt trông đáng sợ, nhưng đó là tổng cho
một phát ngôn FLEURS dài ~12 giây, bị VAD cắt thành nhiều đoạn rồi cộng dồn. RTF mới là
con số so sánh được.

Số đối chiếu với mục tiêu đặt cho **một câu ngắn** là bộ đo riêng trên audio 3 giây: ASR
991–1.060 ms · MT 460–579 ms · TTS 141–969 ms · tổng 1,8–2,6 giây. Hai bảng trả lời hai
câu hỏi khác nhau — một câu mất bao lâu, và hệ thống có theo kịp luồng nói liên tục không.

---

## 7. Mục (d) — màn hình đánh giá trong ứng dụng

Yêu cầu của thầy: chọn câu mẫu có bản dịch tham chiếu, chạy qua hệ thống, app tự tính độ
trễ **và** chất lượng. Đã làm xong, chạy thật với bộ mẫu 22 câu phủ đủ sáu chiều: tỷ lệ
lỗi nhận dạng **6,7%** · chrF **43,9%** · ASR p50 819 ms / p90 856 ms · dịch p90 396 ms ·
tổng p90 1.227 ms · **RTF p90 0,818**.

Ba chỗ em cố ý làm khác để con số không bị đẹp giả:

- **Dịch từ câu tham chiếu, không dịch từ đầu ra ASR** — dịch từ cái ASR vừa nghe được
  thì lỗi hai khâu cộng dồn, không biết chất lượng dịch thật sự là bao nhiêu.
- **Câu không có bản ghi thì chạy bằng giọng tổng hợp**, nhưng màn hình hiện dải cảnh báo
  riêng: giọng tổng hợp sạch và đều nên số **lạc quan hơn thực tế**.
- **Khai báo file audio mà sai đường dẫn thì báo lỗi**, không lặng lẽ rơi về giọng tổng hợp.

> **Một chỗ dễ đọc nhầm, em phải nói rõ.** RTF p90 **0,818** ở đây tính trên phạm vi
> **chỉ ASR + MT** (màn này chấm chất lượng dịch nên không chạy TTS), còn RTF p90
> **0,395–0,786** ở mục 6 tính trên **cả chuỗi** VAD→ASR→MT→TTS, khác model và khác cả dữ
> liệu. Hai con số **không** thay thế nhau được. Số cho báo cáo lấy từ mục 6; số ở màn
> Đánh giá là để người dùng tự kiểm tra.

---

## 8. Ba chỗ em làm khác kế hoạch

**Dùng CER cho tiếng Trung và tiếng Nhật.** Kế hoạch ghi "WER" cho cả bốn ngôn ngữ, nhưng
zh/ja không tách từ bằng khoảng trắng nên chấm WER thực chất là chấm theo chỗ Whisper
_tình cờ_ chèn dấu cách — cùng một câu đúng nghĩa có thể ra 0% hay 100%. Bài báo FLEURS
và bài báo Whisper đều dùng CER cho nhóm CJK. Bảng kết quả ghi rõ từng dòng đang là chỉ
số nào, và **không** có dòng "trung bình bốn ngôn ngữ" vì WER với CER không so được với
nhau. _(Lập luận đầy đủ có trích nguồn ở file phụ lục.)_

**COMET phải chạy ở môi trường riêng.** `unbabel-comet` ghim `numpy<2` và
`transformers<5`, trong khi NLLB cần `numpy>=2.4` và `transformers>=5.14` — hai bộ ràng
buộc này không cùng tồn tại trong một môi trường. Em tách thành một script độc lập tự
dựng môi trường riêng, đọc file kết quả của bước dịch rồi ghi điểm COMET ngược vào. Xin
nói thêm: COMET chỉ chạy ở khâu **đánh giá offline**, không nằm trong ứng dụng người dùng
cài, nên nó không vi phạm nguyên tắc "chạy hoàn toàn cục bộ" của đề tài.

**Chọn model bằng số đo, không bằng suy đoán.** Biên bản mục 5 có ghi hội đồng sẽ hỏi
"tại sao chọn những mô hình này". Em đã đo 7 bản Whisper trên cùng 20 câu trước khi chạy
bản đầy đủ, và rút ra ba điều: lượng tử hoá 8-bit **không đổi WER** so với fp16 (6,7% cả
hai) nhưng nhỏ hơn 2,3 lần và nhanh hơn 22%; bản turbo nhanh gấp đôi nhưng mất 1,4 điểm
WER (đây là cơ sở cho ba preset Nhanh / Cân bằng / Chất lượng thầy gợi ý); và họ model
`small` của mlx-community **hỏng** — WER 133,5% do kẹt vòng lặp lặp chữ, trong khi bản
cùng cỡ ở định dạng khác chạy bình thường, nên lỗi nằm ở bản chuyển đổi chứ không phải ở
cỡ model. Bảng đo đầy đủ ở file phụ lục.

---

## 9. Điều cần thầy chốt

1. **CER thay WER cho zh/ja** (mục 8) — xin thầy xác nhận.
2. **Ngưỡng RTF:** lấy **p90 < 1** (điều kiện cần) hay chặt hơn ở **p90 ≤ 0,5**? Hiện cả
   sáu chiều đạt mức thứ nhất, chỉ ba chiều đạt mức thứ hai.
3. **Ngưỡng độ trễ cảm nhận ≤ ~3 giây**, lấy căn cứ từ nghiên cứu ear-voice span của
   phiên dịch viên, **không** dùng mốc 150 ms của ITU-T G.114 (mục 3) — xin thầy duyệt
   cách lập luận này.
4. **chrF++ có được tính là độ đo chính thức thứ ba cho MT không**, hay chỉ để tham khảo?
   Bài báo NLLB-200 báo cáo chính bằng chrF++ chứ không phải BLEU.
5. **Chi tiết COMET chạy môi trường riêng** (mục 8) nên viết trong báo cáo hay để ở phụ lục?

---

## 10. Hạn chế em xin nói trước

- **FLEURS là giọng đọc, không phải giọng họp.** Câu được đọc rõ ràng, không từ đệm,
  không ngắt quãng, ít nhiễu nền. WER và RTF trong một cuộc họp thật sẽ **xấu hơn** các
  con số trên. Đây là mức sàn, không phải mức kỳ vọng — em nghĩ phải chủ động nói ở phần
  bảo vệ chứ không để hội đồng hỏi.
- **Chưa chuẩn hoá số và viết tắt** khi chấm WER: `"2019"` so với `"hai nghìn không trăm
mười chín"` bị tính là sai hoàn toàn dù nghe đúng. Sai lệch này làm WER đo được cao hơn
  WER thật một chút, nhưng đều nhau ở mọi cấu hình nên không ảnh hưởng phần so sánh giữa
  các model.
- **Đo trên một máy.** RTF gắn chặt với phần cứng; con số của Apple M4 + Metal không
  chuyển sang máy Windows không có Metal được.
- **Chưa có đối chứng cloud** — thầy hướng dẫn ở buổi sau.
- **Số đo lặp lại được.** Cả ba script đều tắt fallback nhiệt độ nên Whisper giải mã tất
  định: chạy lại trên máy khác sẽ ra RTF khác nhưng WER/CER, spBLEU/chrF++ và COMET gần
  như trùng.

---

## 11. Việc còn lại của khối đánh giá

- [ ] **Lượt chạy đầy đủ của whisper.cpp** để so cùng thang với MLX (~55 phút). Hiện
      whisper.cpp mới có số trên 20 câu nên chưa so runtime một cách công bằng được.
- [ ] **Đo trên Windows + NVIDIA** để có cột thứ ba trong bảng so backend.
- [ ] **Bộ mẫu giọng người thật**, để đo khoảng cách giữa giọng đọc FLEURS và giọng hội
      thoại. Đây cũng là thứ đang chặn việc kiểm chứng hai vấn đề thầy nêu ở mục 4.1 và
      4.2 của biên bản: phần tách câu và bộ lọc câu ma đã code xong và có test, nhưng test
      không chứng minh được Whisper thật sự bớt bịa trên máy thật. Em đã thử bằng tín hiệu
      tổng hợp nhưng Silero ngừng coi âm thanh nhân tạo là giọng nói sau ~3,5 giây, nên
      không dựng được kịch bản "nói liên tục 20 giây".
- [ ] **Baseline cloud** — thầy hướng dẫn ở buổi sau.

Số liệu thô của cả ba lượt chạy đều được giữ lại dạng JSON, gồm cả **từng câu dịch** của
lượt MT (2.022 câu), để kiểm lại được từng con số và soi được câu nào sai. Nếu thầy cần
em gửi kèm.
