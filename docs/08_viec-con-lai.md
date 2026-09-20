# Việc còn lại — trạng thái sau đợt 20/09/2026

**Cập nhật:** 20/09/2026 · **Nhánh:** `main`
**Nguồn yêu cầu:** [biên bản họp GVHD 19/08/2026](meetings/bien-ban-hop-GVHD-2026-08-19.md)

> Biên bản họp là **bản ghi thầy đã nói gì**, giữ nguyên không sửa. Tài liệu này là
> **trạng thái làm được tới đâu** — mở file này ra trước khi làm tiếp.
>
> Ngoại lệ duy nhất: **mục 7 "Việc cần làm tiếp"** của biên bản đã được tick trạng thái
> ngày 07/09 — đó là checklist việc chứ không phải lời thầy. Mục 1–6 vẫn nguyên văn.
> Biên bản cho cái nhìn nhanh "xong/chưa xong", file này giải thích **vì sao** còn treo.

Tóm tắt một câu (20/09): **khối đo đã đóng.** Bộ đánh giá giờ có số thật trên **cả hai
nền tảng**, ba runtime ASR đã so trên cùng 3.099 bản thu ([`05` mục 8d](05_bo-danh-gia-fleurs.md)),
và cả sáu chiều đều đạt ngưỡng chặt RTF p90 ≤ 0,5 trên cấu hình Windows
([`05` mục 8e](05_bo-danh-gia-fleurs.md)) — trên máy Mac chỉ ba chiều đạt. Việc còn lại
gần như chỉ còn Tuần 9 (báo cáo, video demo, slide) và những thứ **bắt buộc phải có
giọng người thật** ở mục 2.

Tóm tắt của đợt trước (07/09): **đã có bộ số đo thật đầu tiên** trên macOS Apple Silicon
([`07`](07_ket-qua-chay-thu-e2e.md)) — độ trễ đủ sáu chiều và WER/chrF, chạy tự động
trên app đóng gói. Việc còn lại chia làm hai loại rạch ròi: những thứ chỉ cần **chạy
trên phần cứng/dữ liệu chưa có** (Windows, giọng người thật, FLEURS), và
những thứ **cần người quyết** (nhắn thầy, chốt ngưỡng RTF).

Đã xong từ 04/09 tới nay, không cần làm lại:

Sáu việc dưới đây đã đóng, chi tiết ở [`04_cac-dot-bo-sung.md`](04_cac-dot-bo-sung.md):
màn hình đánh giá trong app (biên bản 3d); backend ASR thứ hai (MLX) và thứ ba
(faster-whisper) cùng khâu tách người nói; duyệt trước khi gửi và các thao tác quản lý
model từng bị vô hiệu; đặt tên model theo đường dẫn thượng nguồn; chọn model không còn là
nạp model và tải được repo HF bất kỳ; model tải dở không còn bị tính là đã tải. Kèm theo:

- **Ba lớp test**: pytest (327 pass, 6 skip) · vitest cho renderer (69) · Playwright trên
  app Electron thật + service thật (11). `make test` chạy hai lớp đầu, `make e2e` chạy
  lớp thứ ba. _(Đếm lại ngày 20/09, chạy trên Windows.)_
- **Bộ mẫu đánh giá phủ đủ sáu chiều** vi↔en, vi↔ja, vi↔zh (22 câu)

---

## 0. Việc với GVHD — đã đóng cả hai

- [x] ~~**Báo cáo thầy công thức RTF và ngưỡng "đạt".**~~ **Đã gửi.**
      [Báo cáo GVHD](gvhd/bao-cao-danh-gia.md) — mục 3 là công thức RTF + ngưỡng đề
      xuất, mục 8 là các điểm cần thầy chốt (trong đó có ngưỡng RTF p90 < 1 là điều
      kiện cần, hay chặt hơn ở 0,5). Phần lý thuyết đầy đủ của cả bốn độ đo đi kèm làm
      phụ lục: [`06`](06_bon-do-do-wer-bleu-comet-rtf.md).
      **Cập nhật 20/09:** nếu thầy chốt ngưỡng 0,5 thì cấu hình Windows đạt cả sáu
      chiều ([`05` mục 8e](05_bo-danh-gia-fleurs.md)), cấu hình macOS thì không — số
      này có sau khi gửi báo cáo nên cần nói lại với thầy.
- [x] ~~**Nhắc thầy về baseline cloud.**~~ **Quyết 20/09: bỏ, không làm nữa.** Baseline
      cloud là Ưu tiên 3 trong biên bản, và mục đích của nó — có một mốc để đối chiếu
      chất lượng — giờ đã được phục vụ bằng thứ khác và tốt hơn: ba runtime ASR chạy
      trên cùng 3.099 bản thu ([`05` mục 8d](05_bo-danh-gia-fleurs.md)) và điểm COMET
      cho cả sáu chiều dịch. Gọi API cloud cũng đi ngược tinh thần "chạy hoàn toàn cục
      bộ" của đề tài.

Kèm theo, nên báo thầy hai điều đã phát hiện khi làm (chi tiết ở mục 5 dưới): **zh/ja
phải dùng CER chứ không phải WER**, và **COMET không cài chung môi trường được**.

Việc thứ ba trong Ưu tiên 1 — _"tự tìm hiểu các thuật ngữ/độ đo mới: WER, BLEU, COMET,
RTF"_ — đã xong, viết ở [`06`](06_bon-do-do-wer-bleu-comet-rtf.md): công thức, ví dụ
tính tay, cái bẫy khi diễn giải, ngưỡng đề xuất và danh sách nguồn trích dẫn.

---

## 1. Chạy thật bộ đánh giá — việc lớn nhất

Đây là thứ chặn gần như mọi việc còn lại. Code đã xong ở
[`05_bo-danh-gia-fleurs.md`](05_bo-danh-gia-fleurs.md).

```bash
make setup                         # cài đầy đủ, gồm nhóm eval (một lần)
make fetch-fleurs                  # tải trước dữ liệu FLEURS (một lần, ~2,3 GB)

make eval-mt LIMIT=10              # chạy thử: xem NLLB mất bao lâu mỗi câu
make eval-mt                       # bản đầy đủ → eval-mt.json
make eval-comet                    # chấm COMET lên chính file đó

make eval-asr LIMIT=20             # chạy thử
make eval-asr                      # bản đầy đủ → eval-asr.json

make eval-latency LIMIT=20         # Total Inference Time + RTF
```

**Làm `eval-mt` trước** dù thầy đánh số (a) cho ASR: nó chỉ cần phần văn bản (~600 KB
mỗi ngôn ngữ) nên nhẹ hơn nhiều, và cho biết ngay tốc độ NLLB để ước lượng các bước sau.

`make eval-mt` sẽ **ghi đè** `eval-mt.json` của lần chạy thử trước — muốn giữ lại thì
đổi tên file đó đi trước khi chạy bản đầy đủ.

### Dung lượng phải tải lần đầu

| Phần                       | Dung lượng                          | Cần cho    |
| -------------------------- | ----------------------------------- | ---------- |
| Văn bản FLEURS             | ~600 KB / ngôn ngữ                  | eval-mt    |
| NLLB-200 distilled 600M    | ~2,5 GB                             | eval-mt    |
| `Unbabel/wmt22-comet-da`   | ~2,3 GB                             | eval-comet |
| Whisper large-v3-turbo q5  | ~570 MB                             | eval-asr   |
| Audio FLEURS, split `test` | 383–663 MB / ngôn ngữ (×4 ≈ 2,2 GB) | eval-asr   |

Tổng khoảng **7,5 GB**. Nên chạy trên máy MacBook (whisper.cpp có Metal) — số RTF đo
trên máy nào thì chỉ đúng cho máy đó, và báo cáo phải ghi kèm cấu hình máy.

**Trạng thái 06/09:** phần FLEURS (2,2 GB, cả bốn ngôn ngữ, split `test`) đã tải xong về
`fleurs-cache/`, model whisper.cpp, NLLB và COMET đều đã có sẵn — không phải tải gì thêm.
Chi tiết cách tải và chỗ dữ liệu nằm ở [`05` mục 2](05_bo-danh-gia-fleurs.md).

**Mục (a) và (b) đã xong**, bảng số và phần đọc số ở [`05` mục 8](05_bo-danh-gia-fleurs.md):

- (a) ASR: 3.099 bản thu, 10,22 giờ audio, 86 phút, `mlx-community/whisper-large-v3-asr-8bit`
  — vi WER 8,8% · en WER 4,8% · zh CER 8,1% · ja CER 4,7% · RTF gộp 0,141 · **0 câu rỗng**.
- (b) MT: 2.022 cặp câu, sáu chiều, có cả điểm COMET.

- (c) Độ trễ: 50 mẫu × sáu chiều, cùng cấu hình đã đo WER — **RTF p90 < 1 ở cả sáu**
  (xấu nhất vi→ja 0,786), nhưng ngưỡng chặt hơn 0,5 thì chỉ ba chiều đạt.

**Cả ba mục (a)(b)(c) của biên bản đã có số thật, và từ 20/09 thì khối đo đã đóng:**

- [x] ~~Cột so sánh **whisper.cpp với MLX** trên cùng thang.~~ **Xong 20/09, và có luôn
      cột thứ ba** — [`05` mục 8d](05_bo-danh-gia-fleurs.md). Cùng 3.099 bản thu:
      whisper.cpp q5_0 (vi WER 10,4% · RTF 0,018) · faster-whisper fp16 (9,2% · 0,034) ·
      MLX 8bit (8,8% · 0,141). Ba runtime xếp cùng thứ tự ở cả bốn thứ tiếng.
- [x] ~~Ba chiều **nguồn tiếng Việt** chưa đạt ngưỡng RTF p90 ≤ 0,5.~~ **Đạt cả sáu trên
      Windows** — [`05` mục 8e](05_bo-danh-gia-fleurs.md), xấu nhất là vi→ja 0,383 (máy
      Mac: 0,786). Hai thứ làm nên khác biệt: whisper.cpp chạy GPU qua Vulkan, và NLLB
      có nhánh `cuda` (trước đó luôn rơi về CPU — xem mục 8 dưới).
      **Kết luận về chỗ đáng tối ưu tiếp theo đã đổi:** không còn là ASR nguồn tiếng
      Việt, mà là **TTS cho đích ja/zh** — chiếm 65% và 63% toàn chuỗi, và vẫn chạy CPU.
- [x] ~~Chạy liên tục 60 phút không sập (tiêu chí nghiệm thu số 14 của SPEC)~~ —
      **ĐẠT, 20/09, lần đầu chạy với model thật:** 60,0 phút · 877 câu · **0 lỗi** ·
      độ trễ p50 443 ms / p95 541 ms · **trôi độ trễ +2 ms** (cuối so với đầu) ·
      **RSS 1.110 → 1.122 MB** (tăng 12 MB trong một giờ, không rò). Kết quả thô ở
      [`docs/results/soak-60min-win.json`](results/soak-60min-win.json).
- [ ] `eval-mt` chưa chạy lại trên Windows. Không gấp: spBLEU/COMET không phụ thuộc phần
      cứng nên bảng ở [`05` mục 8b](05_bo-danh-gia-fleurs.md) vẫn dùng được; chạy lại
      chỉ để có cột thời gian MT trên GPU.

### Xong là khi nào

Ba file `eval-asr.json` / `eval-mt.json` / `eval-latency.json` có số thật, và ba bảng
tương ứng chép được vào báo cáo. `eval-*.json` vẫn bị `.gitignore` theo mặc định (số
liệu của từng máy, từng lượt chạy dở), **trừ** các lượt đã chốt: chúng được chép vào
[`docs/results/`](results/README.md) để người đọc báo cáo kiểm lại được từng con số.

---

## 2. Kiểm chứng hai thứ vừa sửa — chưa xong

Đợt sửa 04/09 (commit `d0e700a`) đụng hai vấn đề thầy nêu ở mục 4.1 và 4.2. **Cả hai đều
chưa được kiểm chứng trên giọng người thật**, nên chưa được nói với thầy là đã fix.

- [ ] **Tách câu.** Cần một bản ghi có người nói liên tục ≥ 30 giây, rồi:

  ```bash
  make endpointing MEDIA=ban-ghi.mov
  ```

  Bảng in ra có cột **chờ chốt** (thời gian từ lúc nói xong tới lúc VAD nhả câu) và dòng
  so sánh với ngưỡng cũ 20 giây. Đó là bằng chứng cho mục 4.2.

  _Vì sao chưa làm được:_ đã thử bằng tín hiệu tổng hợp nhưng Silero ngừng coi âm thanh
  nhân tạo là giọng nói sau ~3,5 giây, nên không dựng được kịch bản "nói liên tục 20
  giây". Bắt buộc phải có giọng thật.

- [ ] **Hallucination trên đoạn im lặng.** Cần một bản ghi có khoảng lặng dài + tiếng ồn
      nền, chạy qua app và xem log có dòng `Bỏ câu ASR: lý do=…` không. Phần lọc đã có
      test đơn vị (`tests/test_hallucination.py`) nhưng test không chứng minh được là
      Whisper thật sự bớt bịa trên máy thật.

---

## 3. Ưu tiên 2

| Việc                                              | Ghi chú                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**Màn hình đánh giá trong app**~~ (biên bản 3d) | ✅ **Xong** — [`04`](04_cac-dot-bo-sung.md). Đã chạy thật đủ 22 câu / sáu chiều, số ở [`07`](07_ket-qua-chay-thu-e2e.md) mục 4.                                                                                                                                                                                            |
| ~~**Quyết giữ hay bỏ ràng buộc Google Meet**~~    | ✅ **Đã quyết 10/09/2026: bỏ.** Hai vấn đề ở mục 2 có mã xử lý nhưng chưa kiểm chứng được trên giọng người thật trước hạn nộp, nên giữ một tính năng chưa chắc ổn định lúc bảo vệ là rủi ro không cần thiết. Mã nguồn giữ nguyên, tắt ở lớp giao diện — [`11`](11_pham-vi-da-bo-google-meet.md) ghi lý do và cách bật lại. |
| **Cải thiện dịch — nhưng là chiều vi→zh**         | `eval-mt` + `eval-comet` đã chạy đầy đủ ([`05` mục 8](05_bo-danh-gia-fleurs.md)): ja→vi hoá ra **không** phải chiều tệ nhất (spBLEU 19,91 · COMET 0,8191). Chiều yếu nhất là **vi→zh** — cả spBLEU (17,15) lẫn COMET (0,7729) cùng chỉ vào đó. Nhắm vào vi→zh chứ đừng nhắm ja→vi.                                         |
| ~~**Kiểm tra ổn định trên Windows 11**~~          | ✅ **Xong 20/09.** Toàn bộ bộ đánh giá đã chạy trên Windows: 3.099 bản thu × 2 runtime ASR + 6 chiều độ trễ + soak 60 phút. Số ở [`05` mục 8d/8e](05_bo-danh-gia-fleurs.md). Ghi chú cũ "không có Metal → RTF sẽ khác" đúng nhưng ngược chiều dự đoán: Vulkan trên RTX 4060 cho RTF **thấp hơn** Metal trên M4.            |

---

## 4. Ưu tiên 3 — sau khi xong 1 và 2

- [x] ~~Tích hợp baseline cloud để đối chứng~~ — **bỏ 20/09**, lý do ở mục 0.
- [x] ~~Tích hợp thêm model khác, lập bảng so sánh chất lượng/độ trễ trên cùng tiêu chí~~
      — **xong cho khâu ASR**: ba runtime trên cùng 3.099 bản thu
      ([`05` mục 8d](05_bo-danh-gia-fleurs.md)). Đúng như dự đoán về hạ tầng: không phải
      sửa dòng nào trong `pipeline.py`, chỉ đổi `--adapter` khi gọi `make eval-asr`.
      Khâu MT thì vẫn chỉ có NLLB — đổi model MT là việc chưa làm.
- [ ] Thiết kế option nhanh–nhẹ / chất lượng cao cho người dùng. Đã có một nửa: mỗi
      preset giờ mang một `VadTuning` riêng (4,5 / 6 / 8 giây), còn thiếu phần đo để
      chứng minh sự đánh đổi.
- [ ] Báo cáo, video demo
- [x] ~~Đóng gói cài đặt~~ — **bản macOS xong 15/09**: `make dist` ra
      `Voice Translator-1.0.0-arm64.dmg` (506 MB), mang sẵn AI service Python nên máy
      đích không cần uv/Node/Python. Đã chạy thử từ chính file `.dmg`: service tự lên
      sau 6 giây, renderer gọi được `/api/config` + WebSocket, thoát app thì service
      chết theo và nhả cổng. Cách gói ghi ở [`09` mục 3a](09_huong-dan-cai-dat.md).
      **Bản Windows xong 19/09**: `make dist` trong Git Bash ra
      `Voice Translator-1.0.0-setup.exe` (371 MB, ~1,8 GB sau khi cài). Đã cài im lặng
      bằng chính file `.exe`: service tự lên sau 12 giây, renderer gọi được REST +
      WebSocket, đóng app thì service chết theo và nhả cổng, gỡ cài sạch. Chạy service
      từ bundle đã nạp đủ bốn khâu preset Balanced và chạy benchmark được. Lỗi lộ ra và
      đã sửa: stdout bị pipe trên Windows là cp1252, log tiếng Việt của service thành
      "Logging error" → spawn với `PYTHONUTF8=1`. Toàn bộ quy trình kiểm, số đo và
      phần chưa kiểm được ghi ở [`04` mục 7](04_cac-dot-bo-sung.md).
      **ASR trên GPU qua Vulkan (19/09).** Bản đầu chạy whisper.cpp bằng CPU: ~17 s
      cho 3 s audio với large-v3-turbo-q5_0, tăng `n_threads` lên 12 cũng chỉ còn
      ~11 s. Thay vì gói CUDA (+~1 GB), bản cài Windows giờ mang pywhispercpp build
      với `GGML_VULKAN=1` (`tools/build_whisper_vulkan.sh`, +6 MB bộ cài) — Vulkan có
      sẵn trong driver của mọi card, ý tưởng lấy từ TranscriptionSuite. Đo trên chính
      bản cài (i5-12500H + RTX 4060 Laptop, preset Balanced, 3 s audio), ASR / MT / TTS /
      tổng: vi→en 437 / 1742 / 187 / 2489 ms · en→vi 480 / 1703 / 190 / 2492 ms · vi→ja
      362 / 1368 / 912 / 2824 ms. Hai lỗi lộ ra và đã sửa: laptop hybrid liệt kê Iris Xe
      trước RTX 4060 nên whisper.cpp chạy trên iGPU (~9,9 s) — giờ chọn card rời trước;
      và backend Vulkan không hiện trong `system_info()` nên app báo "CPU" — giờ đọc
      thiết bị thật từ log lúc nạp. Lần transcribe đầu tiên trên một máy mất ~12 s để
      driver biên dịch shader (sau đó có cache, ~0,2 s), nên được làm nóng ngay lúc nạp
      model. ~~**Còn mở:** khâu chậm nhất giờ là **MT** (NLLB chạy CPU, ~1,7 s) — torch bản
      Windows trên PyPI chỉ có CPU. Và 13 test pytest hỏng sẵn trên Windows (tạo symlink
      cần quyền admin — `WinError 1314`).~~ **Cả hai đã đóng ở đợt 20/09, xem mục 8.**

- [ ] **Báo cáo thử một lần trước khi bảo vệ** để lấy góp ý và chuẩn bị bộ câu hỏi dự phòng

---

## 5. Hai điều cần nói với thầy khi báo cáo

**Không dùng WER cho tiếng Trung và tiếng Nhật được.** Kế hoạch thầy giao ghi "WER" cho
cả bốn ngôn ngữ, nhưng zh/ja không tách từ bằng khoảng trắng — chấm WER thực chất là chấm
theo chỗ Whisper _tình cờ_ chèn dấu cách, cùng một câu đúng nghĩa có thể ra 0% hoặc 100%.
Bài báo FLEURS cũng dùng **CER** cho hai thứ tiếng này. Code đã làm theo cách đó và ghi
rõ từng dòng đang là chỉ số nào.

**COMET không cài chung môi trường với dịch vụ được.** `unbabel-comet` ghim `numpy<2` và
`transformers<5`, trong khi NLLB cần `numpy>=2.4` và `transformers>=5.14`. Đã tách thành
script độc lập chạy ở môi trường riêng (`uv run --no-project scripts/eval_comet.py`).
Đây là chi tiết kỹ thuật đáng nói vì nó cho thấy đã hiểu vì sao phải tách.

---

## 6. Việc kỹ thuật nhỏ

- [x] ~~Push nhánh lên GitHub + quyết merge hay giữ nhánh~~ — đã đẩy lên `origin` và
      **merge vào `main`** ngày 06/09, giữ nguyên từng commit (merge commit, không
      squash) vì phần giải thích _vì sao_ trong mỗi commit message là tư liệu dùng được
      khi bảo vệ. Nhánh `feat/gvhd-2026-08-19` giữ lại, không xoá.
- [x] ~~Sửa 9072 cảnh báo CRLF của `make lint`~~ — đã thêm `.gitattributes`
      (`* text=auto eol=lf`) ở đợt 05/09. Chọn cách này thay vì nới `endOfLine: auto`
      cho prettier: chỗ sai là kết thúc dòng trong thư mục làm việc, không phải quy
      tắc format. **Máy Windows đã clone từ trước phải chạy lại**
      `git rm --cached -r . && git reset --hard` để checkout lại theo quy tắc mới.
- [x] ~~**Cân nhắc `LLVT_ASR_AUDIO_CTX`.**~~ **Đã đo 20/09 — giữ tắt.** Cùng model, cùng
      máy, cùng 3.099 bản thu, chỉ đổi một biến: WER/CER **10,4 → 33,7%** (vi),
      **5,0 → 31,4%** (en), **8,6 → 45,1%** (zh), **4,9 → 46,5%** (ja), câu rỗng từ 2
      lên 56. Đổi lại chỉ nhanh hơn 6–26% thời gian ASR — mà ASR giờ chỉ chiếm 15–18%
      toàn chuỗi. Bảng và phần đọc số ở [`05` mục 8d](05_bo-danh-gia-fleurs.md).

---

## 7. Việc còn treo từ các đợt bổ sung 05/09

Code đã xong và test sạch ([`04_cac-dot-bo-sung.md`](04_cac-dot-bo-sung.md)), phần **chạy
thật thì chưa**:

- [ ] **Đo MLX so với whisper.cpp trên máy Apple Silicon.** Đây mới là lý do thêm backend
      thứ hai — thêm một cột vào bảng của [`05`](05_bo-danh-gia-fleurs.md):
      `make eval-asr ADAPTER=mlx_whisper MODEL=<repo mlx> JSON=eval-asr-mlx.json`
      (`eval_asr.py` giờ nhận `--adapter`/`--model`, dựng adapter qua `ASR_REGISTRY`).
      Đã chọn xong model bằng bảng đo 7 bản MLX ở
      [`04` mục 3.3](04_cac-dot-bo-sung.md): dùng
      `whisper-large-v3-asr-8bit` (WER 6,7% · RTF 0,14 · 1,2 GB — bằng chất lượng bản
      fp16 mà nhẹ hơn 2,3 lần). **Đã có một nửa:**
      [`07`](07_ket-qua-chay-thu-e2e.md) cho số của MLX large-v3-turbo fp16 (ASR
      780–897 ms, RTF p90 0,818); còn thiếu cột whisper.cpp trên cùng bộ mẫu để so.
- [ ] **Chạy thử diarization trên một bản ghi họp nhiều người thật**, xem nhãn có khớp
      người nói không. Cần `make setup-diarization`, một access token HuggingFace (dán ở
      màn Cài đặt) và đồng ý điều khoản repo pyannote trên huggingface.co — cả hai chỉ
      cần cho lần tải đầu.
- [ ] **Cân nhắc đưa token vào keychain hệ điều hành.** Hiện token nằm ở
      `~/.llvt/settings.json` dạng văn bản thường, quyền 0600 — giống hệt cách
      `huggingface_hub` lưu `~/.cache/huggingface/token`, và đủ cho máy cá nhân một
      người dùng. Chặt hơn được thì phải qua `safeStorage` của Electron (Keychain trên
      macOS, DPAPI trên Windows), đổi lại desktop phải gửi token sang service mỗi lần
      khởi động thay vì service tự đọc.
- [x] ~~**Quyết có đóng gói `--extra mlx` / `--extra diarization` vào bản cài không.**~~
      **Quyết 15/09: gói MLX, không gói diarization.** MLX là backend đã dùng để đo
      bảng WER ở [`05` mục 8](05_bo-danh-gia-fleurs.md), nên bản giao nộp phải chạy
      lại được đúng con số đó — giá là +430 MB (DMG 506 → 592 MB). Diarization thì
      không: nó cần model gated trên HF, đi ngược tinh thần "chạy hoàn toàn cục bộ",
      và chỉ dùng ở màn Nhập tệp. Bật/tắt bằng `make dist BUNDLE_EXTRAS="…"`, mặc
      định trên Apple Silicon đã gồm MLX.
      Kèm theo, đã sửa một lỗi lộ ra từ đây: giao diện chào cả ba runtime ASR kể cả
      khi môi trường không có, nên chọn Custom trên bản cài đầu tiên là "Nạp model
      thất bại". Giờ `/api/config` chỉ trả về runtime thật sự import được, `PUT` trả
      400 kèm tên gói còn thiếu, và lựa chọn đã lưu mà không còn chạy được thì lùi về
      whisper.cpp thay vì làm hỏng preset Custom.

- [ ] **Duyệt trước khi gửi trong một cuộc họp thật** — đếm ngược 5 giây có đủ để đọc
      và sửa không, hay phải dài hơn. Bật ở màn Cài đặt.
- [ ] **Nút Huỷ nạp model** mới thử được nhánh "không có gì đang chạy". Muốn thử đúng
      đường dừng-giữa-chừng thì phải xoá model đi rồi bấm nạp lại.

- [ ] **Thay bộ câu mẫu 10 câu bằng câu thoại họp thật, có thu âm giọng người.** Đây
      là việc quyết định giá trị của mọi con số trên màn Đánh giá — bộ đi kèm chỉ để
      màn hình có thứ chạy được ngay, và nó chạy bằng giọng tổng hợp nên số lạc quan
      hơn thực tế.
- [x] ~~**Đo faster-whisper trên máy Windows + NVIDIA**~~ — **xong 20/09**, cột thứ ba ở
      [`05` mục 8d](05_bo-danh-gia-fleurs.md): vi WER 9,2% · RTF 0,034 · CUDA float16.
      Ba lỗi phải sửa mới chạy được, xem mục 8.

---

## 8. Đợt 20/09 — năm lỗi lộ ra khi lần đầu chạy bộ đánh giá trên Windows

Toàn bộ khối đo ở mục 1 và 7 đóng được trong một buổi, nhưng không lần nào chạy thẳng
được lần đầu. Năm lỗi dưới đây đều **đã sửa**, và cả năm đều chỉ lộ ra khi chạy thật —
không lỗi nào bị ba lớp test bắt, vì chúng nằm ở chỗ tiếp giáp giữa môi trường và thư
viện chứ không nằm trong logic.

1. **`make fetch-fleurs` chết ngay dòng log đầu tiên.** stdout bị `make` pipe trên
   Windows là cp1252, không mã hoá được chữ `ă`. Cùng họ với lỗi log service hôm 19/09
   ([`04` mục 7](04_cac-dot-bo-sung.md)). Sửa: `export PYTHONUTF8 := 1` cho mọi lệnh
   trong `Makefile`, và đặt lại trong `fetch_fleurs.sh` để gọi thẳng script cũng chạy.

2. **venv dev chạy whisper.cpp trên CPU.** Wheel Vulkan chỉ được nhét vào bộ cài, nên
   `make dev` và mọi lệnh `eval-*` trên máy Windows đều chạy CPU — RTF 1,5 thay vì 0,02,
   **chậm hơn thời gian thực**, mà bảng WER vẫn ra đúng nên rất dễ không nhận ra. Sửa:
   thêm `make setup-vulkan` dùng lại wheel đã build ở `dist/wheels/vulkan/`.

3. **NLLB không có nhánh `cuda`.** `adapters/mt/nllb.py` chỉ dò `mps` rồi rơi về `cpu`,
   nên trên mọi máy NVIDIA thì MT luôn chạy CPU. Đây chính là lý do MT là khâu chậm nhất
   trên Windows ở đo hôm 19/09 (~1,7 s). Sửa: `cuda → mps → cpu`. Đo lại trên cùng 5 câu,
   cùng máy: **789 ms → 181 ms**. Kèm theo phải thêm extra `cuda` vào `pyproject.toml`
   vì torch trên PyPI bản Windows chỉ có CPU — và phải khai `cpu`/`cuda` là **hai extra
   xung đột**, không thì `uv sync` trần cũng kéo torch CUDA về và bộ cài phình thêm ~3 GB.

4. **faster-whisper không bao giờ thấy GPU.** Adapter hỏi `torch.cuda.is_available()`,
   mà torch bản Windows là CPU-only → luôn trả `cpu`, chạy int8. Nhưng CTranslate2 mang
   runtime CUDA **riêng**: hỏi thẳng `ctranslate2.get_cuda_device_count()` thì ra 1 và
   float16 sẵn sàng. Sửa: hỏi đúng thư viện làm việc đó.

5. **CTranslate2 chết ở câu đầu tiên vì thiếu `cublas64_12.dll`** — sau khi đã tải model
   1,6 GB và nạp xong. Không dùng ké cuBLAS của torch được: bản cu130 mang
   `cublas64_13.dll`, tên khác. Và `os.add_dll_directory` **không** giải quyết được:
   hàm đó chỉ thêm đường tìm cho `LoadLibraryEx` với cờ `SEARCH_DEFAULT_DIRS`, còn
   CTranslate2 gọi `LoadLibrary` trần từ mã C++ — thứ chỉ tra `PATH`. Sửa: adapter tự
   thêm `site-packages/nvidia/*/bin` vào `PATH`, và extra `ctranslate2` khai thêm
   `nvidia-cublas-cu12`/`nvidia-cudnn-cu12` cho Windows.

Một lỗi thứ sáu không ảnh hưởng ai ngoài người đọc báo cáo: `eval_asr.py` chụp
`runtime_info()` **sau** `unload()`, nên file JSON đã chốt ghi `accel: CPU` cho một lượt
chạy trên GPU (bản build Vulkan không khai gì trong `system_info()` nên nó lùi về đọc cờ
lúc build). Đã sửa; file kết quả của lượt chạy trước khi sửa có ghi chú đính chính.

Kèm theo, thêm `make eval-latency-all` — trước đó bảng sáu chiều phải gõ tay sáu lượt
`eval_latency.py --source … --target …`, nên không dựng lại được bằng một lệnh.

**`make test` giờ sạch trên Windows: 327 pass, 6 skip** (trước là 13 hỏng). Cả 13 đều
hỏng vì môi trường chứ không phải vì mã sai, và đó mới là vấn đề: một bộ test hỏng sẵn
thì lần hỏng thật cũng chìm luôn trong đó. Ba nhóm nguyên nhân:

- `tests/test_partial_downloads.py` dựng cache HuggingFace giả bằng symlink, mà Windows
  chỉ cho tạo symlink khi bật Developer Mode. Cache **thật** trên máy Windows cũng là
  file copy chứ không phải symlink — `huggingface_hub` tự lùi và in cảnh báo — nên giờ
  helper lùi y hệt, còn bài duy nhất thật sự cần symlink chỏng chơ thì `skip` kèm lý do.
- Ba bài ở `tests/test_custom_preset.py` cần `mlx_whisper` được chấp nhận để bắt chéo
  runtime, nên chúng hỏng trên **mọi** máy không cài extra `mlx` — tức mọi máy không
  phải Apple Silicon. Giờ có fixture `every_runtime` cố định danh sách runtime: bài đó
  nói về luật, không nói về máy.
- Một bài ở `tests/test_evaluation.py` viết cứng `/tmp/…`, mà trên Windows chuỗi đó
  không phải đường dẫn tuyệt đối (thiếu ổ đĩa) nên API chặn ở luật khác và bài không
  còn kiểm đúng thứ nó định kiểm. Giờ dựng từ `tmp_path`.

---

**Dự án không còn việc code nào đang treo.** Toàn bộ phần còn lại là chạy thật trên
giọng người (mục 2), và Tuần 9 (báo cáo / video demo / slide).
