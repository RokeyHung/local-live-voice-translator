# 26 — Bốn độ đo thầy giao: WER, BLEU, COMET, RTF

**Nguồn yêu cầu:** [biên bản họp GVHD 19/08/2026](meetings/bien-ban-hop-GVHD-2026-08-19.md) — mục 7,
Ưu tiên 1, gạch đầu dòng _"Tự tìm hiểu các thuật ngữ/độ đo mới: WER, BLEU, COMET, RTF"_ và
_"Tra công thức RTF và ngưỡng real-time, **báo cáo lại cho thầy**"_ (mục 3c + câu hỏi số 2).

**Ngày soạn:** 06/09/2026

> Quan hệ với các tài liệu khác:
>
> - [`17`](17_bo-danh-gia-fleurs.md) trả lời **"code chạy thế nào"** — lệnh, dữ liệu, file JSON.
> - Tài liệu **này** trả lời **"con số đó nghĩa là gì"** — định nghĩa, công thức, cái bẫy khi
>   diễn giải, và ngưỡng nào thì gọi là đạt. Đây là phần đem đi bảo vệ trước hội đồng, và
>   **mục 5 là phần gửi thầy**.
> - [`25`](25_ket-qua-chay-thu-e2e.md) là số đo thật đầu tiên trên máy.

Mọi khẳng định trong tài liệu này đều có nguồn ở [mục 9](#9-nguồn-trích-dẫn). Chỗ nào là **đề
xuất của sinh viên** chứ không phải chuẩn ngành thì được ghi rõ.

---

## 1. Vì sao phải có bốn độ đo chứ không phải một

Pipeline của đề tài có bốn khâu nối tiếp nhau, và mỗi khâu hỏng theo một kiểu khác nhau:

| Khâu              | Sai kiểu gì                           | Đo bằng                |
| ----------------- | ------------------------------------- | ---------------------- |
| ASR (nghe ra chữ) | Nghe nhầm từ, thêm/bớt từ             | **WER** (hoặc **CER**) |
| MT (dịch)         | Dịch sai nghĩa, dịch thiếu, dịch cứng | **BLEU** + **COMET**   |
| Toàn hệ thống     | Chạy không kịp người nói              | **RTF**                |

Nếu chỉ đo đầu-cuối (nói tiếng Việt → nghe tiếng Anh) thì khi kết quả sai sẽ **không biết lỗi
nằm ở khâu nào**: ASR nghe nhầm hay MT dịch sai? Vì vậy thầy giao cách đo tách bạch — ASR đo
riêng bằng audio FLEURS, MT đo riêng bằng **văn bản** FLEURS (không đi qua ASR), rồi mới đo độ
trễ trên cả chuỗi. Đây chính là câu _"để tách bạch lỗi của từng khối"_ trong biên bản mục 3b.

Và vì sao MT cần **hai** độ đo: BLEU đếm chữ trùng khớp, COMET hiểu nghĩa. Hai cái bắt hai loại
lỗi khác nhau — chi tiết ở mục 4.

---

## 2. WER — Word Error Rate

### 2.1. Công thức

WER dựng trên **khoảng cách Levenshtein** (khoảng cách soạn thảo) giữa câu máy nghe ra
(_hypothesis_) và câu tham chiếu (_reference_): số phép sửa ít nhất để biến câu này thành câu
kia.

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

|             |                                          |
| ----------- | ---------------------------------------- |
| Tham chiếu  | `độ trễ hiện tại là hai giây` (N = 6 từ) |
| Máy nghe ra | `vụ trễ hiện tại hai giây`               |

Căn hàng hai câu:

| Tham chiếu | độ     | trễ | hiện | tại | là        | hai | giây |
| ---------- | ------ | --- | ---- | --- | --------- | --- | ---- |
| Máy        | **vụ** | trễ | hiện | tại | **(mất)** | hai | giây |
| Loại       | S      | C   | C    | C   | D         | C   | C    |

$S=1$, $D=1$, $I=0$, $N=6$ → $\text{WER} = (1+1+0)/6 = 0{,}333 = 33{,}3\%$.

Đây đúng dạng lỗi đã bắt được trên máy thật: câu `vi-05` trong [`25`](25_ket-qua-chay-thu-e2e.md)
mục 4 là _"**Độ** trễ hiện tại"_ bị nghe thành _"**Vụ** trễ hiện tại"_.

### 2.3. Bốn cái bẫy khi đọc con số WER

**a) WER có thể vượt quá 100%.** Mẫu số là độ dài câu **tham chiếu**, còn $I$ thì không bị chặn
trên. Máy bịa ra 20 từ cho một câu tham chiếu 5 từ là WER 400%. Điều này liên quan trực tiếp tới
mục 4.1 của biên bản (hallucination trên đoạn im lặng): một câu ma dài trên đoạn im lặng đủ sức
kéo WER của cả bảng lên. Vì vậy bảng kết quả của `eval_asr.py` có thêm cột **`rỗng`** — số câu
ASR không ra chữ nào — để phát hiện sớm việc đo hỏng.

**b) Cộng gộp ≠ lấy trung bình.** Có hai cách tính WER cho một tập nhiều câu:

- **Gộp (corpus-level):** $\sum(S+D+I) \big/ \sum N$ — cộng hết lỗi rồi chia cho tổng số từ.
- **Trung bình từng câu:** tính WER mỗi câu rồi lấy trung bình cộng.

Dự án dùng **cách gộp** (`metrics.error_rate` gọi `jiwer.wer` trên cả danh sách). Lý do: cách
trung bình để một câu ngắn 3 từ sai hết (WER 100%) kéo lệch cả bảng ngang với một câu 40 từ. Báo
cáo phải ghi rõ đang dùng cách nào, vì hai cách ra hai con số khác nhau trên cùng dữ liệu.

**c) WER phụ thuộc nặng vào bước chuẩn hoá.** `"2019"` so với `"hai nghìn không trăm mười chín"`
là 100% sai theo WER, dù nghe đúng hoàn toàn. Tương tự với dấu câu, chữ hoa, `"phần trăm"` vs
`"%"`. FLEURS đã chuẩn hoá sẵn cột `transcription` (chữ thường, bỏ dấu câu), nên
`metrics.normalize()` chỉ phải đưa đầu ra của Whisper về cùng dạng — **giữ dấu tiếng Việt** vì
dấu mang nghĩa. Phần số và viết tắt thì chưa chuẩn hoá; đây là hạn chế đã ghi ở
[`17`](17_bo-danh-gia-fleurs.md) mục 6, làm WER đo được **cao hơn** WER thật một chút. Sai lệch
này đều nhau ở mọi cấu hình nên không ảnh hưởng phần **so sánh giữa các model**.

**d) WER không phân biệt lỗi nặng nhẹ.** Nghe `"không"` thành `"có"` (đảo ngược nghĩa) và nghe
`"đã"` thành `"đang"` đều tính là 1 lỗi. WER là độ đo **bề mặt**, không phải độ đo hiểu nghĩa.

### 2.4. CER — và vì sao zh/ja bắt buộc phải dùng nó

**CER** (Character Error Rate) là đúng công thức trên nhưng đếm trên chuỗi **ký tự** thay vì
chuỗi từ.

Tiếng Trung và tiếng Nhật **không tách từ bằng khoảng trắng**. Chấm WER cho hai thứ tiếng đó thực
chất là chấm theo chỗ Whisper _tình cờ_ chèn dấu cách — cùng một câu đúng nghĩa có thể ra WER 0%
hay 100% tuỳ cách chèn. Đây không phải ý kiến riêng, mà là quy ước ngành:

- **Bài báo FLEURS** (Conneau và cộng sự, 2022) dùng CER cho nhóm CJK.
- **Bài báo Whisper** (Radford và cộng sự, 2023) dùng CER cho đúng năm thứ tiếng: **Trung, Nhật,
  Thái, Lào, Miến Điện**; bản `large-v3` bổ sung tiếng Hàn. Trong biểu đồ kết quả của OpenAI,
  ngôn ngữ chấm bằng CER được in **nghiêng** để không lẫn với WER.
- Tài liệu tổng hợp năm 2025 tại NAACL (_Advocating Character Error Rate for Multilingual ASR_)
  nêu thẳng: ngôn ngữ không có ranh giới từ chỉ chấm được WER **sau một bước tách từ chủ quan và
  có thể sai**, nên nghiên cứu hiện đại dùng CER.

Vì vậy đề tài chấm **WER cho vi/en** và **CER cho zh/ja**, mỗi dòng bảng ghi rõ đang là chỉ số
nào (`metrics.metric_name()`), **không** gộp thành một cột "WER" cho gọn. Đây là điểm khác so với
kế hoạch thầy giao ghi "WER" cho cả bốn ngôn ngữ — cần báo lại thầy, và đây là một điểm cộng khi
bảo vệ vì nó cho thấy đã đọc tới nơi.

> **Hệ quả phải nhớ:** WER và CER **không so được với nhau**. Không được viết "trung bình WER bốn
> ngôn ngữ" khi hai trong bốn cột là CER. CER thường thấp hơn WER trên cùng chất lượng nhận dạng,
> vì sai một ký tự trong một từ chỉ tính là một lỗi ký tự chứ không hỏng cả từ.

### 2.5. Bao nhiêu thì gọi là tốt

Không có ngưỡng chuẩn quốc tế cho WER — nó phụ thuộc ngôn ngữ, miền dữ liệu và độ khó của audio.
Các mốc thường được dùng để tham chiếu:

| WER       | Diễn giải thường gặp                                                     |
| --------- | ------------------------------------------------------------------------ |
| < 5 %     | Chất lượng gần con người trên audio sạch; đọc phụ đề gần như không vướng |
| 5 – 10 %  | Dùng tốt cho phụ đề/ghi chú, thỉnh thoảng phải đoán                      |
| 10 – 20 % | Nắm được ý, nhưng lỗi thấy rõ                                            |
| > 25 %    | Khó dùng cho việc dịch tiếp, vì lỗi ASR sẽ nhân lên ở khâu MT            |

Mốc tham chiếu sát đề tài nhất là chính bài báo Whisper: `large-v3` được OpenAI công bố kèm biểu
đồ WER/CER theo từng ngôn ngữ trên Common Voice 15 + FLEURS, và ghi nhận giảm 10–20% lỗi so với
`large-v2`. **Không có bảng số công bố chính thức** cho riêng vi/ja/zh trên FLEURS ở dạng đọc
được — chỉ có biểu đồ — nên báo cáo **không nên** trích số cụ thể của OpenAI mà nên nói "cùng
hạng" và đưa số tự đo. Đây cũng chính là lý do phải tự chạy `make eval-asr`.

---

## 3. BLEU — Bilingual Evaluation Understudy

### 3.1. Ý tưởng

BLEU (Papineni và cộng sự, 2002) hỏi một câu duy nhất: **bản dịch máy dùng lại bao nhiêu cụm từ
của bản dịch tham chiếu?** Nó đếm độ trùng khớp n-gram (cụm 1, 2, 3, 4 từ liên tiếp), rồi phạt
những bản dịch quá ngắn.

$$\text{BLEU} = \text{BP} \cdot \exp\left(\sum_{n=1}^{4} w_n \log p_n\right), \quad w_n = \tfrac{1}{4}$$

$$\text{BP} = \begin{cases} 1 & \text{nếu } c > r \\ e^{(1 - r/c)} & \text{nếu } c \le r \end{cases}$$

- $p_n$ — **modified n-gram precision**: tỉ lệ n-gram của bản dịch máy có xuất hiện trong bản
  tham chiếu. Chữ _modified_ nghĩa là mỗi n-gram chỉ được tính tối đa bằng số lần nó xuất hiện
  trong tham chiếu — nếu không, dịch ra `"the the the the"` sẽ đạt precision 100%.
- $\text{BP}$ — **brevity penalty**: $c$ là độ dài bản dịch máy, $r$ là độ dài tham chiếu. BLEU
  không có thành phần _recall_, nên nếu không phạt thì dịch một từ duy nhất mà từ đó đúng sẽ được
  điểm tuyệt đối. BP là thứ chặn chuyện đó.
- Trung bình **hình học** của bốn $p_n$: chỉ cần $p_4 = 0$ (không có cụm 4 từ nào trùng) là cả
  điểm về 0. Đây là lý do BLEU rất khắc nghiệt trên **từng câu riêng lẻ**.

Thang điểm thường báo cáo là **0–100**, càng **cao** càng tốt.

### 3.2. Ba cái bẫy — và cái nào đề tài đã tránh

**a) BLEU là độ đo mức tập, không phải mức câu.** Google ghi rõ trong tài liệu Cloud Translation:
BLEU hoạt động kém trên từng câu, một câu đơn lẻ có thể bị điểm rất thấp dù đã truyền tải gần đủ
nghĩa. Vì vậy BLEU chỉ được báo cáo cho **cả tập test**, không bao giờ cho một câu demo.

**b) BLEU phụ thuộc bộ tách từ — và đây là cái bẫy lớn nhất.** Cùng một bản dịch, tách từ kiểu
khác nhau ra điểm khác nhau. Matt Post đo được chênh lệch tới **1,8 điểm BLEU** chỉ do khác cách
tách từ/chuẩn hoá — lớn hơn cả mức cải thiện mà nhiều bài báo công bố. Hệ quả: **hai bài báo cùng
ghi "BLEU 30" có thể không so được với nhau.**

Lời giải là **sacreBLEU** (Post, 2018): một cách tính chuẩn hoá, tự sinh ra một _signature_ ghi
lại đúng cấu hình đã dùng để người khác tái lập được.

**c) sacreBLEU mặc định vẫn không đủ cho ngôn ngữ không có dấu cách.** Tokenizer mặc định `13a`
tách theo khoảng trắng kiểu Moses — vô nghĩa với tiếng Trung, tiếng Nhật, tiếng Miến. FLORES-101
giải quyết bằng **spBLEU**: tách từ bằng một mô hình **SentencePiece đa ngữ dùng chung cho mọi
ngôn ngữ** (SPM-200, 256K pieces).

Đề tài dùng đúng cách đó — `sacrebleu` với `tokenize="flores200"`, xem
[`metrics.py:bleu`](../apps/ai-service/scripts/metrics.py). Được hai thứ:

1. Số của đề tài **đặt cạnh số công bố của NLLB-200 là so sánh được** (bài báo NLLB dùng đúng
   spBLEU trên FLORES).
2. **Một tokenizer duy nhất cho cả 6 chiều**, nên 6 con số trong bảng so được với nhau —
   nếu mỗi ngôn ngữ một kiểu tách từ thì cột vi→ja và cột vi→en là hai đơn vị khác nhau.

### 3.3. chrF++ đi kèm làm gì

**chrF++** (Popović, 2017) tính F-score trên **n-gram ký tự** (cộng thêm 2-gram từ, đó là dấu
`++`). Nó có mặt trong bảng vì hai lý do:

- **Ổn định hơn BLEU trên tập nhỏ.** Tập test FLEURS chỉ 318–347 câu mỗi chiều; BLEU dựa trên
  4-gram cần nhiều dữ liệu hơn thế để đứng yên.
- **Không phụ thuộc tách từ**, nên công bằng với zh/ja giống như CER công bằng với ASR.

Bài báo NLLB-200 **báo cáo chính bằng chrF++** và chỉ đưa spBLEU kèm theo cho tiện đối chiếu —
đề tài làm theo đúng thứ tự ưu tiên đó.

### 3.4. Bao nhiêu thì gọi là tốt

Các dải sau được lưu hành rộng rãi và tiện để định hướng, nhưng **phải kèm cảnh báo**:

| spBLEU  | Diễn giải thường gặp           |
| ------- | ------------------------------ |
| < 20    | Khó hiểu, chỉ đoán được chủ đề |
| 20 – 30 | Nắm được ý, câu cú còn vụng    |
| 30 – 40 | Hiểu được, chất lượng khá      |
| 40 – 50 | Tốt, gần mức bản dịch người    |
| > 50    | Rất tốt                        |

**Ba cảnh báo bắt buộc phải nói kèm bảng này:**

1. **Không so BLEU giữa hai cặp ngôn ngữ khác nhau.** Google nói thẳng: BLEU 50 của Anh→Đức
   không so được với BLEU 50 của Nhật→Anh. Trong bảng 6 chiều của đề tài, **so cột dọc (giữa các
   model trên cùng một chiều) thì được, so ngang giữa các chiều thì không**. Chiều vi↔ja thấp hơn
   vi↔en không có nghĩa là hệ thống dịch tiếng Nhật tệ hơn — hai con số đó khác đơn vị.
2. **Bản dịch của người cũng không đạt 100.** Hai người dịch giỏi dịch cùng một câu vẫn ra hai bản
   khác nhau, nên trần thực tế của BLEU thấp hơn 100 rất nhiều.
3. Dải trên là **quy ước dân gian**, không phải chuẩn có nguồn chính thức. Tài liệu Google Cloud
   hiện tại **không** còn bảng này; nó chỉ mô tả thang 0–1 và khuyến nghị dùng độ đo dựa trên mô
   hình. Báo cáo nên trình bày nó như "mốc tham khảo thường gặp", không phải "tiêu chuẩn".

---

## 4. COMET

### 4.1. Nó khác BLEU ở chỗ nào

BLEU đếm chữ trùng. COMET **hiểu nghĩa**. Ví dụ:

|            |                                      |
| ---------- | ------------------------------------ |
| Nguồn      | `Tôi không đồng ý với đề xuất này.`  |
| Tham chiếu | `I do not agree with this proposal.` |
| Máy dịch A | `I disagree with this proposal.`     |
| Máy dịch B | `I do not agree with this purpose.`  |

Bản A **đúng nghĩa hoàn toàn** nhưng gần như không trùng n-gram nào dài với tham chiếu → BLEU
thấp. Bản B chỉ sai một từ nhưng **sai nghĩa** (`proposal` → `purpose`) → BLEU cao. COMET đảo
ngược thứ tự này lại cho đúng. Đây chính là lý do thầy yêu cầu **cả hai** độ đo chứ không chỉ
BLEU.

### 4.2. Cơ chế

COMET (Rei và cộng sự, 2020) là một **độ đo dựa trên mô hình neural**, không phải công thức đếm:

- Nền là **XLM-R**, một mô hình ngôn ngữ đa ngữ (khoảng 100+ ngôn ngữ).
- Được **fine-tune trên điểm chấm của người thật** — cụ thể là _Direct Assessment_ của WMT17–WMT20,
  tức là điểm mà dịch giả người thật đã cho các bản dịch máy.
- Bản **`Unbabel/wmt22-comet-da`** (bản thầy chỉ định) là loại **reference-based**: nó nhận vào
  **bộ ba** `(câu nguồn, bản dịch máy, bản dịch tham chiếu)` chứ không chỉ hai câu như BLEU. Việc
  nhìn được cả câu nguồn là điều BLEU không làm được.

Nói cách khác: COMET là một mô hình học cách **dự đoán điểm mà người sẽ chấm**.

Model này là bản nộp COMET-22 của Unbabel–IST cho WMT22 Metrics Shared Task, và đã thắng ở cặp
Trung→Anh.

### 4.3. Đọc điểm COMET thế nào

**Thang 0–1, càng cao càng tốt**, 1 là bản dịch hoàn hảo. Nhiều bài báo nhân 100 cho dễ đọc.

Điểm quan trọng nhất, và cũng là chỗ dễ sai nhất:

> **Điểm COMET không phải phần trăm.** COMET 0,85 **không** có nghĩa là "dịch đúng 85%". Nó là
> đầu ra hồi quy của một mô hình. Dùng nó để **xếp hạng** các hệ thống trên cùng một tập test —
> đừng dùng như một lời hứa chất lượng tuyệt đối.

Vì sao phải nhấn mạnh: các bản COMET **trước** phiên bản 2.0 xuất điểm dạng z-score **không có
chặn**, và báo cáo chính thức của WMT22 ghi nhận điểm có thể vượt 100 hoặc âm dưới −100, kết luận
thẳng rằng _"điểm COMET tuyệt đối là không có thông tin dù dùng model nào; một bản dịch máy xuất
sắc vẫn có thể nhận điểm âm"_ — nhưng **thứ hạng** thì mọi model đều cho gần như nhau. Bản
`wmt22-comet-da` sinh ra chính là để sửa chuyện khó đọc đó bằng cách chặn về [0, 1].

Hai hệ quả:

- **Không được so điểm `wmt22-comet-da` với điểm của bài báo dùng `wmt20-comet-da`.** Khác thang
  hoàn toàn. Báo cáo phải ghi rõ tên checkpoint bên cạnh con số.
- Vì nền là XLM-R (109 ngôn ngữ), **cả bốn ngôn ngữ của đề tài đều nằm trong vùng hợp lệ** —
  vi, en, zh, ja đều được XLM-R hỗ trợ. Nếu dùng ngôn ngữ ngoài danh sách thì điểm không đáng tin.

### 4.4. Vì sao WMT nói "Stop Using BLEU"

Báo cáo chính thức của WMT22 Metrics Shared Task có tựa đề đúng nghĩa đen là **"Results of WMT22
Metrics Shared Task: Stop Using BLEU"**. Lập luận: các độ đo neural như COMET tương quan với đánh
giá của người tốt hơn hẳn BLEU, nên tiếp tục xếp hạng hệ thống bằng BLEU là sai phương pháp.

**Nhưng đề tài vẫn giữ BLEU**, có chủ đích:

- BLEU **minh bạch và tính tay được** — hội đồng hỏi "con số này ở đâu ra" thì trả lời được bằng
  công thức, còn COMET thì phải trả lời "một mô hình neural chấm".
- BLEU cho phép **đặt cạnh số công bố của NLLB-200**, thứ mà COMET không làm được vì bài báo NLLB
  không báo cáo COMET cho các cặp này.
- COMET là độ đo **quyết định** khi hai cấu hình chênh nhau; BLEU/chrF++ là độ đo **kiểm chứng
  chéo**. Khi hai độ đo mâu thuẫn, đó là tín hiệu phải đi đọc lại câu dịch thật — và đó là lý do
  `eval_mt.py` xuất từng câu ra JSON.

### 4.5. Cái giá kỹ thuật của COMET

| Vấn đề                 | Con số / hệ quả                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Dung lượng model       | **~2,3 GB** phải tải về                                                                                                                |
| Xung đột phụ thuộc     | `unbabel-comet` ghim `numpy<2` và `transformers<5`; dịch vụ cần `numpy>=2.4` + `transformers>=5.14`                                    |
| Hệ quả                 | **Không cài chung một venv được** → `scripts/eval_comet.py` chạy môi trường riêng qua PEP 723 + `uv run --no-project`                  |
| Vi phạm "chạy cục bộ"? | **Không** — COMET chỉ chạy ở khâu **đánh giá offline**, không nằm trong ứng dụng người dùng cài. Cần nói rõ điều này nếu hội đồng hỏi. |

Có bản nhẹ hơn (`eamt22-cometinho-da`, 344 MB) nếu máy chật, đổi lại độ tương quan thấp hơn — chỉ
nên dùng khi thật sự không chạy nổi bản chuẩn.

---

## 5. RTF — phần báo cáo lại cho thầy

> Đây là mục thầy dặn _"tự tra công thức và ngưỡng chuẩn, rồi báo cáo lại"_ (biên bản mục 3c và
> câu hỏi số 2). **Copy nguyên mục 5 này gửi thầy.**

### 5.1. Công thức

$$\text{RTF} = \frac{\text{thời gian xử lý (wall-clock)}}{\text{thời lượng audio đầu vào}}$$

Đây là định nghĩa chuẩn dùng trong Kaldi, whisper.cpp, ESPnet và các bài báo ASR: tỉ số giữa thời
gian nhận dạng và độ dài đoạn tiếng nói — nói cách khác, **máy giải mã chậm hơn người nói bao
nhiêu lần**.

- **RTF = 0,5** → xử lý 1 giây audio hết 0,5 giây. Nhanh gấp đôi thời gian thực.
- **RTF = 1,0** → vừa đúng kịp, không dư một chút nào.
- **RTF = 2,0** → xử lý 1 giây audio hết 2 giây. Không theo kịp.

Trong đề tài, **tử số là Total Inference Time** — tức tổng thời gian tính toán của cả chuỗi
VAD → Whisper → NLLB → TTS (`scripts/eval_latency.py`), đúng phạm vi thầy giao ở mục 3c: _"từ khi
ASR nhận input speech cho đến khi TTS generate ra translated speech"_.

### 5.2. Cái bẫy: có tài liệu định nghĩa **ngược**

Một số tài liệu định nghĩa RTF là **audio ÷ xử lý**, lúc đó "càng lớn càng tốt" và ngưỡng đảo
chiều. Cách viết phổ biến để tránh nhầm là gọi chiều ngược đó là **RTFx** (hệ số tăng tốc) — bảng
xếp hạng Open ASR của HuggingFace dùng RTFx theo nghĩa này.

**Đề tài dùng chiều xử lý ÷ audio, càng nhỏ càng tốt.** File JSON kết quả có sẵn khoá
`rtf_definition` ghi nguyên câu định nghĩa, để về sau đọc lại không nhầm chiều. Báo cáo cũng phải
ghi rõ chiều ngay dưới bảng.

### 5.3. Ngưỡng — trả lời câu hỏi "bao nhiêu thì đạt"

Có **hai** ngưỡng, và đây là chỗ dễ trả lời hụt trước hội đồng nếu chỉ nói mỗi "RTF < 1".

#### Ngưỡng 1 — RTF < 1: điều kiện **cần**, và nó là ngưỡng cứng

RTF < 1 là ngưỡng chuẩn cho "xử lý nhanh hơn thời gian thực", và là **điều kiện tiên quyết cho
streaming**. Lý do nó là ngưỡng cứng chứ không phải khuyến nghị:

> Nếu RTF ≥ 1, mỗi giây người dùng nói lại sinh ra hơn một giây việc phải làm. Hàng đợi audio dài
> ra **vô hạn** và độ trễ tăng **không giới hạn** theo thời lượng cuộc họp. Nói 10 phút thì câu
> cuối trễ hàng phút. Đây không phải "hơi chậm" — đây là hệ thống hỏng theo kiểu tích luỹ.

#### Ngưỡng 2 — RTF ≤ 0,5: mức nên nhắm để dùng thật

RTF ≈ 1,0 là **quá sát** trong triển khai thật. Nghiên cứu ASR trên thiết bị của Apple lập luận
rằng vì người dùng còn chạy việc khác và hệ điều hành còn chiếm CPU nền, **RTF ít nhất 0,5 mới là
mục tiêu hợp lý**. Các hệ thống dịch nói cũng nhắm RTF tích luỹ thấp hơn 1,0 khá xa.

Với đề tài, còn ba lý do riêng để đòi thêm dư địa:

1. Máy người dùng đang **chạy phần mềm họp hoặc trình duyệt cùng lúc** — chúng ăn CPU cho video/echo cancellation.
2. Pipeline có **bốn model** nối tiếp, không phải một; TTS tiếng Nhật/Trung tốn thêm ~700 ms
   (xem [`25`](25_ket-qua-chay-thu-e2e.md) mục 3).
3. **Hai chiều chạy đồng thời** (nghe + nói), tức là hai luồng cùng tranh tài nguyên.

#### Lấy p90 chứ không lấy trung bình

Chuẩn báo cáo hiệu năng ASR thường đưa **cả RTF trung bình và RTF phân vị 90**. Đề tài lấy **p90
làm căn cứ kết luận**, vì:

> Trung bình 0,8 mà 10% số câu có RTF > 1 thì hệ thống vẫn dồn hàng đợi — **ở đúng những câu dài**,
> mà câu dài mới là câu mang nhiều thông tin. Trung bình che mất đúng cái phải nhìn.

`eval_latency.py` in cả hai và kết luận theo p90.

#### Bảng ngưỡng đề xuất

| Mức                  | Điều kiện                                     | Ý nghĩa                                                   |
| -------------------- | --------------------------------------------- | --------------------------------------------------------- |
| **Không đạt**        | RTF p90 ≥ 1                                   | Dồn hàng đợi, độ trễ tăng vô hạn theo thời gian nói       |
| **Đạt tối thiểu**    | RTF p90 < 1                                   | Theo kịp luồng vào, nhưng không còn dư địa                |
| **Đạt để dùng thật** | **RTF p90 ≤ 0,5** _và_ độ trễ cảm nhận ≤ ~3 s | Còn dư nửa ngân sách cho VAD chờ chốt câu và tải hệ thống |

_(Dòng thứ ba là **đề xuất của sinh viên**, ghép ngưỡng 0,5 có nguồn với mốc độ trễ cảm nhận ở
mục 5.5. Cần thầy chốt.)_

**Hệ thống hiện tại đứng ở đâu trên bảng này** (đo 07/09, chi tiết ở
[`17` mục 8c](17_bo-danh-gia-fleurs.md)):

| Mức              | Chiều đạt                                         |
| ---------------- | ------------------------------------------------- |
| Đạt tối thiểu    | **cả sáu** (RTF p90 cao nhất là vi→ja với 0,786)  |
| Đạt để dùng thật | ja→vi 0,395 · en→vi 0,496 · zh→vi 0,509 (sát mép) |
| Không đạt        | không có chiều nào                                |

Ba chiều chưa đạt mức "dùng thật" đều là ba chiều **nguồn tiếng Việt** (0,580 · 0,727 ·
0,786) — nên câu trả lời cho thầy không chỉ là "đạt hay chưa", mà là **đạt ngưỡng cứng
ở mọi chiều, còn ngưỡng đề xuất thì phụ thuộc chiều nào**.

### 5.4. RTF **không phải** độ trễ người dùng cảm nhận

Đây là điểm quan trọng nhất của cả mục 5, và là chỗ hội đồng dễ hỏi vặn.

RTF đo **tốc độ tính toán**. Cái người dùng cảm nhận là **khoảng từ lúc người kia nói xong tới
lúc nghe được bản dịch** — và khoảng đó còn chứa những thứ không phải tính toán:

| Thành phần                       | Có nằm trong RTF không | Đề tài đo bằng gì                          |
| -------------------------------- | ---------------------- | ------------------------------------------ |
| VAD + ASR + MT + TTS             | **Có**                 | Total Inference Time                       |
| **Chờ VAD xác nhận hết câu**     | **Không**              | Cột **"chờ chốt"** trong `eval_latency.py` |
| Độ trễ thu/phát của hệ điều hành | Không                  | Chưa đo                                    |
| Truyền qua mic ảo vào Meet       | Không                  | Chưa đo                                    |

Phần "chờ chốt" là hệ quả trực tiếp của ngưỡng endpointing — chính là mục 4.2 của biên bản. Nó
**không phải** thời gian tính toán nên đúng là không được đưa vào RTF, nhưng bỏ qua nó thì báo cáo
sẽ nói hệ thống nhanh hơn cái người dùng thật sự cảm thấy. Vì vậy bảng in **cả hai cột**, ghi rõ
cái nào là cái nào. Dò riêng phần này bằng `make endpointing MEDIA=<bản ghi>.mov`.

Tài liệu ngành cũng nói đúng điều này: các thước đo truyền thống như RTF _"nắm được tốc độ hệ
thống nhưng không nắm được độ trễ như người dùng cảm nhận"_.

### 5.5. Ngưỡng cho độ trễ cảm nhận — và vì sao **không** dùng 150 ms

Có một cái bẫy trích nguồn ở đây. [ITU-T G.114](https://www.itu.int/rec/T-REC-G.114) đặt ngưỡng
**150 ms** cho hội thoại thời gian thực, và con số này rất hay bị trích nhầm cho hệ thống phiên
dịch. **Không áp được**, vì G.114 là mốc cho **truyền dẫn thoại** (VoIP) — nó đo đường truyền,
không đo việc dịch. Bản thân người phiên dịch **cũng trễ vài giây**.

Mốc đúng để đối chiếu nằm ở nghiên cứu về phiên dịch, và ba nguồn độc lập cho ra cùng một vùng
**2–4 giây**:

| Nguồn                                                    | Con số                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| **Ear-voice span** của phiên dịch viên người thật        | trung bình **~3 giây** (Anh→Hàn, ~800 câu); một khảo sát khác ~3,46 s |
| Phiên dịch viên chịu được **độ trễ do công cụ thêm vào** | **~3 giây** không ảnh hưởng rõ rệt tới độ chính xác và độ trôi chảy   |
| **Người nghe** hệ thống dịch nói chọn mức nào            | đa số thích **3–4 giây** khi cân giữa độ trễ và độ chính xác          |

Vì vậy đề xuất: **độ trễ cảm nhận đầu-cuối ≤ ~3 giây** là mốc "đạt" cho đề tài — có căn cứ từ
chính hành vi của phiên dịch viên người thật, thay vì mượn một con số của ngành viễn thông. Mốc
này cũng khớp với SPEC 14.1 hiện có của đề tài (tổng độ trễ outgoing trung vị < 4 s).

Con số hiện tại để so: [`25`](25_ket-qua-chay-thu-e2e.md) đo tổng độ trễ tính toán **1,59 – 2,36
giây** đủ sáu chiều — tức là phần tính toán còn dư khoảng 0,6 – 1,4 giây cho phần chờ chốt câu.

### 5.6. Một cảnh báo về chính con số RTF đang có

**Hai chỗ trong dự án đang tính RTF theo hai phạm vi khác nhau.** Phải thống nhất trước khi đưa
vào báo cáo:

| Chỗ                                                  | Tử số                    | Ghi chú                     |
| ---------------------------------------------------- | ------------------------ | --------------------------- |
| `scripts/eval_latency.py` (số cho báo cáo)           | VAD + ASR + MT + **TTS** | Đúng phạm vi thầy giao ở 3c |
| Màn Đánh giá trong app (`application/evaluation.py`) | **chỉ ASR + MT**         | Không có TTS, không có VAD  |

Nghĩa là **RTF p90 0,818** ghi ở [`25`](25_ket-qua-chay-thu-e2e.md) mục 4 **không phải** cùng đại
lượng với con số mà `make eval-latency` sẽ in ra — nó lạc quan hơn, vì thiếu khâu TTS. Màn Đánh
giá trong app không chạy TTS (nó chấm chất lượng dịch, không phát tiếng), nên phạm vi hẹp là hợp
lý về mặt thiết kế — nhưng **báo cáo phải ghi rõ hai phạm vi**, hoặc chỉ lấy số từ
`eval_latency.py`. Không được để hai con số 0,8 nằm cạnh nhau mà không chú thích.

---

## 6. Bốn độ đo ghép vào đề tài ở đâu

| Độ đo                | Đo khâu nào   | Lệnh                | Cài đặt                                      |
| -------------------- | ------------- | ------------------- | -------------------------------------------- |
| WER (vi/en)          | ASR           | `make eval-asr`     | `jiwer` qua `scripts/metrics.py`             |
| CER (zh/ja)          | ASR           | `make eval-asr`     | `jiwer.cer`, cùng file                       |
| spBLEU               | MT            | `make eval-mt`      | `sacrebleu` + tokenizer `flores200`          |
| chrF++               | MT            | `make eval-mt`      | `sacrebleu` CHRF `word_order=2`              |
| COMET                | MT            | `make eval-comet`   | `Unbabel/wmt22-comet-da`, môi trường riêng   |
| Total Inference Time | Toàn hệ thống | `make eval-latency` | `scripts/eval_latency.py`                    |
| RTF                  | Toàn hệ thống | `make eval-latency` | cùng file, `rtf = total_ms / 1000 / audio_s` |

Bản rút gọn của WER/CER + chrF cũng có trong ứng dụng (màn **Đánh giá**, mục 3d thầy giao) — cài
đặt thuần Python trong `application/evaluation.py`, **cố ý không dùng** jiwer/sacrebleu vì hai thư
viện đó nằm ở nhóm phụ thuộc `eval` và tokenizer `flores200` của sacrebleu phải tải model về lần
đầu chạy — trái với nguyên tắc "chạy được offline" của ứng dụng. **Số đưa vào báo cáo chính thức
lấy từ các lệnh `make eval-*`**, số trên màn Đánh giá là để người dùng tự kiểm tra.

---

## 7. Bảng tóm tắt — mang đi bảo vệ

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

## 8. Điều cần thầy chốt

1. **CER thay WER cho zh/ja** — kế hoạch thầy giao ghi "WER" cho cả bốn ngôn ngữ. Đề tài dùng CER
   cho zh/ja theo đúng bài báo FLEURS và Whisper (mục 2.4). Xin thầy xác nhận.
2. **Ngưỡng RTF:** lấy **p90 < 1** (điều kiện cần) hay chặt hơn ở **p90 ≤ 0,5** (mục 5.3)?
3. **Ngưỡng độ trễ cảm nhận ≤ ~3 giây**, lấy căn cứ từ nghiên cứu ear-voice span của phiên dịch
   viên, **không** dùng mốc 150 ms của ITU-T G.114 (mục 5.5). Xin thầy duyệt cách lập luận này.
4. **chrF++ có được tính là độ đo chính thức thứ ba cho MT không**, hay chỉ để tham khảo? Bài báo
   NLLB-200 báo cáo chính bằng chrF++ chứ không phải BLEU (mục 3.3).
5. **COMET chạy ở môi trường riêng** vì xung đột phụ thuộc (mục 4.5) — đây là chi tiết kỹ thuật
   nên nói trong báo cáo hay chỉ ghi ở phụ lục?

---

## 9. Nguồn trích dẫn

### Độ đo ASR

- Conneau, A. và cộng sự (2022). _FLEURS: Few-shot Learning Evaluation of Universal Representations
  of Speech._ — bộ dữ liệu của đề tài; dùng CER cho nhóm CJK.
  https://arxiv.org/pdf/2205.12446
- Radford, A. và cộng sự (2023). _Robust Speech Recognition via Large-Scale Weak Supervision_
  (Whisper) — quy ước CER cho zh/ja/th/lo/my; phụ lục D.1, D.2, D.4 có bảng WER/CER.
  https://github.com/openai/whisper
- Thông báo phát hành `large-v3` kèm biểu đồ WER/CER theo ngôn ngữ trên Common Voice 15 + FLEURS.
  https://github.com/openai/whisper/discussions/1762
- _Advocating Character Error Rate for Multilingual ASR Evaluation_ (Findings of NAACL 2025) —
  lập luận đầy đủ về việc ngôn ngữ không có ranh giới từ phải dùng CER.
  https://aclanthology.org/2025.findings-naacl.277.pdf

### Độ đo MT

- Papineni, K. và cộng sự (2002). _BLEU: a Method for Automatic Evaluation of Machine Translation._
  https://aclanthology.org/P02-1040/
- Post, M. (2018). _A Call for Clarity in Reporting BLEU Scores._ WMT 2018, tr. 186–191 — sacreBLEU;
  chênh lệch tới 1,8 BLEU chỉ do khác cách tách từ.
  https://aclanthology.org/W18-6319/ · PDF: https://arxiv.org/pdf/1804.08771
- Goyal, N. và cộng sự (2022). _The FLORES-101 Evaluation Benchmark_ — định nghĩa **spBLEU**.
  https://arxiv.org/pdf/2106.03193
- NLLB Team (2022). _No Language Left Behind: Scaling Human-Centered Machine Translation_ — báo cáo
  chính bằng chrF++, kèm spBLEU trên FLORES.
  https://arxiv.org/pdf/2207.04672
- Rei, R. và cộng sự (2022). _COMET-22: Unbabel-IST 2022 Submission for the Metrics Shared Task._
  WMT 2022, tr. 578–585 — bài báo của chính checkpoint `Unbabel/wmt22-comet-da`.
  https://aclanthology.org/2022.wmt-1.52/ · PDF: https://www.statmt.org/wmt22/pdf/2022.wmt-1.52.pdf
- Freitag, M. và cộng sự (2022). _Results of WMT22 Metrics Shared Task: **Stop Using BLEU**_ —
  điểm COMET tuyệt đối không có thông tin, chỉ thứ hạng mới dùng được.
  https://statmt.org/wmt22/pdf/2022.wmt-1.2.pdf
- Unbabel. _Introducing Unbabel-COMET v2.0_ — vì sao chặn điểm về [0, 1].
  https://unbabel.com/introducing-unbabel-comet-v2-0-improved-models-and-metrics-for-better-machine-translation-evaluation/
- Danh sách checkpoint COMET (gồm bản nhẹ `eamt22-cometinho-da`, 344 MB).
  https://github.com/Unbabel/COMET/blob/master/MODELS.md
- Google Cloud Translation. _The BLEU translation quality metric_ — BLEU kém trên từng câu; không
  so BLEU giữa hai cặp ngôn ngữ.
  https://docs.cloud.google.com/translate/docs/bleu-scores

### RTF và độ trễ

- ExKaldi-RT (2021) — RTF trong hệ ASR trực tuyến, RTF 0,57 trên CPU.
  https://arxiv.org/pdf/2104.01384
- _Conformer-Based Speech Recognition On Extreme Edge-Computing Devices_ (Apple, 2023) — lập luận
  **RTF ít nhất 0,5** mới là mục tiêu hợp lý trên thiết bị người dùng.
  https://arxiv.org/pdf/2312.10359
- _Evaluation of real-time transcriptions using end-to-end ASR models_ (2024) — RTF ≤ 1 là điều
  kiện nhận dạng thời gian thực.
  https://arxiv.org/html/2409.05674v1
- _Low Latency ASR for Simultaneous Speech Translation_ (2020) — RTF không phản ánh độ trễ người
  dùng cảm nhận.
  https://arxiv.org/pdf/2003.09891
- _Defining maximum acceptable latency of AI-enhanced CAI tools_ (2022) — phiên dịch viên chịu được
  ~3 giây độ trễ do công cụ thêm vào mà không giảm rõ rệt độ chính xác/trôi chảy.
  https://arxiv.org/pdf/2201.02792
- _Spatial Speech Translation: Translating Across Space With Binaural Hearables_ (2025) — người
  nghe đa số chọn mức trễ 3–4 giây khi cân giữa độ trễ và độ chính xác.
  https://arxiv.org/pdf/2504.18715
- Lee, T.-H. _Ear Voice Span in English into Korean Simultaneous Interpretation_ — EVS trung bình
  ~3 giây trên ~800 câu.
  https://www.researchgate.net/publication/272899217_Ear_Voice_Span_in_English_into_Korean_Simultaneous_Interpretation
- ITU-T Recommendation G.114 — mốc 150 ms cho **truyền dẫn thoại**; nêu ở đây để giải thích **vì
  sao không dùng**.
  https://www.itu.int/rec/T-REC-G.114
