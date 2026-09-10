# Phụ lục — Bốn độ đo: WER/CER, spBLEU/chrF++, COMET, RTF

**Sinh viên:** Ngô Mạnh Hùng — 24410300 · **GVHD:** ThS. Nguyễn Thành Luân · **Ngày:** 07/09/2026

> File đi kèm bản **Báo cáo GVHD — Bộ đánh giá**. Báo cáo chứa số đo và ngưỡng đề xuất;
> file này chứa phần lý thuyết — công thức, ví dụ tính tay, các bẫy khi diễn giải, nguồn
> trích dẫn. Đây là phần thầy giao ở biên bản mục 7: _"tự tìm hiểu các thuật ngữ/độ đo
> mới: WER, BLEU, COMET, RTF"_.
>
> Chỗ nào là **đề xuất của em** chứ không phải chuẩn ngành thì có ghi rõ.

---

## 1. Vì sao phải bốn độ đo chứ không phải một

Pipeline có bốn khâu nối tiếp và mỗi khâu hỏng theo một kiểu khác nhau:

| Khâu          | Sai kiểu gì                | Đo bằng                    | Đầu vào khi đo     |
| ------------- | -------------------------- | -------------------------- | ------------------ |
| ASR           | Nghe nhầm, thêm/bớt từ     | WER (vi/en) · CER (zh/ja)  | Audio FLEURS       |
| MT            | Dịch sai nghĩa, dịch thiếu | spBLEU · chrF++ · COMET    | **Văn bản** FLEURS |
| Toàn hệ thống | Chạy không kịp người nói   | Total Inference Time · RTF | Audio FLEURS       |

Nếu chỉ đo đầu-cuối (nói tiếng Việt, nghe tiếng Anh) thì khi kết quả sai sẽ **không biết
lỗi nằm ở khâu nào** — ASR nghe nhầm hay MT dịch sai. Vì vậy MT được đo bằng văn bản có
sẵn của FLEURS, không đi qua ASR, để lỗi hai khối không cộng dồn vào nhau. Đây chính là
câu _"để tách bạch lỗi của từng khối"_ trong biên bản.

Và vì sao MT cần **hai** độ đo: BLEU đếm chữ trùng, COMET hiểu nghĩa. Hai cái bắt hai
loại lỗi khác nhau — chi tiết ở mục 5.

---

## 2. WER — Word Error Rate

### 2.1. Công thức

WER dựng trên **khoảng cách Levenshtein** giữa câu máy nghe ra và câu tham chiếu: số phép
sửa ít nhất để biến câu này thành câu kia.

$$\text{WER} = \frac{S + D + I}{N} = \frac{S + D + I}{S + D + C}$$

| Ký hiệu | Tên          | Nghĩa                                       |
| ------- | ------------ | ------------------------------------------- |
| $S$     | Substitution | Từ bị nghe **nhầm** thành từ khác           |
| $D$     | Deletion     | Từ trong câu gốc bị **bỏ sót**              |
| $I$     | Insertion    | Từ **thừa** máy tự thêm vào                 |
| $C$     | Correct      | Từ đúng                                     |
| $N$     | —            | **Tổng số từ của câu tham chiếu** ($S+D+C$) |

Càng **thấp** càng tốt. WER = 0 là chép lại hoàn hảo.

### 2.2. Ví dụ tính tay

Lấy đúng một lỗi bắt được trên máy thật — câu _"Độ trễ hiện tại"_ bị nghe thành _"Vụ trễ
hiện tại"_:

| Tham chiếu | độ     | trễ | hiện | tại | là        | hai | giây |
| ---------- | ------ | --- | ---- | --- | --------- | --- | ---- |
| Máy nghe   | **vụ** | trễ | hiện | tại | **(mất)** | hai | giây |
| Loại       | S      | C   | C    | C   | D         | C   | C    |

$S=1$, $D=1$, $I=0$, $N=6$ → $\text{WER} = (1+1+0)/6 = 33{,}3\%$.

### 2.3. Bốn cái bẫy khi đọc con số WER

**a) WER có thể vượt quá 100%.** Mẫu số là độ dài câu **tham chiếu**, còn $I$ không bị
chặn trên: máy bịa ra 20 từ cho một câu tham chiếu 5 từ là WER 400%. Điều này liên quan
trực tiếp tới hiện tượng hallucination trên đoạn im lặng thầy nêu ở biên bản mục 4.1 —
một câu ma đủ dài kéo WER của cả bảng lên. Em đã gặp thật, xem mục 7.

Đó cũng là lý do bảng kết quả có thêm cột **"câu rỗng"** — số câu ASR không ra chữ nào —
để phát hiện sớm việc đo hỏng thay vì nhận một con số WER cao mà không hiểu vì sao.

**b) Cộng gộp khác lấy trung bình.** Có hai cách tính WER cho một tập nhiều câu: **gộp**
(cộng hết lỗi rồi chia tổng số từ) và **trung bình từng câu**. Đề tài dùng cách **gộp**,
vì cách kia để một câu 3 từ sai hết (WER 100%) kéo lệch cả bảng ngang với một câu 40 từ.
Hai cách ra hai con số khác nhau trên cùng dữ liệu nên báo cáo phải ghi rõ đang dùng cách
nào.

**c) WER phụ thuộc nặng vào bước chuẩn hoá.** `"2019"` so với `"hai nghìn không trăm mười
chín"` là sai 100% theo WER dù nghe đúng hoàn toàn; tương tự với dấu câu, chữ hoa,
`"phần trăm"` với `"%"`. FLEURS đã chuẩn hoá sẵn cột transcription nên phần chuẩn hoá chỉ
phải đưa đầu ra của Whisper về cùng dạng — **giữ dấu tiếng Việt** vì dấu mang nghĩa. Phần
số và viết tắt thì chưa chuẩn hoá; đây là hạn chế đã ghi trong báo cáo.

**d) WER không phân biệt lỗi nặng nhẹ.** Nghe `"không"` thành `"có"` (đảo ngược nghĩa) và
nghe `"đã"` thành `"đang"` đều tính là 1 lỗi. WER là độ đo **bề mặt**, không phải độ đo
hiểu nghĩa.

### 2.4. Bao nhiêu thì gọi là tốt

Không có ngưỡng chuẩn quốc tế — WER phụ thuộc ngôn ngữ, miền dữ liệu và độ khó của audio.
Các mốc thường được dùng để tham chiếu:

| WER       | Diễn giải thường gặp                                                     |
| --------- | ------------------------------------------------------------------------ |
| < 5 %     | Chất lượng gần con người trên audio sạch; đọc phụ đề gần như không vướng |
| 5 – 10 %  | Dùng tốt cho phụ đề/ghi chú, thỉnh thoảng phải đoán                      |
| 10 – 20 % | Nắm được ý, nhưng lỗi thấy rõ                                            |
| > 25 %    | Khó dùng cho việc dịch tiếp, vì lỗi ASR sẽ nhân lên ở khâu MT            |

Mốc sát đề tài nhất là chính bài báo Whisper, nhưng OpenAI **chỉ công bố biểu đồ** WER/CER
theo ngôn ngữ chứ không có bảng số đọc được cho riêng vi/ja/zh. Nên báo cáo không nên
trích số cụ thể của OpenAI mà nói "cùng hạng" rồi đưa số tự đo — đây cũng chính là lý do
phải tự chạy phần đánh giá.

---

## 3. CER — và vì sao zh/ja bắt buộc phải dùng nó

**CER** (Character Error Rate) là đúng công thức trên nhưng đếm trên chuỗi **ký tự** thay
vì chuỗi từ.

Tiếng Trung và tiếng Nhật **không tách từ bằng khoảng trắng**. Chấm WER cho hai thứ tiếng
đó thực chất là chấm theo chỗ Whisper _tình cờ_ chèn dấu cách — cùng một câu đúng nghĩa
có thể ra WER 0% hay 100% tuỳ cách chèn. Đây không phải ý kiến riêng mà là quy ước ngành:

- **Bài báo FLEURS** (Conneau và cộng sự, 2022) — chính bộ dữ liệu thầy giao — dùng CER
  cho nhóm CJK.
- **Bài báo Whisper** (Radford và cộng sự, 2023) dùng CER cho đúng năm thứ tiếng: Trung,
  Nhật, Thái, Lào, Miến; bản `large-v3` bổ sung tiếng Hàn. Trong biểu đồ kết quả của
  OpenAI, ngôn ngữ chấm bằng CER được in **nghiêng** để không lẫn với WER.
- Tài liệu tổng hợp năm 2025 tại NAACL nêu thẳng: ngôn ngữ không có ranh giới từ chỉ chấm
  được WER **sau một bước tách từ chủ quan và có thể sai**.

> **Hệ quả phải nhớ:** WER và CER **không so được với nhau**. Không được viết "trung bình
> WER bốn ngôn ngữ" khi hai trong bốn cột là CER. CER thường thấp hơn WER trên cùng chất
> lượng nhận dạng, vì sai một ký tự trong một từ chỉ tính là một lỗi ký tự chứ không hỏng
> cả từ.

---

## 4. BLEU, spBLEU và chrF++

### 4.1. BLEU hỏi gì

BLEU (Papineni và cộng sự, 2002) hỏi một câu duy nhất: **bản dịch máy dùng lại bao nhiêu
cụm từ của bản dịch tham chiếu?** Nó đếm độ trùng n-gram (cụm 1, 2, 3, 4 từ liên tiếp),
rồi phạt những bản dịch quá ngắn:

$$\text{BLEU} = \text{BP} \cdot \exp\left(\sum_{n=1}^{4} w_n \log p_n\right), \quad w_n = \tfrac{1}{4}$$

$$\text{BP} = \begin{cases} 1 & \text{nếu } c > r \\ e^{(1 - r/c)} & \text{nếu } c \le r \end{cases}$$

- $p_n$ — **modified n-gram precision**: tỉ lệ n-gram của bản dịch máy có xuất hiện trong
  bản tham chiếu. Chữ _modified_ nghĩa là mỗi n-gram chỉ được tính tối đa bằng số lần nó
  xuất hiện trong tham chiếu; nếu không, dịch ra `"the the the the"` sẽ đạt precision 100%.
- $\text{BP}$ — **brevity penalty**: $c$ là độ dài bản dịch máy, $r$ là độ dài tham chiếu.
  BLEU không có thành phần _recall_, nên nếu không phạt thì dịch một từ duy nhất mà từ đó
  đúng sẽ được điểm tuyệt đối.
- Trung bình **hình học** của bốn $p_n$: chỉ cần $p_4 = 0$ là cả điểm về 0. Đây là lý do
  BLEU rất khắc nghiệt trên **từng câu riêng lẻ**.

Thang 0–100, càng **cao** càng tốt.

### 4.2. Ba cái bẫy, và cách đề tài tránh

**a) BLEU là độ đo mức tập, không phải mức câu.** Tài liệu Google Cloud Translation ghi
rõ: BLEU hoạt động kém trên từng câu, một câu đơn lẻ có thể bị điểm rất thấp dù đã truyền
tải gần đủ nghĩa. Vì vậy BLEU chỉ được báo cáo cho **cả tập test**, không bao giờ cho một
câu demo.

**b) BLEU phụ thuộc bộ tách từ — cái bẫy lớn nhất.** Matt Post (2018) đo được chênh lệch
tới **1,8 điểm BLEU** chỉ do khác cách tách từ và chuẩn hoá, lớn hơn cả mức cải thiện mà
nhiều bài báo công bố. Hệ quả: hai bài báo cùng ghi "BLEU 30" có thể **không so được với
nhau**. Lời giải là **sacreBLEU** — một cách tính chuẩn hoá, tự sinh ra chữ ký ghi lại
đúng cấu hình đã dùng để người khác tái lập được.

**c) sacreBLEU mặc định vẫn không đủ cho ngôn ngữ không có dấu cách.** Tokenizer mặc định
`13a` tách theo khoảng trắng kiểu Moses — vô nghĩa với tiếng Trung, tiếng Nhật. FLORES-101
giải quyết bằng **spBLEU**: tách từ bằng một mô hình **SentencePiece đa ngữ dùng chung
cho mọi ngôn ngữ**.

Đề tài dùng đúng cách đó — `sacrebleu` với tokenizer `flores200`. Được hai thứ: số của đề
tài **đặt cạnh số công bố của NLLB-200 là so sánh được** (bài báo NLLB dùng đúng spBLEU
trên FLORES), và **một tokenizer duy nhất cho cả 6 chiều** nên 6 con số trong bảng so
được với nhau.

### 4.3. chrF++ đi kèm làm gì

**chrF++** (Popović, 2017) tính F-score trên **n-gram ký tự**, cộng thêm 2-gram từ — đó là
dấu `++`. Nó có mặt vì **ổn định hơn BLEU trên tập nhỏ** (mỗi chiều chỉ 318–347 câu, mà
BLEU dựa trên 4-gram cần nhiều dữ liệu hơn thế để đứng yên) và **ít phụ thuộc cách tách
từ**. Bài báo NLLB-200 **báo cáo chính bằng chrF++** và chỉ đưa spBLEU kèm theo — đề tài
làm theo đúng thứ tự ưu tiên đó.

Nhưng chính phần `++` lại là chỗ chrF++ mất công bằng với zh/ja: n-gram **cấp từ** gần như
bằng 0 khi không có khoảng trắng, nên điểm tổng bị kéo tụt. Đây đúng là phiên bản MT của
chuyện WER/CER ở mục 3, và là lý do bảng kết quả in nghiêng hai ô đó.

### 4.4. Bao nhiêu thì gọi là tốt

| spBLEU  | Diễn giải thường gặp           |
| ------- | ------------------------------ |
| < 20    | Khó hiểu, chỉ đoán được chủ đề |
| 20 – 30 | Nắm được ý, câu cú còn vụng    |
| 30 – 40 | Hiểu được, chất lượng khá      |
| 40 – 50 | Tốt, gần mức bản dịch người    |
| > 50    | Rất tốt                        |

**Ba cảnh báo bắt buộc phải nói kèm bảng này:**

1. **Không so BLEU giữa hai cặp ngôn ngữ khác nhau.** Google nói thẳng: BLEU 50 của
   Anh→Đức không so được với BLEU 50 của Nhật→Anh. Trong bảng 6 chiều, so giữa các model
   trên cùng một chiều thì được, so ngang giữa các chiều thì không.
2. **Bản dịch của người cũng không đạt 100.** Hai người dịch giỏi dịch cùng một câu vẫn ra
   hai bản khác nhau, nên trần thực tế của BLEU thấp hơn 100 rất nhiều.
3. Dải trên là **quy ước dân gian**, không phải chuẩn có nguồn chính thức — tài liệu
   Google Cloud hiện tại không còn bảng này. Báo cáo nên trình bày nó như "mốc tham khảo
   thường gặp".

---

## 5. COMET

### 5.1. Nó khác BLEU ở chỗ nào

BLEU đếm chữ trùng. COMET **hiểu nghĩa**:

|            |                                      |
| ---------- | ------------------------------------ |
| Nguồn      | `Tôi không đồng ý với đề xuất này.`  |
| Tham chiếu | `I do not agree with this proposal.` |
| Máy dịch A | `I disagree with this proposal.`     |
| Máy dịch B | `I do not agree with this purpose.`  |

Bản A **đúng nghĩa hoàn toàn** nhưng gần như không trùng n-gram dài nào với tham chiếu →
BLEU thấp. Bản B chỉ sai một từ nhưng **sai nghĩa** → BLEU cao. COMET đảo ngược thứ tự
này lại cho đúng. Đây chính là lý do thầy yêu cầu **cả hai** độ đo chứ không chỉ BLEU.

### 5.2. Cơ chế

COMET (Rei và cộng sự) là một **độ đo dựa trên mô hình neural**, không phải công thức đếm:

- Nền là **XLM-R**, một mô hình ngôn ngữ đa ngữ (109 ngôn ngữ — cả bốn ngôn ngữ của đề
  tài đều nằm trong vùng hợp lệ).
- Được **fine-tune trên điểm chấm của người thật** — Direct Assessment của WMT17–WMT20,
  tức điểm mà dịch giả người thật đã cho các bản dịch máy.
- Bản **`Unbabel/wmt22-comet-da`** thầy chỉ định là loại **reference-based**: nhận vào
  **bộ ba** (câu nguồn, bản dịch máy, bản dịch tham chiếu) chứ không chỉ hai câu như BLEU.
  Việc nhìn được cả câu nguồn là điều BLEU không làm được.

Nói cách khác, COMET là một mô hình học cách **dự đoán điểm mà người sẽ chấm**. Đây cũng
là bản nộp của Unbabel–IST cho WMT22 Metrics Shared Task.

### 5.3. Đọc điểm COMET thế nào

Thang **0–1, càng cao càng tốt**. Điểm quan trọng nhất, cũng là chỗ dễ sai nhất:

> **Điểm COMET không phải phần trăm.** COMET 0,85 **không** có nghĩa "dịch đúng 85%". Nó
> là đầu ra hồi quy của một mô hình. Dùng nó để **xếp hạng** các hệ thống trên cùng một
> tập test, đừng dùng như một lời hứa chất lượng tuyệt đối.

Vì sao phải nhấn mạnh: các bản COMET **trước** phiên bản 2.0 xuất điểm dạng z-score không
có chặn, và báo cáo chính thức của WMT22 ghi nhận điểm có thể vượt 100 hoặc âm dưới −100,
kết luận thẳng rằng _"điểm COMET tuyệt đối là không có thông tin dù dùng model nào"_ —
nhưng **thứ hạng** thì mọi model đều cho gần như nhau. Bản `wmt22-comet-da` sinh ra chính
để sửa chuyện đó bằng cách chặn về [0, 1]. Hệ quả: **không so điểm của checkpoint này với
điểm của bài báo dùng checkpoint khác**, và báo cáo phải ghi rõ tên checkpoint bên cạnh
con số.

### 5.4. Vì sao WMT nói "Stop Using BLEU" mà đề tài vẫn giữ BLEU

Báo cáo chính thức của WMT22 Metrics Shared Task có tựa đề đúng nghĩa đen là **"Results
of WMT22 Metrics Shared Task: Stop Using BLEU"**: các độ đo neural như COMET tương quan
với đánh giá của người tốt hơn hẳn BLEU, nên tiếp tục xếp hạng hệ thống bằng BLEU là sai
phương pháp.

Đề tài vẫn giữ BLEU, có chủ đích. BLEU **minh bạch và tính tay được** — hội đồng hỏi "con
số này ở đâu ra" thì trả lời được bằng công thức, còn COMET thì phải trả lời "một mô hình
neural chấm". BLEU cũng cho phép **đặt cạnh số công bố của NLLB-200**, thứ COMET không làm
được vì bài báo NLLB không báo cáo COMET cho các cặp này. Cách dùng: COMET là độ đo
**quyết định** khi hai cấu hình chênh nhau, spBLEU/chrF++ là độ đo **kiểm chứng chéo**;
khi hai độ đo mâu thuẫn thì đó là tín hiệu phải đi đọc lại câu dịch thật.

### 5.5. Cái giá kỹ thuật

Model nặng ~2,3 GB, và `unbabel-comet` ghim `numpy<2` + `transformers<5` trong khi dịch
vụ cần `numpy>=2.4` + `transformers>=5.14` — **không cài chung một môi trường được**. Nên
bước chấm COMET được tách thành một script độc lập tự dựng môi trường riêng, đọc file kết
quả của bước dịch rồi ghi điểm ngược vào. COMET chỉ chạy ở khâu **đánh giá offline**,
không nằm trong ứng dụng người dùng cài, nên nó **không** vi phạm nguyên tắc "chạy hoàn
toàn cục bộ" của đề tài.

---

## 6. RTF — Real-Time Factor

$$\text{RTF} = \frac{\text{thời gian xử lý (wall-clock)}}{\text{thời lượng audio đầu vào}}$$

Đây là định nghĩa chuẩn dùng trong Kaldi, whisper.cpp, ESPnet và các bài báo ASR: **máy
giải mã chậm hơn người nói bao nhiêu lần**. Càng nhỏ càng tốt. Tử số trong đề tài là
**Total Inference Time** — tổng thời gian tính toán của cả chuỗi VAD → ASR → MT → TTS.

**Cái bẫy: có tài liệu định nghĩa ngược** (audio ÷ xử lý), lúc đó "càng lớn càng tốt" và
ngưỡng đảo chiều. Cách viết phổ biến để tránh nhầm là gọi chiều ngược đó là **RTFx** —
bảng xếp hạng Open ASR của HuggingFace dùng RTFx theo nghĩa này. Báo cáo phải ghi rõ
chiều ngay dưới bảng.

Phần ngưỡng "đạt", lý do lấy p90 thay vì trung bình, và lý do RTF **không phải** độ trễ
người dùng cảm nhận nằm ở **mục 3 của bản báo cáo** gửi kèm.

---

## 7. Chọn model bằng số đo

Biên bản mục 5 ghi: hội đồng sẽ hỏi "tại sao chọn những mô hình này", và câu trả lời nên
có số liệu chứng minh. Bảng dưới đo trên cùng **20 câu đầu tiếng Việt** của FLEURS `test`,
cùng tham số giải mã, trên Apple M4:

| Model                                   | Trên đĩa |    WER |   RTF | Ước tính chạy đầy đủ 4 ngôn ngữ |
| --------------------------------------- | -------: | -----: | ----: | ------------------------------- |
| `whisper-large-v3-asr-fp16` (MLX)       |   2,9 GB |   6,7% |  0,18 | ~110 phút                       |
| `whisper-large-v3-asr-8bit` (MLX)       |   1,2 GB |   6,7% |  0,14 | ~86 phút ← **đã chọn**          |
| `whisper-large-v3-asr-4bit` (MLX)       |   852 MB |   7,2% |  0,13 | ~80 phút                        |
| `whisper-large-v3-turbo-asr-fp16` (MLX) |   1,5 GB |   8,1% |  0,08 | ~49 phút                        |
| `whisper-large-v3-turbo-asr-8bit` (MLX) |   829 MB |   8,1% |  0,08 | ~49 phút                        |
| `whisper-large-v3-turbo-asr-4bit` (MLX) |   447 MB |   8,9% |  0,08 | ~49 phút                        |
| `whisper-small-asr-fp16` (MLX)          |   490 MB | 133,5% |  0,14 | không dùng được                 |
| `large-v3-turbo-q5_0` (whisper.cpp)     |   570 MB |   8,6% | 0,089 | ~55 phút                        |

**Ba điều rút ra:**

1. **Lượng tử hoá gần như miễn phí.** fp16 → 8bit **không đổi WER** (6,7% cả hai) nhưng
   nhỏ hơn 2,3 lần và nhanh hơn 22%. Xuống 4bit mới mất 0,5–0,8 điểm.
2. **Turbo mới là chỗ đánh đổi thật:** nhanh gấp ~2 lần nhưng mất 1,4 điểm WER. Đây là
   quyết định sản phẩm chứ không phải quyết định kỹ thuật, và là cơ sở cho ba preset
   Nhanh / Cân bằng / Chất lượng thầy gợi ý ở biên bản mục 5.
3. **Bản `small` của mlx-community hỏng.** WER 133,5% — vượt 100% được vì lỗi **chèn** cũng
   bị tính, đúng cái bẫy ở mục 2.3 — với 10/20 câu trả rỗng, số còn lại rơi vào vòng lặp
   lặp chữ. Bản **cùng cỡ** ở định dạng GGML chạy bình thường (WER 20,6%, 0 câu rỗng), nên
   lỗi nằm ở bản chuyển đổi chứ không phải ở cỡ model hay tham số giải mã. Đáng chú ý hơn:
   bản hỏng còn **chậm hơn** mọi model lớn (RTF 0,28–0,38), vì kẹt vòng lặp thì nó sinh
   token tới khi hết hạn mức.

**Hai giới hạn của bảng này** phải nói kèm khi trích: chỉ 20 câu và chỉ tiếng Việt, nên
chênh lệch dưới ~1 điểm WER chưa kết luận được; và dòng whisper.cpp khác dòng MLX ở **cả**
runtime lẫn cỡ model nên nó không phải phép so runtime thuần tuý. Chạy đầy đủ cùng model
đã chọn cho WER 8,8% chứ không phải 6,7% — bảng 20 câu chỉ đủ để **chọn** model, không đủ
làm con số báo cáo.

---

## 8. Bảng tóm tắt bốn độ đo

|                           | WER / CER               | spBLEU                      | COMET               | RTF                    |
| ------------------------- | ----------------------- | --------------------------- | ------------------- | ---------------------- |
| Đo cái gì                 | ASR chép đúng không     | MT trùng chữ với tham chiếu | MT đúng nghĩa không | Chạy có kịp không      |
| Kiểu độ đo                | Đếm lỗi soạn thảo       | Đếm n-gram trùng            | Mô hình neural      | Tỉ số thời gian        |
| Thang                     | 0 → ∞ (%), **thấp** tốt | 0 – 100, **cao** tốt        | 0 – 1, **cao** tốt  | 0 → ∞, **thấp** tốt    |
| Mức đạt (đề xuất)         | ≤ 10 %                  | ≥ 30                        | dùng để xếp hạng    | **p90 ≤ 0,5**          |
| Có phải % không           | Có                      | Không                       | **Không**           | Không                  |
| So được giữa các ngôn ngữ | Không (WER≠CER)         | **Không**                   | Thận trọng          | Có, nếu cùng máy       |
| So được giữa các model    | Có, cùng tập test       | Có, cùng tokenizer          | Có, cùng checkpoint | Có, **cùng phần cứng** |

---

## 9. Nguồn trích dẫn

**Độ đo ASR**

- Conneau, A. và cộng sự (2022). _FLEURS: Few-shot Learning Evaluation of Universal
  Representations of Speech._ — bộ dữ liệu của đề tài; dùng CER cho nhóm CJK.
  https://arxiv.org/pdf/2205.12446
- Radford, A. và cộng sự (2023). _Robust Speech Recognition via Large-Scale Weak
  Supervision_ (Whisper) — quy ước CER cho zh/ja/th/lo/my.
  https://github.com/openai/whisper
- Thông báo phát hành `large-v3` kèm biểu đồ WER/CER theo ngôn ngữ trên Common Voice 15 +
  FLEURS. https://github.com/openai/whisper/discussions/1762
- _Advocating Character Error Rate for Multilingual ASR Evaluation_ (Findings of NAACL
  2025). https://aclanthology.org/2025.findings-naacl.277.pdf

**Độ đo MT**

- Papineni, K. và cộng sự (2002). _BLEU: a Method for Automatic Evaluation of Machine
  Translation._ https://aclanthology.org/P02-1040/
- Post, M. (2018). _A Call for Clarity in Reporting BLEU Scores._ WMT 2018 — sacreBLEU;
  chênh lệch tới 1,8 BLEU chỉ do khác cách tách từ. https://aclanthology.org/W18-6319/
- Goyal, N. và cộng sự (2022). _The FLORES-101 Evaluation Benchmark_ — định nghĩa spBLEU.
  https://arxiv.org/pdf/2106.03193
- NLLB Team (2022). _No Language Left Behind: Scaling Human-Centered Machine Translation_
  — báo cáo chính bằng chrF++, kèm spBLEU trên FLORES. https://arxiv.org/pdf/2207.04672
- Rei, R. và cộng sự (2022). _COMET-22: Unbabel-IST 2022 Submission for the Metrics Shared
  Task._ — bài báo của chính checkpoint `Unbabel/wmt22-comet-da`.
  https://aclanthology.org/2022.wmt-1.52/
- Freitag, M. và cộng sự (2022). _Results of WMT22 Metrics Shared Task: Stop Using BLEU._
  https://statmt.org/wmt22/pdf/2022.wmt-1.2.pdf
- Unbabel. _Introducing Unbabel-COMET v2.0_ — vì sao chặn điểm về [0, 1].
  https://unbabel.com/introducing-unbabel-comet-v2-0-improved-models-and-metrics-for-better-machine-translation-evaluation/
- Google Cloud Translation. _The BLEU translation quality metric._
  https://docs.cloud.google.com/translate/docs/bleu-scores

**RTF và độ trễ**

- ExKaldi-RT (2021) — RTF trong hệ ASR trực tuyến. https://arxiv.org/pdf/2104.01384
- _Conformer-Based Speech Recognition On Extreme Edge-Computing Devices_ (Apple, 2023) —
  lập luận RTF ít nhất 0,5 mới là mục tiêu hợp lý. https://arxiv.org/pdf/2312.10359
- _Evaluation of real-time transcriptions using end-to-end ASR models_ (2024) — RTF ≤ 1 là
  điều kiện nhận dạng thời gian thực. https://arxiv.org/html/2409.05674v1
- _Low Latency ASR for Simultaneous Speech Translation_ (2020) — RTF không phản ánh độ trễ
  người dùng cảm nhận. https://arxiv.org/pdf/2003.09891
- _Defining maximum acceptable latency of AI-enhanced CAI tools_ (2022) — phiên dịch viên
  chịu được ~3 giây độ trễ do công cụ thêm vào. https://arxiv.org/pdf/2201.02792
- _Spatial Speech Translation: Translating Across Space With Binaural Hearables_ (2025) —
  người nghe đa số chọn mức trễ 3–4 giây. https://arxiv.org/pdf/2504.18715
- Lee, T.-H. _Ear Voice Span in English into Korean Simultaneous Interpretation_ — EVS
  trung bình ~3 giây trên ~800 câu.
- ITU-T Recommendation G.114 — mốc 150 ms cho **truyền dẫn thoại**; nêu ở đây để giải
  thích vì sao **không** dùng. https://www.itu.int/rec/T-REC-G.114
