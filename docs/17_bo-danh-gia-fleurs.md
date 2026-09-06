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
make setup                       # cài đầy đủ, gồm cả nhóm eval (hoặc make setup-eval)
make fetch-fleurs                # tải trước dữ liệu FLEURS (một lần, ~2,3 GB)

make eval-asr LIMIT=20           # (a) WER/CER từng ngôn ngữ
make eval-mt LIMIT=30            # (b) spBLEU + chrF++ trên 6 chiều
make eval-comet                  # (b) chấm COMET cho eval-mt.json
make eval-latency LIMIT=20       # (c) Total Inference Time + RTF
```

Bỏ `LIMIT` để chạy toàn bộ tập `test` — đó mới là số đưa vào báo cáo. `LIMIT` dùng để
ước lượng thời gian và dung lượng tải trước khi chạy bản đầy đủ.

### Phụ thuộc: vì sao ba lệnh tự mang theo `--group eval`

`uv sync` đồng bộ môi trường về **đúng** những gì lệnh nêu ra: `make setup-mlx` chạy sau
`make setup-eval` sẽ gỡ mất `sacrebleu`, im lặng, không báo gì. Đã mất một lượt chạy
thật vì chuyện này — script dịch xong toàn bộ chiều vi→en (347 câu, 5 phút) rồi mới chết
ở dòng `from sacrebleu.metrics import BLEU`.

Hai lớp chặn:

1. Ba target `eval-asr` / `eval-mt` / `eval-latency` chạy qua `uv run --group eval`, nên
   thư viện đo luôn có mặt dù trước đó đã `uv sync` kiểu gì.
2. Mỗi script gọi `metrics.require(...)` ở dòng đầu của `main_async`, **trước** khi nạp
   model. Thiếu thư viện thì hỏng trong một giây kèm câu "chạy `make setup-eval`", chứ
   không phải sau nửa tiếng chạy.

Lớp 2 cần thiết vì `jiwer`/`sacrebleu` cố tình được import muộn bên trong từng hàm đo
(nhóm `eval` là phụ thuộc tuỳ chọn), nên lỗi thiếu thư viện mặc định nổ ra ở tận bước
chấm điểm — sau khi model đã chạy xong việc nặng nhất.

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

### Tải dữ liệu trước bằng `make fetch-fleurs`

Ba lệnh `eval-*` tự tải phần chúng thiếu, nhưng nên tải riêng một lần bằng
`scripts/fetch_fleurs.sh`: lượt tải audio là hơn 2 GB, đứt mạng giữa chừng thì mất luôn
cả lượt chạy đánh giá (đã nạp model, đã chạy được một phần). Tải riêng thì chạy lại là
tiếp tục chỗ dở, và file nào đã có sẽ bị bỏ qua.

```bash
make fetch-fleurs                       # cả bốn ngôn ngữ, split test
make fetch-fleurs LANGS="vi en"         # tải lẻ
make fetch-fleurs FLEURS_CACHE=/duong/dan/khac
```

**Dữ liệu nằm ở đâu.** Mặc định là `fleurs-cache/` ở thư mục gốc repo (đã có trong
`.gitignore`), đổi bằng biến `FLEURS_CACHE`. Makefile trỏ **cả hai** biến môi trường của
Hugging Face vào đó cho các lệnh `eval-*`:

| Biến                | Chứa gì                                               |
| ------------------- | ----------------------------------------------------- |
| `HF_HUB_CACHE`      | File tải thẳng từ Hub: `test.tsv` và parquet có audio |
| `HF_DATASETS_CACHE` | Bản arrow mà `datasets` giải nén ra từ parquet        |

Phải đặt cả hai, nếu không dữ liệu đánh giá bị chẻ làm hai nơi — cái thứ hai mặc định
nằm ở `~/.cache`. Model **không** bị ảnh hưởng: adapter truyền `cache_dir` riêng nên
whisper.cpp/NLLB vẫn nằm ở `models_dir`.

**Hai nguồn, hai nhánh khác nhau — không gộp được:**

| Thứ     | Nhánh                  | Đường dẫn                 |
| ------- | ---------------------- | ------------------------- |
| Văn bản | `main`                 | `data/<config>/test.tsv`  |
| Audio   | `refs/convert/parquet` | `<config>/test/*.parquet` |

`datasets.load_dataset()` đọc bản parquet tự chuyển đổi, **không** đọc
`data/<config>/audio/test.tar.gz` trên `main`. Tải nhầm nhánh là tải thừa vài GB mà
`eval-asr` vẫn đi tải lại từ đầu.

**Vì sao script dùng `snapshot_download` chứ không dùng `hf download --include`:** CLI
nhận `repo_id [filenames...]` là tham số vị trí, nên khi truyền nhiều mẫu sau
`--include` thì một phần rơi vào `filenames` và **toàn bộ `--include` bị bỏ qua** — chỉ
cảnh báo, vẫn thoát mã 0. Lần đầu tải bằng lệnh đó đã thiếu mất đúng tiếng Việt mà không
có dấu hiệu gì, và tiếng Việt là ngôn ngữ trục của cả sáu chiều nên thiếu nó là hỏng
toàn bộ phần MT.

Kiểm tra nhanh dữ liệu đã đủ chưa (đọc offline, không đụng mạng):

```bash
cd apps/ai-service && HF_HUB_CACHE=../../fleurs-cache HF_HUB_OFFLINE=1 \
  uv run python -c "import sys; sys.path.insert(0,'scripts'); import fleurs; \
  from llvt_ai_service.domain.enums import Language as L; \
  print(len(fleurs.parallel(L.vi, L.en)))"
```

Ra `347` là văn bản đủ (346 cho vi↔zh, 318 cho vi↔ja — đúng bảng ở mục 1).

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

**Đổi runtime hoặc model.** Script dựng adapter qua `ASR_REGISTRY` chứ không import
thẳng `WhisperCppAsr`, nên đo được cả ba backend mà không phải sửa code:

```bash
make eval-asr ADAPTER=mlx_whisper \
  MODEL=mlx-community/whisper-large-v3-asr-fp16 JSON=eval-asr-mlx.json
```

`MODEL` phải đúng tên của runtime đang chọn — GGML là tên file trong repo whisper.cpp,
MLX và CTranslate2 là repo id đã chuyển đổi sẵn, ba loại **không** thay nhau được (mục
đích của `asr_alternatives` trong preset, xem [`23`](23_chon-model-khong-phai-nap-model.md)).
Đặt `JSON=` khác đi khi đo backend thứ hai, nếu không nó ghi đè bảng của backend thứ nhất.

Bảng đo bảy model MLX (WER · RTF · dung lượng, trên cùng 20 câu tiếng Việt) nằm ở
[`19` mục 2.2b](19_backend-asr-va-tach-nguoi-noi.md) — dùng nó để chọn model trước khi
tốn một tiếng rưỡi chạy bản đầy đủ.

Khi so hai dòng kết quả với nhau, nhớ là **đổi backend thường kèm đổi luôn cỡ model**:
`ggml-large-v3-turbo-q5_0` (turbo, lượng tử 5-bit) so với
`mlx-community/whisper-large-v3-asr-fp16` (large-v3 đầy đủ, fp16) là khác cả runtime lẫn
model. Muốn tách riêng ảnh hưởng của runtime thì phải chọn hai model cùng mức.

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

Cái giá của môi trường riêng là nó cũ hơn phần còn lại của dự án, và hai chỗ đã hỏng thật
khi chạy trên macOS Apple Silicon — cả hai đều chết **trước khi chấm câu đầu tiên**, nên
đã vá thẳng trong `eval_comet.py`:

| Triệu chứng                                                     | Nguyên nhân                                                                                                               | Cách vá                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `ModuleNotFoundError: No module named 'pkg_resources'`          | `unbabel-comet` ghim `torchmetrics<0.11`, bản đó còn import `pkg_resources`, mà setuptools từ 81 trở đi đã gỡ hẳn gói này | ghim `setuptools<81` ở PEP 723 |
| `ValueError: multiprocessing_context can only be used with ...` | COMET đặt `multiprocessing_context="fork"` khi thấy MPS khả dụng, nhưng để `num_workers = 2 * gpus` = 0 lúc chấm trên CPU | truyền `num_workers=2`         |

Cái thứ hai chỉ xảy ra trên máy Mac có MPS mà chấm bằng CPU — đúng cấu hình mặc định của
đề tài.

Chấm COMET **không** đắt: đo thật được ~120 câu trong 13 giây, tức toàn bộ 2.022 câu
FLEURS hết khoảng 4 phút, so với 28 phút của bước dịch sinh ra chúng.

---

## 5. (c) Độ trễ — Total Inference Time và RTF

`scripts/eval_latency.py` chạy đủ chuỗi **VAD → Whisper → NLLB → TTS** trên audio thật
của FLEURS.

### Công thức RTF — phần thầy dặn tra lại và báo cáo

> Bản đầy đủ, có trích nguồn cho từng khẳng định, nằm ở
> [`26` mục 5](26_do-do-danh-gia-wer-bleu-comet-rtf.md) — đó mới là phần gửi thầy. Mục
> này giữ lại bản tóm tắt để đọc liền mạch với phần code.

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

- [x] Tải dữ liệu FLEURS về máy (`make fetch-fleurs`) — 4 ngôn ngữ, split `test`, 2,2 GB
- [ ] Chạy `make eval-asr` bản đầy đủ trên máy macOS (Metal) → bảng WER/CER
- [x] Chạy `make eval-mt` + `make eval-comet` bản đầy đủ → bảng 6 chiều (mục 8 dưới đây)
- [ ] Chạy `make eval-latency` cho ít nhất 2 chiều → Total Inference Time + RTF
- [x] Tra công thức RTF, ngưỡng real-time và ba độ đo còn lại, có trích nguồn —
      [`26`](26_do-do-danh-gia-wer-bleu-comet-rtf.md)
- [ ] Gửi thầy [`26` mục 5](26_do-do-danh-gia-wer-bleu-comet-rtf.md) (công thức RTF +
      ngưỡng đề xuất) và [`26` mục 8](26_do-do-danh-gia-wer-bleu-comet-rtf.md) (5 điểm
      cần chốt)

---

## 8. Kết quả mục (b): MT trên toàn bộ FLEURS `test` — 06/09/2026

Lượt chạy đầy đủ đầu tiên. **2.022 cặp câu**, không giới hạn, 27,6 phút.

| Điều kiện | Giá trị                                                        |
| --------- | -------------------------------------------------------------- |
| Model     | `facebook/nllb-200-distilled-600M` (preset `balanced`)         |
| Dữ liệu   | `google/fleurs`, split `test`, ghép theo `id` (không qua ASR)  |
| Máy       | Apple M4, macOS 26.6                                           |
| Độ đo     | spBLEU (tokenizer `flores200`), chrF++, COMET `wmt22-comet-da` |

| Chiều dịch | Câu | spBLEU |  chrF++ | COMET      |
| ---------- | --: | -----: | ------: | ---------- |
| vi→en      | 347 |  35,79 |   57,10 | 0,8525     |
| en→vi      | 347 |  37,13 |   54,69 | 0,8505     |
| vi→zh      | 346 |  17,15 | _16,14_ | **0,7729** |
| zh→vi      | 346 |  22,33 |   42,77 | 0,8213     |
| vi→ja      | 318 |  10,96 | _19,88_ | 0,8239     |
| ja→vi      | 318 |  19,91 |   40,19 | 0,8191     |

### Ba điều bảng này nói, và một điều nó không nói

**1. COMET xếp hạng khác hẳn spBLEU.** Theo spBLEU, vi→ja (10,96) tệ hơn vi→zh (17,15)
tới 6 điểm. Theo COMET thì ngược lại: vi→ja 0,8239 **cao hơn** vi→zh 0,7729. Sáu chiều
nằm gọn trong dải 0,77–0,85 trong khi spBLEU trải từ 10,96 tới 37,13.

Đây là lý do thầy giao cả hai độ đo. spBLEU khớp chuỗi n-gram bề mặt nên phạt rất nặng
những ngôn ngữ có cách viết khác hẳn nguồn; COMET là mô hình chấm ngữ nghĩa nên nói được
"câu này diễn đạt khác nhưng vẫn đúng ý". Kết luận "dịch sang tiếng Nhật kém nhất" rút ra
từ riêng spBLEU là **sai** — chiều yếu nhất thật sự là **vi→zh**, và cả hai độ đo cùng
đồng ý ở điểm đó.

**2. chrF++ ở hai chiều đích zh/ja không so ngang được** (in nghiêng trong bảng). vi→zh
có chrF++ 16,14, _thấp hơn cả_ spBLEU của chính nó, trong khi vi→en là 57,10 so với
35,79. Không phải bản dịch tệ tới mức đó: chrF**++** cộng thêm n-gram **cấp từ**, mà
tiếng Trung/Nhật không tách từ bằng khoảng trắng nên phần đó gần như bằng 0 và kéo tụt
điểm tổng. Đây đúng là phiên bản MT của chuyện WER/CER ở mục 3. Trong báo cáo: cột chrF++
của hai chiều đích zh/ja phải có chú thích, hoặc bỏ hẳn và dựa vào spBLEU + COMET.

**3. Trung bình sáu chiều thì đừng lấy.** Sáu chiều có độ khó rất khác nhau; một con số
gộp (spBLEU 23,88) không nói lên điều gì ngoài việc trộn hai nhóm không cùng thang.

**Điều bảng không nói:** `wmt22-comet-da` được huấn luyện trên phán đoán của người chấm,
chủ yếu ở các cặp ngôn ngữ giàu dữ liệu. Độ tin của nó ở vi↔ja và vi↔zh thấp hơn ở vi↔en,
nên khoảng chênh vài phần nghìn giữa các chiều **không** đủ để kết luận chiều nào hơn
chiều nào. Chỉ khoảng cách lớn như vi→zh (0,77) so với vi→en (0,85) mới đáng nói.
