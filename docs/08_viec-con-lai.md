# Việc còn lại — trạng thái sau đợt 20/09/2026

**Cập nhật:** 22/09/2026 · **Nhánh:** `main`
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
([`05` mục 8e](05_bo-danh-gia-fleurs.md)) — trên máy Mac chỉ hai chiều đạt (zh→vi 0,509 trượt sát mép). Việc còn lại
gần như chỉ còn Tuần 9 (báo cáo, video demo, slide) và những thứ **bắt buộc phải có
giọng người thật** ở mục 2.

**22/09 — đã có giọng người thật** ([`05` mục 8f](05_bo-danh-gia-fleurs.md)): tách câu
đo trên ba loại giọng, và 25 đoạn phỏng vấn tự phát cho WER 24,6% so với 10,4% trên
FLEURS cùng model — gấp 2,4 lần. Kèm hai lỗi MT mà FLEURS không bắt được (vòng lặp
NLLB, dịch nghĩa đen thuật ngữ), **ghi nhận chứ chưa sửa** vì sửa thì bảng 8b phải chạy
lại.

**Lịch thật, theo tin nhắn GVHD ngày 23/09** (nhóm Đồ án tốt nghiệp 6TC) — dài hơn bảng
tuần của đề cương, nên việc "chưa sửa vì hết giờ" cần xét lại: **24/09** nộp báo cáo bản 1
cho Phòng Đào tạo (sau đó vẫn sửa tiếp được) · **29/09** gửi GVHD tiến độ cuối · **10/10**
bảo vệ khóa luận. Tiến độ và các câu hỏi đã gửi thầy ở
[`gvhd/tien-do-2026-09-23.md`](gvhd/tien-do-2026-09-23.md).

Sáu việc của các đợt bổ sung đã đóng, chi tiết ở
[`04_cac-dot-bo-sung.md`](04_cac-dot-bo-sung.md): màn hình đánh giá trong app (biên bản
3d); backend ASR thứ hai (MLX) và thứ ba (faster-whisper) cùng khâu tách người nói;
duyệt trước khi gửi và các thao tác quản lý model từng bị vô hiệu; đặt tên model theo
đường dẫn thượng nguồn; chọn model không còn là nạp model; model tải dở không còn bị
tính là đã tải. Kèm theo:

- **Ba lớp test**: pytest (327 pass, 6 skip) · vitest cho renderer (69) · Playwright
  trên app Electron thật + service thật (11). `make test` chạy hai lớp đầu, `make e2e`
  chạy lớp thứ ba. _(Đếm lại 20/09 trên Windows.)_
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
      **Cập nhật 05/10:** thầy không chốt ngưỡng. Đồ án giữ hai mức tự đề xuất (p90 < 1
      tối thiểu, p90 ≤ 0,5 mục tiêu); lập luận để trả lời hội đồng ở
      [`12` mục 4a.5](12_chuan-bi-bao-ve.md).
- [x] ~~**Nhắc thầy về baseline cloud.**~~ **Quyết 20/09: bỏ.** Mục đích của nó là có
      một mốc đối chiếu chất lượng, và mốc đó giờ có sẵn từ bảng ba runtime ASR ở mục 1
      cùng điểm COMET. Gọi API cloud cũng đi ngược tinh thần "chạy hoàn toàn cục bộ".
      Đã xin ý kiến thầy ở mục 13.5 của báo cáo, **thầy đã đồng ý** (ghi nhận 05/10).

Kèm theo, nên báo thầy hai điều đã phát hiện khi làm (chi tiết ở mục 5 dưới): **zh/ja
phải dùng CER chứ không phải WER**, và **COMET không cài chung môi trường được**.

Việc thứ ba trong Ưu tiên 1 — _"tự tìm hiểu các thuật ngữ/độ đo mới: WER, BLEU, COMET,
RTF"_ — đã xong, viết ở [`06`](06_bon-do-do-wer-bleu-comet-rtf.md): công thức, ví dụ
tính tay, cái bẫy khi diễn giải, ngưỡng đề xuất và danh sách nguồn trích dẫn.

---

## 1. Bộ đánh giá — đã chạy thật, khối này đóng

Cách chạy, dung lượng phải tải và chỗ để dữ liệu đều ở
[`05` mục 2](05_bo-danh-gia-fleurs.md) — không chép lại ở đây. Bảng số ở
[`05` mục 8/8b/8c](05_bo-danh-gia-fleurs.md) (máy M4) và
[mục 8d/8e](05_bo-danh-gia-fleurs.md) (Windows + RTX 4060); file JSON gốc của mọi lượt
đã chốt ở [`docs/results/`](results/README.md).

Cả ba mục (a)(b)(c) của biên bản đã có số thật, và ba việc còn treo tới 19/09 đã đóng
nốt ngày 20/09:

- [x] ~~Cột so sánh whisper.cpp với MLX trên cùng thang.~~ **Có luôn cột thứ ba.** Cùng
      3.099 bản thu: whisper.cpp q5_0 (vi WER 10,4% · RTF 0,018) · faster-whisper fp16
      (9,2% · 0,034) · MLX 8bit (8,8% · 0,141). Ba runtime xếp cùng thứ tự ở cả bốn thứ
      tiếng — nhưng là chênh giữa ba model khác nhau, xem phần đọc số ở mục 8d.
- [x] ~~Ba chiều nguồn tiếng Việt chưa đạt ngưỡng RTF p90 ≤ 0,5.~~ **Đạt cả sáu trên
      Windows**, xấu nhất vi→ja 0,383 (máy Mac: 0,786). Nhờ whisper.cpp chạy GPU qua
      Vulkan và NLLB có nhánh `cuda` (mục 8). **Chỗ đáng tối ưu tiếp theo đã đổi:**
      không còn là ASR nguồn tiếng Việt, mà là **TTS cho đích ja/zh** — 65% và 63% toàn
      chuỗi, vẫn chạy CPU.
- [x] ~~Chạy liên tục 60 phút không sập~~ (SPEC tiêu chí nghiệm thu 14) — **ĐẠT**, lần
      đầu với model thật: 877 câu · 0 lỗi · trôi độ trễ +2 ms · RSS 1.110 → 1.122 MB.
- [ ] `eval-mt` chưa chạy lại trên Windows. Không gấp: spBLEU/COMET không phụ thuộc phần
      cứng nên bảng ở [`05` mục 8b](05_bo-danh-gia-fleurs.md) vẫn dùng được; chạy lại
      chỉ để có cột thời gian MT trên GPU.

---

## 2. Kiểm chứng hai thứ vừa sửa — xong một, còn một

Đợt sửa 04/09 (commit `d0e700a`) đụng hai vấn đề thầy nêu ở mục 4.1 và 4.2. **Cả hai đều
chưa được kiểm chứng trên giọng người thật**, nên chưa được nói với thầy là đã fix.

- [x] ~~**Tách câu.**~~ **Xong 20/09** — [`05` mục 8f](05_bo-danh-gia-fleurs.md). Ba bản
      ghi YouTube (bản tin đọc, phỏng vấn tự phát, TEDx), cùng bốn cấu hình. Ở bản tin,
      10% số câu dài hơn 12,5 s với ngưỡng cũ, Balanced kéo xuống 5,87 s. Cải thiện đến
      từ trần độ dài chứ không từ việc bắt im lặng nhanh hơn (cột chờ chốt không đổi).
      Chạy lần đầu còn lộ ra `endpointing.py` chết khi không truyền `--preset` —
      `KeyError` ở `Preset.custom` (commit `e6a4d84`). Hướng dẫn cũ giữ dưới đây:

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
| ~~**Kiểm tra ổn định trên Windows 11**~~          | ✅ **Xong 20/09** — mục 1. Ghi chú cũ "không có Metal → RTF sẽ khác" đúng nhưng ngược chiều dự đoán: Vulkan trên RTX 4060 cho RTF **thấp hơn** Metal trên M4.                                                                                                                                                              |

---

## 4. Ưu tiên 3 — sau khi xong 1 và 2

- [x] ~~Tích hợp baseline cloud để đối chứng~~ — **bỏ 20/09**, lý do ở mục 0.
- [x] ~~Tích hợp thêm model khác, lập bảng so sánh chất lượng/độ trễ trên cùng tiêu chí~~
      — **xong cho khâu ASR** (mục 1). Đúng như dự đoán về hạ tầng: không phải sửa dòng
      nào trong `pipeline.py`, chỉ đổi `--adapter` khi gọi `make eval-asr`. Khâu MT thì
      vẫn chỉ có NLLB — đổi model MT là việc chưa làm.
- [ ] Thiết kế option nhanh–nhẹ / chất lượng cao cho người dùng. Đã có một nửa: mỗi
      preset giờ mang một `VadTuning` riêng (4,5 / 6 / 8 giây), còn thiếu phần đo để
      chứng minh sự đánh đổi.
- [ ] Báo cáo, video demo. _Bản nháp khóa luận xong 22/09:_
      [`gvhd/khoa-luan.md`](gvhd/khoa-luan.md), trình bày theo quy định của trường (Phụ
      lục 2, daa.uit.edu.vn): 5 chương, 85 trang, phần nội dung 65 trang (quy định 50–100),
      23 hình, 28 bảng. Còn thiếu: 6 ảnh chụp màn hình (Hình 3.11–3.16), tên khoa/ngành
      trên bìa, lời cảm ơn. Video demo và slide bảo vệ chưa làm.
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

- [x] ~~**Báo cáo thử một lần trước khi bảo vệ** để lấy góp ý và chuẩn bị bộ câu hỏi dự phòng~~
      — **báo cáo thử 06/10/2026**, góp ý ghi ở
      [biên bản](meetings/bien-ban-bao-cao-thu-GVHD-2026-10-06.md). Slide sửa theo góp ý
      ngày 08/10: gộp phần phân tích bài toán vào một slide, thêm câu chốt có mũi tên đỏ
      ở mọi slide nội dung, 13 slide dự phòng (thuật ngữ, độ đo, FLEURS, hai câu hỏi thầy
      dự đoán) đặt sau slide Cảm ơn. Còn mở: gửi thầy slide và file báo cáo, in 3 cuốn sau
      khi thầy duyệt, quay video demo dự phòng.

---

## 5. Hai điều đã nói với thầy — giữ lại vì sẽ bị hỏi lúc bảo vệ

_Cả hai đã nằm trong [báo cáo đã gửi](gvhd/bao-cao-danh-gia.md) (mục 3, mục 8 câu 1 và
câu 5). Phần dưới là lập luận đầy đủ để trả lời khi hội đồng hỏi lại._

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

- [ ] **Thay bộ câu mẫu 10 câu bằng câu thoại họp thật, có thu âm giọng người.**
      _Một nửa, 22/09:_ đã có bộ 25 đoạn giọng thật
      ([`results/phongvan-corpus.json`](results/phongvan-corpus.json)) và số đo ở
      [`05` mục 8f](05_bo-danh-gia-fleurs.md), nhưng nó chỉ có tiếng Việt làm nguồn nên
      không thay được bộ sáu chiều đi kèm màn Đánh giá. Phần còn lại là giọng en/ja/zh. Đây
      là việc quyết định giá trị của mọi con số trên màn Đánh giá — bộ đi kèm chỉ để
      màn hình có thứ chạy được ngay, và nó chạy bằng giọng tổng hợp nên số lạc quan
      hơn thực tế.
- [x] ~~**Đo faster-whisper trên máy Windows + NVIDIA**~~ — **xong 20/09**, cột thứ ba ở
      [`05` mục 8d](05_bo-danh-gia-fleurs.md): vi WER 9,2% · RTF 0,034 · CUDA float16.
      Ba lỗi phải sửa mới chạy được, xem mục 8.

---

## 8. Đợt 20/09 — sáu lỗi lộ ra khi lần đầu chạy bộ đánh giá trên Windows

Khối đo ở mục 1 và 7 đóng được trong một buổi, nhưng không lượt nào chạy thẳng được lần
đầu. Cả sáu lỗi đều **đã sửa** (commit `55e7b16`, `2e41e8b` — message ghi chi tiết từng
cái), và cả sáu đều chỉ lộ ra khi chạy thật: chúng nằm ở chỗ tiếp giáp giữa môi trường
và thư viện, không nằm trong logic, nên không lớp test nào bắt được.

| #   | Lỗi                                                                        | Vì sao không ai thấy sớm hơn                                                              |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | `make fetch-fleurs` chết ở dòng log đầu — stdout bị pipe là cp1252         | Cùng họ với lỗi log service 19/09; chỉ xảy ra khi `make` pipe, chạy tay thì không         |
| 2   | venv dev chạy whisper.cpp trên **CPU** (RTF 1,5 — chậm hơn thời gian thực) | Wheel Vulkan chỉ nằm trong bộ cài. **WER vẫn ra đúng**, chỉ có RTF sai — rất dễ bỏ qua    |
| 3   | NLLB không có nhánh `cuda`, luôn rơi về CPU                                | Đo 19/09 đổ cho torch bản PyPI; thật ra adapter thiếu hẳn nhánh. 789 → 181 ms             |
| 4   | faster-whisper hỏi `torch.cuda.is_available()` nên không bao giờ thấy GPU  | Hai thư viện mang runtime CUDA riêng. Hỏi `ctranslate2.get_cuda_device_count()` mới đúng  |
| 5   | CTranslate2 chết vì thiếu `cublas64_12.dll` — ở **câu đầu tiên**           | Sau khi đã tải 1,6 GB và nạp xong. `os.add_dll_directory` không cứu được, phải sửa `PATH` |
| 6   | `eval_asr.py` chụp `runtime_info()` **sau** `unload()`                     | File JSON đã chốt ghi `accel: CPU` cho lượt chạy trên GPU. Chỉ người đọc báo cáo thấy     |

Hai chi tiết đáng nhớ vì dễ dẫm lại:

- Thêm extra `cuda` phải khai `cpu`/`cuda` là **hai extra xung đột** (`[tool.uv]
conflicts`). Thiếu dòng đó thì `uv sync` trần — thứ `tools/bundle_service.sh` chạy —
  cũng kéo torch CUDA về, và bộ cài phình thêm ~3 GB.
- `uv sync` trả `pywhispercpp` về bản CPU vì lock ghim bản PyPI, nên sau
  `make setup-vulkan` thì mọi lệnh đo phải chạy với `UV_NO_SYNC=1`.

Thêm `make eval-latency-all`: bảng sáu chiều trước đây phải gõ tay sáu lượt nên không
dựng lại được bằng một lệnh.

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
