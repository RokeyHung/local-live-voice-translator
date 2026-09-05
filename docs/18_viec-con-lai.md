# Việc còn lại — trạng thái sau đợt sửa 04/09/2026

**Cập nhật:** 04/09/2026 · **Nhánh đang làm:** `feat/gvhd-2026-08-19`
**Nguồn yêu cầu:** [biên bản họp GVHD 19/08/2026](meetings/bien-ban-hop-GVHD-2026-08-19.md)

> Biên bản họp là **bản ghi thầy đã nói gì**, giữ nguyên không sửa. Tài liệu này là
> **trạng thái làm được tới đâu** — mở file này ra trước khi làm tiếp.

Tóm tắt một câu: phần **code** của Ưu tiên 1 đã xong và đã kiểm thử, nhưng **chưa có một
con số đo thật nào** vì máy đang dùng chưa tải model. Thầy cần ba bảng kết quả, không
phải ba script — nên mọi việc còn lại đều nằm sau bước "chạy thật".

---

## 0. Quá hạn — làm trước, không cần code

Hai việc chỉ cần nhắn tin, nhưng đang trễ:

- [ ] **Nhắc thầy về baseline cloud.** Biên bản mục 7, Ưu tiên 3 ghi rõ _"nhắc thầy sau
      2 tuần"_. Họp 19/08 → tính tới 04/09 là **16 ngày**.
- [ ] **Báo cáo thầy công thức RTF và ngưỡng "đạt".** Thầy dặn tự tra rồi báo lại (biên
      bản mục 3c và câu hỏi số 2). Nội dung đã soạn sẵn ở
      [`17_bo-danh-gia-fleurs.md` mục 5](17_bo-danh-gia-fleurs.md) — copy phần đó gửi
      thầy, trong đó có một điểm cần thầy chốt: lấy ngưỡng RTF p90 < 1 (điều kiện cần)
      hay chặt hơn ở 0,5.

Kèm theo, nên báo thầy hai điều đã phát hiện khi làm (chi tiết ở mục 5 dưới): **zh/ja
phải dùng CER chứ không phải WER**, và **COMET không cài chung môi trường được**.

---

## 1. Chạy thật bộ đánh giá — việc lớn nhất

Đây là thứ chặn gần như mọi việc còn lại. Code đã xong ở
[`17_bo-danh-gia-fleurs.md`](17_bo-danh-gia-fleurs.md).

```bash
make setup-eval                    # cài datasets + sacrebleu + jiwer (một lần)

make eval-mt LIMIT=10              # chạy thử: xem NLLB mất bao lâu mỗi câu
make eval-mt                       # bản đầy đủ → eval-mt.json
make eval-comet                    # chấm COMET lên chính file đó

make eval-asr LIMIT=20             # chạy thử
make eval-asr                      # bản đầy đủ → eval-asr.json

make eval-latency LIMIT=20         # Total Inference Time + RTF
```

**Làm `eval-mt` trước** dù thầy đánh số (a) cho ASR: nó chỉ tải văn bản (~600 KB mỗi
ngôn ngữ) nên nhẹ hơn nhiều, và cho biết ngay tốc độ NLLB để ước lượng các bước sau.

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

### Xong là khi nào

Ba file `eval-asr.json` / `eval-mt.json` / `eval-latency.json` có số thật, và ba bảng
tương ứng chép được vào báo cáo. Các file JSON đã bị `.gitignore` (số liệu của từng
máy) — chép bảng vào tài liệu chứ đừng commit file.

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

## 3. Ưu tiên 2 — chưa bắt đầu

| Việc                                          | Ghi chú                                                                                                                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Màn hình đánh giá trong app** (biên bản 3d) | Việc lớn nhất còn lại về code. Thầy muốn: chọn câu mẫu có bản dịch tham chiếu, chạy qua hệ thống, app tự tính độ trễ **và** chất lượng. Dữ liệu lấy từ `scripts/fleurs.py` (đã có sẵn). |
| **Quyết giữ hay bỏ ràng buộc Google Meet**    | Thầy gợi ý cân nhắc bỏ (biên bản 4.3), phụ thuộc việc xử lý được silence detection hay không. Giờ đã sửa xong phần tách câu → **quyết được sau khi làm xong mục 2**.                    |
| **Cải thiện dịch Nhật → Việt**                | Làm sau `eval-mt`: cần biết chiều ja→vi đang tệ cỡ nào trước khi sửa, không thì không biết sửa có ăn thua không.                                                                        |
| **Kiểm tra ổn định trên Windows 11**          | Máy Windows đã có sẵn. Chạy được ngay sau khi tải model. Cần chú ý: whisper.cpp trên Windows không có Metal → RTF sẽ khác macOS.                                                        |
| **Chạy thật trên Google Meet**                | Phụ thuộc quyết định ở dòng 2.                                                                                                                                                          |

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

- [ ] **Push nhánh lên GitHub.** Hai commit `d0e700a` và `e0b3180` đang nằm local trên
      `feat/gvhd-2026-08-19`, chưa đẩy lên `origin`. Cũng cần quyết merge vào `main` hay
      giữ nhánh (repo vốn commit thẳng `main` — xem `CLAUDE.md`).
- [ ] **Sửa 9072 cảnh báo CRLF của `make lint`** (0 lỗi, chỉ là cảnh báo, có từ trước đợt
      này). Repo không có `.gitattributes`, prettier mặc định `endOfLine: lf` trong khi
      Git checkout ra CRLF trên Windows. Sửa bằng một dòng `endOfLine: auto` trong
      `.prettierrc.yaml` và `apps/desktop/.prettierrc.yaml`.
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
      `make setup-mlx && LLVT_ASR_ADAPTER=mlx_whisper make eval-asr`.
- [ ] **Chạy thử diarization trên một bản ghi họp nhiều người thật**, xem nhãn có khớp
      người nói không. Cần `make setup-diarization`, `LLVT_HF_TOKEN` và đồng ý điều khoản
      repo pyannote trên huggingface.co (chỉ cần cho lần tải đầu).
- [ ] **Quyết có đóng gói `--extra mlx` / `--extra diarization` vào bản cài không.** Hiện
      cả hai là phần cài thêm; nếu đưa vào bản phát hành thì phải cập nhật
      [`12_install-guide.md`](12_install-guide.md) và tính lại dung lượng bản cài.

---

## Phụ lục — đã làm gì trong đợt 04/09

| Commit    | Nội dung                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| `d0e700a` | Tách câu hai ngưỡng im lặng + cắt cứng có lùi (mục 4.2); lọc câu ma của Whisper (mục 4.1); `make endpointing`     |
| `e0b3180` | Bộ đánh giá FLEURS: `eval-asr` / `eval-mt` / `eval-comet` / `eval-latency`; [`docs/17`](17_bo-danh-gia-fleurs.md) |

Đã kiểm thử: 141 test pass, ruff sạch, `tsc` sạch. Đã kiểm chứng thật: đọc văn bản và
audio FLEURS, độ chính xác từng độ đo, ghép cặp 6 chiều, nhịp ngắt 0,2s không băm câu
còn 0,8s thì tách câu (chạy trên model Silero thật).
