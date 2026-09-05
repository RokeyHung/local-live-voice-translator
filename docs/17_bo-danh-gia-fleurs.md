# Bộ đánh giá trên FLEURS — WER/CER, spBLEU/chrF++/COMET, Total Inference Time + RTF

**Giai đoạn:** sau buổi họp GVHD 19/08/2026 · **Hiện thực:** 04/09/2026
**Mục tiêu:** Ưu tiên 1 trong [biên bản họp](meetings/bien-ban-hop-GVHD-2026-08-19.md) —
dựng phần đo đạc thầy giao ở mục 3, chạy được bằng lệnh, kết quả ra bảng và JSON.

> Thay thế `scripts/accuracy.py` (bộ 20 câu tự thu, WER/chrF tự cài) ở vai trò "số liệu
> cho báo cáo". Script cũ vẫn giữ để kiểm tra nhanh pipeline còn sống.

---

## 1. Kiểm tra lại dataset — việc thầy dặn làm trước

Đã kiểm tra `https://huggingface.co/datasets/google/fleurs` bằng API của Hugging Face:

| Ngôn ngữ    | Config FLEURS | Có split `test` | Câu duy nhất ở `test` |
| ----------- | ------------- | --------------- | --------------------- |
| Tiếng Việt  | `vi_vn`       | có              | 347                   |
| Tiếng Anh   | `en_us`       | có              | 347                   |
| Tiếng Trung | `cmn_hans_cn` | có              | 346 (ghép với vi)     |
| Tiếng Nhật  | `ja_jp`       | có              | 318 (ghép với vi)     |

Cả 103 config đều có đủ ba split `train` / `validation` / `test`. Toàn bộ phần đo dùng
**`test`** đúng như thầy dặn.

Hai tính chất của FLEURS quyết định cách viết code:

- FLEURS là **bản tiếng nói của FLoRes**: 2009 câu **song song n chiều**, mỗi câu mang
  một `id` **dùng chung giữa mọi ngôn ngữ**. Ghép `id` là ra ngay cặp câu song ngữ →
  đánh giá MT không cần đi qua ASR, đúng yêu cầu "tách bạch lỗi từng khối".
- Một `id` có **nhiều bản thu** (nhiều người đọc cùng câu). Với ASR đó là các mẫu khác
  nhau; với MT phải khử trùng lặp theo `id` — cột "câu duy nhất" ở trên là sau khi khử.

Con số 318 cặp cho vi↔ja là do bản ghi tiếng Nhật thiếu một ít câu; code lấy **giao**
của hai tập `id` nên không bao giờ so lệch cặp.

---

## 2. Ba nhóm chỉ số, ba lệnh

```bash
make setup-eval                  # cài datasets + sacrebleu + jiwer (một lần)

make eval-asr LIMIT=20           # (a) WER/CER từng ngôn ngữ
make eval-mt LIMIT=30            # (b) spBLEU + chrF++ trên 6 chiều
make eval-comet                  # (b) chấm COMET cho eval-mt.json
make eval-latency LIMIT=20       # (c) Total Inference Time + RTF
```

Bỏ `LIMIT` để chạy toàn bộ tập `test` — đó mới là số đưa vào báo cáo. `LIMIT` dùng để
ước lượng thời gian và dung lượng tải trước khi chạy bản đầy đủ.

Mỗi lệnh ghi thêm một file JSON (`eval-asr.json`, `eval-mt.json`, `eval-latency.json`)
kèm đủ tham số của lần chạy — preset, tên model, backend thật (Metal/CUDA/CPU), có bật
bộ lọc câu ma hay không — để về sau đọc lại còn biết con số đó sinh ra trong điều kiện
nào.

### Chi phí tải về

| Phần                      | Tải lần đầu                           |
| ------------------------- | ------------------------------------- |
| Văn bản FLEURS (MT)       | ~600 KB mỗi ngôn ngữ                  |
| Audio FLEURS (ASR)        | 383–663 MB mỗi ngôn ngữ, split `test` |
| Whisper large-v3-turbo q5 | ~570 MB                               |
| NLLB-200 distilled 600M   | ~2,5 GB                               |
| `Unbabel/wmt22-comet-da`  | ~2,3 GB                               |

Phần đánh giá MT cố ý đọc thẳng file `data/<config>/test.tsv` thay vì đi qua thư viện
`datasets`: chỉ cần văn bản thì không có lý do gì tải 2 GB audio.

---

## 3. (a) ASR — WER cho vi/en, **CER** cho zh/ja

`scripts/eval_asr.py` chạy Whisper trên audio FLEURS và so với trường `transcription`
(bản đã chuẩn hoá sẵn của FLEURS).

**Vì sao không dùng WER cho cả bốn thứ tiếng.** WER đếm lỗi trên chuỗi _từ_, mà tiếng
Trung và tiếng Nhật không tách từ bằng khoảng trắng. Chấm WER cho hai thứ tiếng đó thực
chất là chấm theo chỗ Whisper tình cờ chèn dấu cách, không phải theo lỗi thật — cùng một
câu đúng nghĩa có thể ra WER 0% hay 100% tuỳ cách chèn. Cách làm chuẩn trong ngành, và
trong chính bài báo FLEURS, là dùng **CER** cho zh/ja. Bảng kết quả ghi rõ từng dòng
đang là chỉ số nào chứ không gộp một cột "WER" cho gọn.

**Bộ lọc câu ma mặc định TẮT** khi đo. Mục tiêu của mục (a) là chất lượng của _mô hình_
Whisper; bộ lọc ở `adapters/asr/hallucination.py` là một lớp sản phẩm nằm sau nó. Cần
con số của cả hệ thống như người dùng thấy thì thêm `--with-filter`.

**Số WER lặp lại được.** Adapter đặt `temperature_inc = 0` nên Whisper giải mã tất định:
chạy lại hai lần cho ra đúng cùng một con số. Nếu bật fallback nhiệt độ thì mỗi lần chạy
lệch một ít và bảng trong báo cáo sẽ không tái lập được.

Bảng còn có cột `rỗng` — số câu ASR không ra chữ nào. Cột này để phát hiện sớm việc đo
hỏng (ví dụ sai mã ngôn ngữ) thay vì nhận một con số WER cao mà không hiểu vì sao.

---

## 4. (b) MT — spBLEU, chrF++ và COMET trên 6 chiều

`scripts/eval_mt.py` dịch phần `raw_transcription` (văn bản tự nhiên, còn dấu câu) của
ngôn ngữ nguồn và so với `raw_transcription` của ngôn ngữ đích ở cùng `id`.

Dùng bản `raw` chứ không phải bản đã chuẩn hoá vì NLLB được huấn luyện trên văn bản tự
nhiên — đưa chữ thường không dấu câu vào sẽ đo thấp hơn thực tế.

**BLEU nào.** BLEU phụ thuộc bộ tách từ, nên hai bài báo cùng nói "BLEU 30" có thể không
so được với nhau. Ở đây dùng `sacrebleu` với tokenizer `flores200` — tức **spBLEU**,
đúng độ đo bài báo NLLB-200 tự dùng. Hai cái lợi: số của đề tài đặt cạnh số công bố của
NLLB là so sánh được, và một tokenizer duy nhất cho cả 6 chiều khiến 6 con số so được
với nhau. **chrF++** đi kèm làm chỉ số phụ vì nó ổn định hơn BLEU trên tập vài trăm câu.

**COMET phải chạy ở môi trường riêng.** `unbabel-comet` ghim `numpy<2.0` và
`transformers<5.0`, trong khi dịch vụ cần `numpy>=2.4` và `transformers>=5.14` cho NLLB.
Hai bộ ràng buộc này không cùng tồn tại trong một venv được. Vì vậy:

- `eval_mt.py` đo spBLEU/chrF++ và ghi ra JSON **kèm từng câu** (nguồn / bản dịch / tham
  chiếu);
- `scripts/eval_comet.py` là một script độc lập có khối metadata **PEP 723** ở đầu file,
  chạy bằng `uv run --no-project` — uv tự dựng một môi trường riêng cho nó, không đụng
  gì tới `.venv` của dự án. Script đọc file JSON kia, chấm COMET rồi ghi điểm ngược vào.

Việc xuất từng câu ra JSON còn có ích khi viết báo cáo: soi được câu nào dịch sai và sai
kiểu gì, thay vì chỉ có một con số tổng.

---

## 5. (c) Độ trễ — Total Inference Time và RTF

`scripts/eval_latency.py` chạy đủ chuỗi **VAD → Whisper → NLLB → TTS** trên audio thật
của FLEURS.

### Công thức RTF — phần thầy dặn tra lại và báo cáo

$$\text{RTF} = \frac{\text{thời gian xử lý}}{\text{thời lượng audio đầu vào}}$$

- **RTF < 1** — hệ thống xử lý **nhanh hơn thời gian thực**. Đây là điều kiện **cần** để
  chạy trực tuyến: nếu không, hàng đợi audio dài ra vô hạn và độ trễ tăng không giới hạn
  theo thời gian nói.
- **RTF ≥ 1** — không theo kịp luồng vào.

Lưu ý một cái bẫy khi trích nguồn: **có tài liệu định nghĩa ngược** (thời lượng audio
chia thời gian xử lý), lúc đó "càng lớn càng tốt". Báo cáo phải ghi rõ đang dùng chiều
nào. Dự án dùng chiều **xử lý ÷ audio**, giống Kaldi, whisper.cpp và các bài báo ASR —
JSON kết quả có sẵn khoá `rtf_definition` ghi nguyên câu định nghĩa để không nhầm.

### Ngưỡng "đạt" — đề xuất để thầy duyệt

RTF < 1 mới chỉ là điều kiện cần, chưa đủ để **nói chuyện được**. Đề xuất hai mức:

| Mức       | Điều kiện                                   | Ý nghĩa                                              |
| --------- | ------------------------------------------- | ---------------------------------------------------- |
| Cần       | **RTF p90 < 1**                             | Không dồn hàng đợi trong một cuộc họp dài            |
| Đủ để nói | **RTF p90 ≤ 0,5** và độ trễ cảm nhận ≤ ~2 s | Còn dư nửa ngân sách thời gian cho phần chờ chốt câu |

Lấy **p90 chứ không phải trung bình**: trung bình < 1 mà 10% số câu > 1 thì hệ thống vẫn
dồn hàng đợi ở đúng những câu dài — mà câu dài mới là câu quan trọng.

Về mốc "độ trễ cảm nhận": [ITU-T G.114](https://www.itu.int/rec/T-REC-G.114) đặt ngưỡng
150 ms cho hội thoại thời gian thực, nhưng đó là mốc cho **truyền dẫn thoại**, không áp
được cho phiên dịch — bản thân người phiên dịch cũng trễ vài giây (_ear-voice span_).
Vì vậy đề tài dùng RTF làm chỉ số chính, còn độ trễ cảm nhận báo cáo riêng và **không**
so với 150 ms. Đây là chỗ cần thầy chốt giúp.

### Vì sao bảng có thêm cột "chờ chốt"

Total Inference Time chỉ đếm thời gian **tính toán**. Người dùng còn phải chờ VAD xác
nhận là mình đã nói xong — đó là phần độ trễ do ngưỡng endpointing quyết định (xem
[mục 4.2 biên bản](meetings/bien-ban-hop-GVHD-2026-08-19.md) và bản sửa ở
`adapters/vad/silero.py`). Nó **không** phải thời gian tính toán nên không nằm trong
RTF, nhưng bỏ qua nó thì báo cáo sẽ nói hệ thống nhanh hơn thực tế người dùng cảm nhận.
Bảng in cả hai, có ghi chú rõ cái nào là cái nào.

Dò riêng phần này bằng `make endpointing MEDIA=<bản ghi>.mov`.

---

## 6. Hạn chế đã biết

- **Chưa chuẩn hoá số và viết tắt.** Whisper trả `"2019"` trong khi câu tham chiếu có
  thể ghi `"hai nghìn không trăm mười chín"` → tính là lỗi. WER thật thấp hơn con số đo
  được một chút. Sai lệch này đều nhau ở mọi cấu hình nên không ảnh hưởng phần **so
  sánh** giữa các model — chỉ ảnh hưởng con số tuyệt đối.
- **FLEURS là giọng đọc, không phải giọng hội thoại.** Đọc rõ ràng, ít nhiễu, gần như
  không có từ đệm hay ngắt quãng. WER trên FLEURS sẽ **thấp hơn** WER trong một cuộc họp
  thật. Đây là điểm phải nói trước ở phần bảo vệ chứ không để hội đồng hỏi.
- **Đo trên một máy.** Con số RTF gắn với cấu hình máy chạy; báo cáo phải ghi kèm CPU/GPU
  và cờ build của whisper.cpp (JSON đã có sẵn trường `runtime`).
- **Chưa có đối chứng cloud** (mục 5 trong biên bản, thầy hướng dẫn ở buổi sau).

---

## 7. Việc còn lại của Ưu tiên 1

- [ ] Chạy `make eval-asr` bản đầy đủ trên máy macOS (Metal) → bảng WER/CER
- [ ] Chạy `make eval-mt` + `make eval-comet` bản đầy đủ → bảng 6 chiều
- [ ] Chạy `make eval-latency` cho ít nhất 2 chiều → Total Inference Time + RTF
- [ ] Gửi thầy mục 5 của tài liệu này (công thức RTF + ngưỡng đề xuất) để chốt
