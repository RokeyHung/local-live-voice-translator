---
marp: true
theme: default
paginate: true
size: 16:9
header: 'Dịch giọng nói gần thời gian thực bằng AI chạy cục bộ'
footer: 'Ngô Mạnh Hùng – 24410300 · CBHD: ThS. Nguyễn Thành Luân'
---

<!-- Xuất file: npx @marp-team/marp-cli docs/10_slides-bao-cao.md -o slides.pdf (thêm --pptx nếu cần PowerPoint) -->

<!-- _paginate: false -->
<!-- _header: '' -->

# Xây dựng hệ thống dịch giọng nói đa ngôn ngữ gần thời gian thực bằng mô hình AI chạy cục bộ

**Sinh viên:** Ngô Mạnh Hùng – 24410300 (Đào tạo từ xa)
**CBHD:** ThS. Nguyễn Thành Luân
**Thời gian:** 16/07/2026 – 23/09/2026

Báo cáo ý tưởng · hiện trạng · các điểm cần thầy cho ý kiến

---

## 1. Vấn đề

- Họp/học trực tuyến xuyên ngôn ngữ ngày càng phổ biến (Meet, Teams, Zoom).
- Giải pháp dịch giọng nói hiện nay **chủ yếu chạy trên cloud**:
  - phụ thuộc Internet ổn định,
  - phát sinh chi phí theo phút,
  - **toàn bộ nội dung cuộc họp phải rời khỏi máy người dùng** → rủi ro riêng tư với họp nội bộ, y tế, pháp lý.
- Câu hỏi của đề tài: **một chiếc laptop cá nhân hiện nay có đủ sức chạy trọn pipeline dịch giọng nói không, và độ trễ có chấp nhận được để nói chuyện không?**

---

## 2. Ý tưởng

Ứng dụng desktop demo, **dịch giọng nói hai chiều**: vừa nghe micro của người dùng, vừa nghe âm thanh đang phát trên máy (cuộc gọi, video, bài giảng). Mọi xử lý AI chạy **cục bộ trên máy** — không gọi API cloud trong lúc phiên dịch.

| Chiều               | Luồng                                                 | Đầu ra                                    |
| ------------------- | ----------------------------------------------------- | ----------------------------------------- |
| **Nghe** (incoming) | Âm thanh hệ thống (tiếng đối phương) → VAD → ASR → MT | **Phụ đề song ngữ** trên màn hình         |
| **Nói** (outgoing)  | Microphone → VAD → ASR → MT → TTS                     | **Phụ đề + đọc bản dịch** ra loa/tai nghe |

Ngôn ngữ: **tiếng Việt ↔ Anh / Nhật / Trung** (6 chiều dịch).
Nền tảng: **Windows 11 x64** và **macOS 13+ Apple Silicon**.

---

## 3. Phạm vi — và những gì cố ý **không** làm

**Có làm**

- Pipeline VAD → ASR → MT → TTS → định tuyến âm thanh, chạy hoàn toàn local.
- Thu đồng thời mic + âm thanh hệ thống, chống vòng lặp âm thanh.
- Ứng dụng desktop có màn thiết lập thiết bị, phụ đề, lịch sử, chẩn đoán.

**Không làm** (đã chốt trong đề cương)

- Không đề xuất mô hình/thuật toán AI mới — đề tài là **tích hợp hệ thống**.
- Không dịch đồng thời theo từng từ; đơn vị xử lý là **một đoạn phát ngôn** sau khi người nói ngắt câu.
- Không voice cloning, không giữ giọng người nói, không tách nhiều người nói (diarization).
- **Không tích hợp với phần mềm họp.** Bản dịch phát ra loa/tai nghe, không đẩy ngược
  vào Google Meet qua microphone ảo.

> **Chỗ này đã đổi so với đề cương — nên nói chủ động, đừng để hội đồng hỏi.** Phần đẩy
> tiếng dịch vào Google Meet đã **hiện thực xong và chạy được** ở Tuần 5 + Tuần 7, rồi
> **bỏ khỏi phạm vi ngày 10/09/2026**. GVHD gợi ý cân nhắc bỏ ngay từ buổi họp 19/08
> (biên bản mục 4.3): kịch bản nói liên tục trong cuộc họp làm lộ rõ hai điểm yếu —
> Whisper bịa chữ trên đoạn im lặng, và không tìm được điểm ngắt câu khi người ta nói
> không nghỉ. Cả hai đã có mã xử lý nhưng chưa kiểm chứng được trên giọng người thật
> trước hạn nộp, nên bỏ an toàn hơn là giữ. Mã nguồn giữ nguyên, chỉ tắt ở giao diện.
>
> Điều **không** đổi: ứng dụng vẫn thu được âm thanh hệ thống, nên vẫn dịch được cả hai
> phía của một cuộc gọi — chỉ là bản dịch không đi ngược vào cuộc gọi.

---

## 4. Pipeline xử lý

```text
Chiều NÓI — mình nói, máy đọc lại bản dịch
  Microphone ─► VAD ─► ASR ─► MT ─► TTS ─► Loa / tai nghe
                Silero  whisper  NLLB  sherpa-onnx
                        .cpp     -200   / Kokoro
                          │       │
                          └───────┴──► Phụ đề (UI)

Chiều NGHE — đối phương nói, mình đọc phụ đề
  Âm thanh hệ thống ─► VAD ─► ASR ─► MT ─► Phụ đề song ngữ (UI)
```

- **VAD** cắt câu theo khoảng lặng → quyết định khi nào một "utterance" kết thúc.
- **Hai chiều có hai kiểu đầu ra khác nhau**, cố ý: chiều nói đọc bản dịch thành tiếng,
  chiều nghe chỉ hiện phụ đề. Đọc thành tiếng cả hai chiều thì tiếng máy sẽ chồng lên
  tiếng người thật đang nói.
- **Phải đeo tai nghe.** Ứng dụng thu toàn bộ đầu ra của hệ điều hành để lấy tiếng phía
  bên kia, nên phát ra loa ngoài thì chính bản dịch bị thu lại, dịch tiếp, đọc tiếp —
  vòng lặp không có điểm dừng. Màn Thiết bị âm thanh có mục kiểm tra riêng cho việc này.

---

## 5. Lựa chọn mô hình và lý do

| Khâu | Mô hình / runtime                                 | Vì sao chọn                                                                                                   |
| ---- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| VAD  | **Silero VAD**                                    | Nhẹ (~1 MB), chạy CPU, độ trễ vài chục ms                                                                     |
| ASR  | **Whisper large-v3-turbo q5** qua **whisper.cpp** | Đa ngôn ngữ sẵn, bản lượng tử hoá chạy được trên máy cá nhân, tăng tốc Metal/CUDA                             |
| MT   | **NLLB-200 distilled 600M**                       | Phủ đủ 6 chiều dịch trong **một** mô hình duy nhất                                                            |
| TTS  | **sherpa-onnx** (vi/en/zh) + **Kokoro ONNX** (ja) | Chạy ONNX offline; sherpa-onnx **không có front-end tiếng Nhật dùng được** → phải ghép Kokoro + G2P OpenJTalk |

> Bài học rút ra: khâu tưởng dễ nhất (TTS) lại là khâu duy nhất phải đổi kiến trúc giữa chừng.

---

## 6. Kiến trúc tổng thể — hai tiến trình

```text
┌──────────────────────────┐                      ┌──────────────────────────┐
│ apps/desktop  (Electron) │  REST — cấu hình,    │ apps/ai-service (Python) │
│ React + TypeScript       │◄─── model, lịch sử,─►│ FastAPI + SQLite         │
│                          │      đo đạc          │                          │
│ • Giao diện, phụ đề      │                      │ • VAD / ASR / MT / TTS   │
│ • Thu mic + system audio │  WebSocket /ws       │ • Vòng đời model         │
│ • Định tuyến ra loa      │◄─── audio.chunk ────►│ • Lịch sử + đo đạc       │
│                          │     asr / mt / tts   │                          │
└──────────────────────────┘                      └──────────────────────────┘
              chỉ lắng nghe trên 127.0.0.1 — không mở ra LAN
```

**Vì sao tách làm hai tiến trình thay vì gói hết vào Electron:**

- Hệ sinh thái model AI (pywhispercpp, transformers, sherpa-onnx, Silero) **chỉ có ở Python**; còn thu âm thanh hệ thống và chọn thiết bị vào/ra lại là thứ **Electron/Chromium làm sẵn**.
- Model chiếm ~2 GB RAM và chặn CPU hàng giây — để chung tiến trình thì **giao diện đơ** mỗi lần dịch một câu.
- Service chết thì cửa sổ ứng dụng vẫn sống để báo lỗi, và khởi động lại được.

**Giá phải trả (nói thẳng trong báo cáo):** đóng gói hai runtime, và **hợp đồng giao tiếp bị định nghĩa hai lần** (Python + bản sao TypeScript) → phải giữ đồng bộ thủ công.

---

## 7. Cả hai app dùng Hexagonal (Ports & Adapters)

```text
        adapters ──────► ports ◄────── application ──────► domain
       (hạ tầng:        (interface     (pipeline,          (dataclass
     whisper.cpp,        ABC cho        ModelManager,       thuần, không
     NLLB, sherpa,       4 khâu +       SessionService)     import gì)
     SQLite)             repository)          ▲
                                              │
                              transport ──────┘
                             (REST + WebSocket, rất mỏng)
```

**Một quy tắc duy nhất: phụ thuộc luôn hướng vào trong.**
`domain` không import gì · `application` chỉ biết `ports` + `domain` · `adapters` và `transport` là vòng ngoài, thay được.

| Tầng           | Vai trò                                       | Ví dụ trong đề tài                          |
| -------------- | --------------------------------------------- | ------------------------------------------- |
| `domain/`      | Dữ liệu + sự kiện thuần                       | `Utterance`, `PipelineEvent`                |
| `ports/`       | Hợp đồng trừu tượng                           | `SpeechToTextProvider`, `SessionRepository` |
| `application/` | Nghiệp vụ, **không biết model nào đang chạy** | `TranslationPipeline`, `ModelManager`       |
| `adapters/`    | Bản hiện thực cụ thể                          | `asr/whisper_cpp.py`, `tts/kokoro_ja.py`    |

---

## 8. Kiến trúc này đã "trả lãi" ở đâu

Không phải vẽ cho đẹp — ba tình huống có thật trong quá trình làm:

1. **TTS tiếng Nhật hỏng giữa Tuần 5.** sherpa-onnx không có front-end tiếng Nhật dùng được → viết thêm adapter Kokoro, rồi đặt một `LanguageRoutedTts` (cũng hiện thực đúng port TTS) để chọn engine theo ngôn ngữ đích. **Pipeline không sửa một dòng** — nó vẫn chỉ thấy một provider.

2. **Yêu cầu riêng tư "tắt lưu lịch sử".** Hiện thực bằng `HistoryPolicy` bọc quanh repository thật: tắt thì lệnh ghi thành no-op, đọc/xoá vẫn chạy. Chính sách nằm ở `application` vì **adapter biết _cách_ lưu, không có quyền biết _có được phép_ lưu**.

3. **Kiểm thử không cần model thật.** Test thay adapter bằng provider giả → **88 test chạy vài giây**, máy CI không phải tải 4 GB model.

→ Đổi backend (ví dụ sang MLX Whisper cho nhanh hơn trên Apple Silicon): **1 adapter mới + 1 dòng đăng ký + 1 dòng preset**. Không đụng pipeline, không đụng UI. Đây là điểm em muốn nhấn trong báo cáo, vì nó chính là phần "đóng góp kỹ thuật" của một đề tài tích hợp hệ thống.

---

## 9. Hiện trạng (1/2) — pipeline và âm thanh

**Pipeline dịch — chạy bằng model thật, không có mock**

- ✅ Cắt câu bằng **Silero VAD** theo khoảng lặng, có giới hạn độ dài tối đa một câu.
- ✅ **ASR** whisper.cpp `large-v3-turbo-q5`, tăng tốc Metal trên macOS và Vulkan trên Windows; nhận cả 4 ngôn ngữ.
- ✅ **MT** NLLB-200 distilled 600M — chạy được **đủ 6 chiều** vi ↔ en / ja / zh.
- ✅ **TTS** 4 ngôn ngữ: sherpa-onnx (vi/en/zh) + Kokoro & OpenJTalk (ja).
- ✅ Ba **preset Fast / Balanced / Quality**, đổi được ngay lúc đang chạy.

**Âm thanh hai chiều**

- ✅ Thu **đồng thời** microphone và âm thanh hệ thống (ScreenCaptureKit trên macOS, WASAPI loopback trên Windows).
- ✅ **Push-to-talk** + mute; nhả phím giữa câu thì câu đang nói dở vẫn được chốt và dịch nốt.
- ✅ **Chặn vòng lặp âm thanh**: trong lúc TTS đang phát thì khung âm thanh hệ thống bị bỏ qua.
- ◻️ Đẩy giọng đã dịch vào **microphone ảo** (BlackHole / VB-CABLE) để Meet nhận như một
  micro — **đã hiện thực và chạy được, nhưng bỏ khỏi phạm vi ngày 10/09**; mã nguồn giữ
  lại, chỉ tắt ở giao diện.

---

## 10. Hiện trạng (2/2) — ứng dụng và công cụ đo

**Ứng dụng desktop — 6 màn hình hoạt động**

> Thiết lập thiết bị · Phiên dịch + phụ đề song ngữ · Quản lý model · Lịch sử · Chẩn đoán · Cài đặt

- ✅ **Nạp model theo yêu cầu**: mở ứng dụng mất **0,4 s** thay vì 45 s; có thanh tiến trình đo bằng **số byte thật trên đĩa** trong lúc tải.
- ✅ **Lịch sử phiên** lưu SQLite: tìm kiếm theo tiêu đề và nội dung câu, đổi tên, xoá từng phiên hoặc xoá sạch; **tắt được việc lưu** (quyền riêng tư).
- ✅ **Đổi thư mục lưu model** và **xoá model đã tải** ngay trong ứng dụng.
- ✅ Giao diện **song ngữ Việt/Anh**, chạy được trên cả macOS và Windows.

**Công cụ đo đạc và kiểm thử**

- ✅ API đo **độ trễ từng khâu** VAD/ASR/MT/TTS + **CPU/RAM** của tiến trình service.
- ✅ Script đo **WER (ASR)** và **chrF (MT)**; script **chạy liên tục nhiều giờ**; script **cắt đoạn** từ bản ghi dài để làm bộ câu kiểm thử.
- ✅ **88 test tự động** (4 skipped), typecheck và lint sạch trên cả hai app.

---

## 11. Số đo thực tế (MacBook Apple Silicon, preset Balanced, audio vào 3 giây)

| Chiều dịch | VAD | ASR  | MT  | TTS | **Tổng**    |
| ---------- | --- | ---- | --- | --- | ----------- |
| vi → en    | 46  | 1060 | 569 | 141 | **1819 ms** |
| en → vi    | 46  | 991  | 579 | 148 | **1766 ms** |
| vi → ja    | 48  | 1056 | 460 | 772 | **2338 ms** |
| vi → zh    | 46  | 1038 | 558 | 969 | **2613 ms** |

- vi→en: **1,8 s cho 3 giây tiếng nói ≈ 0,6× thời gian thực** → pipeline theo kịp người nói.
- **ASR là khâu nặng nhất**; TTS ja/zh đắt gấp 5–7 lần Piper → chỗ tối ưu đầu tiên.
- RAM: **~2 GB RSS** khi đã nạp đủ whisper + NLLB + 4 giọng.
- Mọi số đều đo **sau warm-up**; đo nguội cho 34,7 s (gồm cả thời gian nạp model).

---

## 11b. Số đo trên FLEURS — bộ dữ liệu chuẩn, 07/09/2026

> Mục 11 là **độ trễ cho một câu ngắn** (audio 3 giây) — đó mới là bộ số đối chiếu với
> mục tiêu hiệu năng ở SPEC 14.1, và nó **đạt cả bốn mốc**. Mục 11b trả lời câu hỏi
> khác: hệ thống có **theo kịp luồng nói liên tục** không (RTF), và dịch **đúng** tới
> đâu. Đừng trộn hai bảng.

Mục 11 đo trên bộ câu tự dựng. Đây là số trên **FLEURS** (bản tiếng nói của FLoRes,
Google) — dữ liệu công khai, có tham chiếu do người gõ, nên **so sánh được với các công
bố khác**. Chi tiết ở [`05` mục 8](05_bo-danh-gia-fleurs.md).

**(a) ASR** — **3.099 bản thu, 10,2 giờ audio**, ba runtime trên cùng bộ dữ liệu:

| Runtime (máy)              | vi (WER)  | en (WER)  | zh (CER)  | ja (CER)  | RTF khâu ASR |
| -------------------------- | --------- | --------- | --------- | --------- | ------------ |
| MLX/Metal — M4             | **8,8 %** | **4,8 %** | **8,1 %** | **4,7 %** | 0,141        |
| faster-whisper/CUDA — 4060 | 9,2 %     | 5,0 %     | 8,3 %     | 4,7 %     | 0,034        |
| whisper.cpp/Vulkan — 4060  | 10,4 %    | 5,0 %     | 8,6 %     | 4,9 %     | 0,018        |

Ba cột là ba **model khác nhau** (ba runtime không dùng chung file model), nên đây là so
cấu hình chứ không phải so runtime thuần. Cột RTF của hàng đầu đo trên máy khác.

**(b) MT** — NLLB-200-distilled-600M, **2.022 cặp câu**, đủ sáu chiều:

| Chiều  | vi→en | en→vi | vi→zh | zh→vi | vi→ja | ja→vi |
| ------ | ----- | ----- | ----- | ----- | ----- | ----- |
| spBLEU | 35,8  | 37,1  | 17,2  | 22,3  | 11,0  | 19,9  |
| COMET  | 0,853 | 0,851 | 0,773 | 0,821 | 0,824 | 0,819 |

**(c) Độ trễ toàn chuỗi** VAD→ASR→MT→TTS, 50 mẫu mỗi chiều:

| Chiều          | vi→en | en→vi | vi→zh | zh→vi | vi→ja | ja→vi |
| -------------- | ----- | ----- | ----- | ----- | ----- | ----- |
| RTF p90 — M4   | 0,580 | 0,496 | 0,727 | 0,509 | 0,786 | 0,395 |
| RTF p90 — 4060 | 0,146 | 0,148 | 0,273 | 0,147 | 0,383 | 0,114 |

**Ba điều nên nói trước khi hội đồng hỏi:**

1. **RTF p90 < 1 ở cả sáu chiều trên cả hai máy** → hệ thống theo kịp thời gian thực.
   Ngưỡng chặt hơn (≤ 0,5): trên Windows **cả sáu đạt**, trên M4 thì ba chiều trượt và
   cả ba đều là chiều **nguồn tiếng Việt**. Khâu tốn nhất cũng đổi theo máy: trên M4 là
   ASR, trên Windows là **TTS cho đích ja/zh** (65% và 63% toàn chuỗi, vẫn chạy CPU).
2. **spBLEU và COMET xếp hạng khác nhau.** Theo spBLEU, vi→ja tệ nhất (11,0); theo COMET
   nó đứng hạng ba (0,824) còn chiều yếu thật sự là vi→zh. spBLEU khớp chuỗi bề mặt nên
   phạt nặng ngôn ngữ khác hệ chữ viết; COMET chấm ngữ nghĩa. Đây là lý do dùng cả hai.
3. **chrF++ không so ngang được ở hai chiều đích zh/ja** (cùng bản chất với chuyện phải
   dùng CER thay WER cho zh/ja), nên bảng báo cáo dựa vào spBLEU + COMET.

---

## 12. Nguyên tắc đã giữ xuyên suốt

- **Không hiển thị số bịa.** Thà để trống hoặc ghi "chưa hỗ trợ" còn hơn hiện giá trị chép tay — mọi ô trên màn Chẩn đoán đều đến từ một endpoint đo thật.
- **Tách nguồn số liệu.** WER đo trên câu tham chiếu do người gõ; bản dịch sinh từ câu gốc chứ không từ transcript, để lỗi ASR không cộng dồn vào điểm MT.
- **Offline là offline thật.** Trang tài liệu API cũng phải nhúng sẵn asset, vì bản mặc định tải từ CDN sẽ trắng trang trên máy không mạng.
- **Riêng tư mặc định.** Chỉ lưu văn bản + số đo, **không lưu file âm thanh**; có công tắc tắt hẳn việc lưu lịch sử.

---

## 13. Còn lại phải làm

| Việc                                                       | Trạng thái                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| ~~Đo lại toàn bộ trên **Windows 11**~~                     | ✅ **Xong 20/09** — mục 11b, cả ba runtime ASR và sáu chiều độ trễ                   |
| ~~**Soak 60 phút** với model thật~~                        | ✅ **Xong 20/09** — 877 câu, 0 lỗi, độ trễ không trôi, RSS +12 MB                    |
| **Bộ câu giọng người thật** (WER trong điều kiện họp thật) | Đã cắt sẵn 115 đoạn từ bản ghi 8 phút; phần **gõ lời tham chiếu không tự động được** |
| **T9**: báo cáo, video demo, slide                         | Bộ cài macOS xong 15/09, Windows xong 19/09                                          |

> **Số cho báo cáo đã có** — mục 11b, đo trên FLEURS. Con số WER 12,5% / chrF 53,4% của
> chế độ **round-trip qua TTS** không dùng làm kết quả chính (giọng máy sạch nên lạc
> quan hơn thực tế), và giờ cũng không cần tới nữa.
>
> Bộ câu giọng người thật vẫn còn trong danh sách nhưng đổi vai: **không** còn là điều
> kiện để có số báo cáo, mà để trả lời câu hỏi "WER trong cuộc họp thật cao hơn bao
> nhiêu so với giọng đọc chuẩn của FLEURS".

---

## 14. Câu hỏi cần thầy hỗ trợ

1. **Đánh giá đến đâu là đủ?** Quy mô bộ câu kiểm thử, có bắt buộc BLEU/COMET và MOS không?
2. **Nguồn giọng thật:** tự thu / nhờ người quen / dùng Common Voice — thầy khuyên hướng nào?
3. **Máy Windows 11** để đo đối chứng — có mượn được từ khoa/lab không?
4. **Ngưỡng "đạt"** cho độ trễ gần thời gian thực: ~1,8–2,6 s/câu có được xem là đạt?
5. **Demo bảo vệ:** chạy live trong Meet hay video quay sẵn?
6. **Giấy phép NLLB-200 (CC-BY-NC-4.0)** — dùng cho đồ án học thuật cần ghi chú thế nào?
7. **Trọng tâm báo cáo:** nghiêng về kiến trúc hệ thống hay về phần mô hình AI?
8. **Cách trích dẫn TranscriptionSuite** (nguồn tham khảo kiến trúc) cho đúng mực.

→ Thầy đã trả lời nhóm câu này ở buổi họp 19/08: `docs/meetings/bien-ban-hop-GVHD-2026-08-19.md`

Hai câu đã hết hiệu lực từ sau buổi đó: **câu 3** (đã có máy Windows, số đo ở mục 11b) và
**câu 5** (bỏ tích hợp Google Meet ngày 10/09 — demo là dịch và phát ra loa máy, không
đẩy vào cuộc họp).

---

<!-- _paginate: false -->

## Em xin cảm ơn thầy

**Ngô Mạnh Hùng** – 24410300
Mã nguồn, tài liệu tuần và hướng dẫn cài đặt: `docs/00` → `docs/11`
