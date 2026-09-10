# Việc còn lại — trạng thái sau đợt 07/09/2026

**Cập nhật:** 07/09/2026 · **Nhánh:** `main`
**Nguồn yêu cầu:** [biên bản họp GVHD 19/08/2026](meetings/bien-ban-hop-GVHD-2026-08-19.md)

> Biên bản họp là **bản ghi thầy đã nói gì**, giữ nguyên không sửa. Tài liệu này là
> **trạng thái làm được tới đâu** — mở file này ra trước khi làm tiếp.
>
> Ngoại lệ duy nhất: **mục 7 "Việc cần làm tiếp"** của biên bản đã được tick trạng thái
> ngày 07/09 — đó là checklist việc chứ không phải lời thầy. Mục 1–6 vẫn nguyên văn.
> Biên bản cho cái nhìn nhanh "xong/chưa xong", file này giải thích **vì sao** còn treo.

Tóm tắt một câu: **đã có bộ số đo thật đầu tiên** trên macOS Apple Silicon
([`25`](25_ket-qua-chay-thu-e2e.md)) — độ trễ đủ sáu chiều và WER/chrF, chạy tự động
trên app đóng gói. Việc còn lại chia làm hai loại rạch ròi: những thứ chỉ cần **chạy
trên phần cứng/dữ liệu chưa có** (Windows, giọng người thật, FLEURS), và
những thứ **cần người quyết** (nhắn thầy, chốt ngưỡng RTF).

Đã xong từ 04/09 tới nay, không cần làm lại:

- Màn hình đánh giá trong app (biên bản 3d) — [`21`](21_man-danh-gia-va-backend-thu-ba.md)
- Backend ASR thứ hai (MLX) và thứ ba (faster-whisper), tách người nói — [`19`](19_backend-asr-va-tach-nguoi-noi.md), [`21`](21_man-danh-gia-va-backend-thu-ba.md)
- Duyệt trước khi gửi, các thao tác quản lý model từng bị vô hiệu — [`20`](20_duyet-truoc-khi-gui-va-quan-ly-model.md)
- Đặt tên model theo đường dẫn thượng nguồn — [`22`](22_dat-ten-model-theo-duong-dan-that.md)
- Chọn model không còn là nạp model; tải được repo HF bất kỳ — [`23`](23_chon-model-khong-phai-nap-model.md)
- Model tải dở không còn bị tính là đã tải — [`24`](24_tai-do-dang-khong-phai-da-tai.md)
- **Ba lớp test**: pytest (302 pass, 4 skip) · vitest cho renderer (44) · Playwright trên
  app Electron thật + service thật (11). `make test` chạy hai lớp đầu, `make e2e` chạy
  lớp thứ ba. _(Số pytest đo lại ngày 07/09.)_
- **Bộ mẫu đánh giá phủ đủ sáu chiều** vi↔en, vi↔ja, vi↔zh (22 câu)

---

## 0. Quá hạn — làm trước, không cần code

Hai việc chỉ cần nhắn tin, nhưng đang trễ:

- [ ] **Nhắc thầy về baseline cloud.** Biên bản mục 7, Ưu tiên 3 ghi rõ _"nhắc thầy sau
      2 tuần"_. Họp 19/08 → tính tới 07/09 là **19 ngày**.
- [ ] **Báo cáo thầy công thức RTF và ngưỡng "đạt".** Thầy dặn tự tra rồi báo lại (biên
      bản mục 3c và câu hỏi số 2). Nội dung đã soạn xong, có trích nguồn đầy đủ, ở
      [`26_do-do-danh-gia-wer-bleu-comet-rtf.md` mục 5](26_do-do-danh-gia-wer-bleu-comet-rtf.md) —
      **copy nguyên mục 5 gửi thầy**. Kèm theo là mục 8 của tài liệu đó: **5 điểm cần
      thầy chốt**, trong đó có ngưỡng RTF p90 < 1 (điều kiện cần) hay chặt hơn ở 0,5.

Kèm theo, nên báo thầy hai điều đã phát hiện khi làm (chi tiết ở mục 5 dưới): **zh/ja
phải dùng CER chứ không phải WER**, và **COMET không cài chung môi trường được**.

Việc thứ ba trong Ưu tiên 1 — _"tự tìm hiểu các thuật ngữ/độ đo mới: WER, BLEU, COMET,
RTF"_ — đã xong, viết ở [`26`](26_do-do-danh-gia-wer-bleu-comet-rtf.md): công thức, ví dụ
tính tay, cái bẫy khi diễn giải, ngưỡng đề xuất và danh sách nguồn trích dẫn.

---

## 1. Chạy thật bộ đánh giá — việc lớn nhất

Đây là thứ chặn gần như mọi việc còn lại. Code đã xong ở
[`17_bo-danh-gia-fleurs.md`](17_bo-danh-gia-fleurs.md).

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
Chi tiết cách tải và chỗ dữ liệu nằm ở [`17` mục 2](17_bo-danh-gia-fleurs.md).

**Mục (a) và (b) đã xong**, bảng số và phần đọc số ở [`17` mục 8](17_bo-danh-gia-fleurs.md):

- (a) ASR: 3.099 bản thu, 10,22 giờ audio, 86 phút, `mlx-community/whisper-large-v3-asr-8bit`
  — vi WER 8,8% · en WER 4,8% · zh CER 8,1% · ja CER 4,7% · RTF gộp 0,141 · **0 câu rỗng**.
- (b) MT: 2.022 cặp câu, sáu chiều, có cả điểm COMET.

- (c) Độ trễ: 50 mẫu × sáu chiều, cùng cấu hình đã đo WER — **RTF p90 < 1 ở cả sáu**
  (xấu nhất vi→ja 0,786), nhưng ngưỡng chặt hơn 0,5 thì chỉ ba chiều đạt.

**Cả ba mục (a)(b)(c) của biên bản đã có số thật.** Việc còn lại của khối đo:

- [ ] Cột so sánh **whisper.cpp với MLX** trên cùng thang: `make eval-asr JSON=eval-asr-ggml.json`
      bản đầy đủ (~55 phút). Hiện whisper.cpp mới có số trên 20 câu.
- [ ] Ba chiều **nguồn tiếng Việt** chưa đạt ngưỡng RTF p90 ≤ 0,5. Theo [`17` mục 8c](17_bo-danh-gia-fleurs.md)
      thì hai chỗ đáng sửa là ASR cho nguồn tiếng Việt (chiếm 58–75% tổng thời gian) và
      TTS cho đích tiếng Nhật (chiếm 28,3%) — **không phải MT**, vốn ổn định ~1 giây ở
      cả sáu chiều.

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

      make endpointing MEDIA=ban-ghi.mov

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

| Việc                                              | Ghi chú                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**Màn hình đánh giá trong app**~~ (biên bản 3d) | ✅ **Xong** — [`21`](21_man-danh-gia-va-backend-thu-ba.md). Đã chạy thật đủ 22 câu / sáu chiều, số ở [`25`](25_ket-qua-chay-thu-e2e.md) mục 4.                                                                                                                                                                               |
| ~~**Quyết giữ hay bỏ ràng buộc Google Meet**~~    | ✅ **Đã quyết 10/09/2026: bỏ.** Hai vấn đề ở mục 2 có mã xử lý nhưng chưa kiểm chứng được trên giọng người thật trước hạn nộp, nên giữ một tính năng chưa chắc ổn định lúc bảo vệ là rủi ro không cần thiết. Mã nguồn giữ nguyên, tắt ở lớp giao diện — [`13`](13_google-meet-and-virtual-mic.md) ghi lý do và cách bật lại. |
| **Cải thiện dịch — nhưng là chiều vi→zh**         | `eval-mt` + `eval-comet` đã chạy đầy đủ ([`17` mục 8](17_bo-danh-gia-fleurs.md)): ja→vi hoá ra **không** phải chiều tệ nhất (spBLEU 19,91 · COMET 0,8191). Chiều yếu nhất là **vi→zh** — cả spBLEU (17,15) lẫn COMET (0,7729) cùng chỉ vào đó. Nhắm vào vi→zh chứ đừng nhắm ja→vi.                                           |
| **Kiểm tra ổn định trên Windows 11**              | Máy Windows đã có sẵn. Chạy được ngay sau khi tải model. Cần chú ý: whisper.cpp trên Windows không có Metal → RTF sẽ khác macOS.                                                                                                                                                                                             |

---

## 4. Ưu tiên 3 — sau khi xong 1 và 2

- [ ] Tích hợp baseline cloud để đối chứng (thầy hướng dẫn — xem mục 0)
- [ ] Tích hợp thêm model khác, lập bảng so sánh chất lượng/độ trễ trên cùng tiêu chí
      (a)(b)(c). Hạ tầng đã sẵn: thêm adapter → thêm một dòng vào registry ở
      `application/model_manager.py` → trỏ preset vào nó, rồi chạy lại đúng ba lệnh
      `make eval-*`.
- [ ] Thiết kế option nhanh–nhẹ / chất lượng cao cho người dùng. Đã có một nửa: mỗi
      preset giờ mang một `VadTuning` riêng (4,5 / 6 / 8 giây), còn thiếu phần đo để
      chứng minh sự đánh đổi.
- [ ] Báo cáo, đóng gói cài đặt, video demo
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
- [ ] **Cân nhắc `LLVT_ASR_AUDIO_CTX`.** Rút ngắn ngữ cảnh encoder của whisper.cpp (~768
      thay vì 1500) làm ASR nhanh lên rõ rệt vì đoạn VAD chỉ vài giây chứ không phải 30
      giây. Đang mặc định **tắt** vì nó ảnh hưởng độ chính xác — chỉ bật sau khi đo được
      WER tương ứng. Đây là một điểm đo đẹp cho bảng "độ trễ ↔ chất lượng" ở Ưu tiên 3.

---

## 7. Đợt 05/09 — backend ASR thứ hai + tách người nói

Chi tiết ở [`19_backend-asr-va-tach-nguoi-noi.md`](19_backend-asr-va-tach-nguoi-noi.md).
Code đã xong và test sạch, phần **chạy thật thì chưa**:

- [ ] **Đo MLX so với whisper.cpp trên máy Apple Silicon.** Đây mới là lý do thêm backend
      thứ hai — thêm một cột vào bảng của [`17`](17_bo-danh-gia-fleurs.md):
      `make eval-asr ADAPTER=mlx_whisper MODEL=<repo mlx> JSON=eval-asr-mlx.json`
      (`eval_asr.py` giờ nhận `--adapter`/`--model`, dựng adapter qua `ASR_REGISTRY`).
      Đã chọn xong model bằng bảng đo 7 bản MLX ở
      [`19` mục 2.2b](19_backend-asr-va-tach-nguoi-noi.md): dùng
      `whisper-large-v3-asr-8bit` (WER 6,7% · RTF 0,14 · 1,2 GB — bằng chất lượng bản
      fp16 mà nhẹ hơn 2,3 lần). **Đã có một nửa:**
      [`25`](25_ket-qua-chay-thu-e2e.md) cho số của MLX large-v3-turbo fp16 (ASR
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
- [ ] **Quyết có đóng gói `--extra mlx` / `--extra diarization` vào bản cài không.** Hiện
      cả hai là phần cài thêm; nếu đưa vào bản phát hành thì phải cập nhật
      [`12_install-guide.md`](12_install-guide.md) và tính lại dung lượng bản cài.

---

## 8. Đợt 05/09 (2) — nhóm A: tính năng có chỗ trong UI nhưng thiếu backend

Chi tiết ở [`20_duyet-truoc-khi-gui-va-quan-ly-model.md`](20_duyet-truoc-khi-gui-va-quan-ly-model.md).
Rà toàn bộ `DisabledButton` / `notSupported` / enum không ai phát ra thì còn đúng năm
chỗ, đã đóng cả năm. Còn phải thử tay:

- [ ] **Duyệt trước khi gửi trong một cuộc họp thật** — đếm ngược 5 giây có đủ để đọc
      và sửa không, hay phải dài hơn. Bật ở màn Cài đặt.
- [ ] **Nút Huỷ nạp model** mới thử được nhánh "không có gì đang chạy". Muốn thử đúng
      đường dừng-giữa-chừng thì phải xoá model đi rồi bấm nạp lại.

---

## 9. Đợt 05/09 (3) — nhóm B và C: hai việc code cuối cùng

Chi tiết ở [`21_man-danh-gia-va-backend-thu-ba.md`](21_man-danh-gia-va-backend-thu-ba.md).

**Màn Đánh giá trong app** (mục 3d thầy giao, dòng đầu bảng ở mục 3 trên) — đã xong.
**Adapter `faster_whisper`** — đã hiện thực thật, không còn stub nào trong dự án.

Còn phải chạy thật:

- [ ] **Thay bộ câu mẫu 10 câu bằng câu thoại họp thật, có thu âm giọng người.** Đây
      là việc quyết định giá trị của mọi con số trên màn Đánh giá — bộ đi kèm chỉ để
      màn hình có thứ chạy được ngay, và nó chạy bằng giọng tổng hợp nên số lạc quan
      hơn thực tế.
- [ ] **Đo faster-whisper trên máy Windows + NVIDIA**, thêm cột thứ ba vào bảng của
      [`17`](17_bo-danh-gia-fleurs.md): `make setup-ctranslate2` rồi
      `LLVT_ASR_ADAPTER=faster_whisper make eval-asr`.

**Từ đây, dự án không còn việc code nào đang treo.** Toàn bộ phần còn lại là chạy
thật, đo số, và Tuần 9 (báo cáo / đóng gói / demo).

---

## Phụ lục — đã làm gì trong đợt 04/09

| Commit    | Nội dung                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| `d0e700a` | Tách câu hai ngưỡng im lặng + cắt cứng có lùi (mục 4.2); lọc câu ma của Whisper (mục 4.1); `make endpointing`     |
| `e0b3180` | Bộ đánh giá FLEURS: `eval-asr` / `eval-mt` / `eval-comet` / `eval-latency`; [`docs/17`](17_bo-danh-gia-fleurs.md) |

Đã kiểm thử: 141 test pass, ruff sạch, `tsc` sạch. Đã kiểm chứng thật: đọc văn bản và
audio FLEURS, độ chính xác từng độ đo, ghép cặp 6 chiều, nhịp ngắt 0,2s không băm câu
còn 0,8s thì tách câu (chạy trên model Silero thật).
