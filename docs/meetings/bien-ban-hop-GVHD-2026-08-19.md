# Biên bản họp với GVHD — Đề tài khoá luận

**Đề tài:** Xây dựng hệ thống dịch giọng nói đa ngôn ngữ gần thời gian thực bằng mô hình AI chạy cục bộ
**Sinh viên:** Ngô Mạnh Hùng — 24410300
**GVHD:** ThS. Nguyễn Thành Luân
**Ngày họp:** 19/08/2026
**Nội dung:** Trình bày ý tưởng, hiện trạng và nhận hướng dẫn về phương pháp đánh giá

---

## 1. Nội dung sinh viên đã trình bày

### 1.1. Vấn đề

- Họp/học trực tuyến xuyên ngôn ngữ ngày càng phổ biến (Google Meet, Teams, Zoom).
- Các giải pháp dịch giọng nói hiện nay chủ yếu chạy trên cloud, dẫn tới ba hạn chế: phụ thuộc Internet ổn định, phát sinh chi phí theo phút, và toàn bộ nội dung cuộc họp phải rời khỏi máy người dùng (rủi ro riêng tư với họp nội bộ, y tế, pháp lý).
- Câu hỏi của đề tài: một laptop cá nhân hiện nay có đủ sức chạy trọn pipeline dịch giọng nói không, và độ trễ có chấp nhận được để nói chuyện không?

### 1.2. Ý tưởng

Ứng dụng desktop demo cho phép dịch giọng nói hai chiều, toàn bộ xử lý AI chạy local, không gọi API cloud trong lúc phiên dịch.

- **Chiều nghe (incoming):** System Audio → VAD → ASR → MT → Phụ đề song ngữ
- **Chiều nói (outgoing):** Microphone → VAD → ASR → MT → TTS → Microphone ảo → Google Meet
- **Ngôn ngữ:** Việt ↔ Anh / Nhật / Trung (6 chiều)
- **Nền tảng:** Windows 11 x64 / macOS 13+ Apple Silicon

### 1.3. Mô hình sử dụng

| Thành phần | Mô hình                                 | Vai trò                                                             |
| ---------- | --------------------------------------- | ------------------------------------------------------------------- |
| VAD        | Silero VAD                              | Phát hiện giọng nói, xác định câu bắt đầu/kết thúc. Nhẹ, chạy CPU.  |
| ASR        | Whisper large-v3-turbo q5 + whisper.cpp | Speech → text. Đa ngôn ngữ, hỗ trợ Metal/CUDA.                      |
| MT         | NLLB-200 distilled 600M                 | Text → text, đủ 6 chiều dịch trong một model.                       |
| TTS        | sherpa-onnx + Kokoro ONNX               | Text → speech, chạy offline; Kokoro + G2P OpenJTalk cho tiếng Nhật. |

### 1.4. Hiện trạng

Đã hoàn thành T1–T8: khảo sát và dựng khung 2 app; thu mic + system audio kèm Silero VAD; ASR bằng whisper.cpp chạy Metal; MT bằng NLLB-200 kiểm thử đủ 6 chiều; TTS 4 ngôn ngữ (bổ sung Kokoro cho tiếng Nhật); ứng dụng desktop với WebSocket contract có kiểu; hai chiều, PTT/mute, mic ảo, chống loop; bộ công cụ đo (benchmark, tài nguyên, WER/chrF, soak). Bổ sung: lịch sử phiên bằng SQLite, đổi thư mục model, nạp model theo yêu cầu.

**Môi trường phát triển:** MacBook 16GB RAM; backend Python, ứng dụng desktop Electron (React + TypeScript).

---

## 2. Trao đổi và làm rõ

**Về quan hệ với Google Meet.** Thầy hỏi lại: ứng dụng tích hợp _trong_ Google Meet hay chạy song song? Sinh viên xác nhận: đây là một ứng dụng độc lập chạy song song với Google Meet, **không phải extension**. Âm thanh đã dịch được đẩy vào Meet thông qua microphone ảo.

**Về việc tự viết code.** Thầy lưu ý: dù phần backend tự code hay tham khảo/sinh ra từ công cụ, sinh viên vẫn phải nắm được code đang làm gì. Hội đồng chắc chắn sẽ hỏi đã dùng những công nghệ gì để tạo ra hệ thống. Ngoài việc tự thiết kế pipeline, phần demo cũng rất quan trọng.

---

## 3. Kế hoạch đánh giá — nội dung chính thầy giao

Đánh giá được thực hiện trên bộ dữ liệu **FLEURS**: https://huggingface.co/datasets/google/fleurs

Bộ này chứa speech (audio) kèm transcription trên nhiều ngôn ngữ, bao gồm đủ 4 ngôn ngữ của đề tài: **vi, en, zh, ja**.

> **Việc cần làm trước:** kiểm tra lại link dataset cho chính xác, xác nhận bộ dữ liệu có đủ các ngôn ngữ đang cần, và **đánh giá trên tập `test`** (mở Dataset Viewer, chọn split `test`).

### a) Đánh giá chất lượng ASR (speech-to-text)

- Chạy trên **từng ngôn ngữ** riêng biệt (vi, en, zh, ja).
- Dùng audio của FLEURS làm input, transcription có sẵn của FLEURS làm reference.
- **Độ đo: WER** (Word Error Rate).
- Mô hình đánh giá hiện tại: **Whisper large-v3-turbo**.

### b) Đánh giá chất lượng MT (machine translation)

- Chạy trên **từng cặp ngôn ngữ**: {vi↔en}, {vi↔zh}, {vi↔ja} → tổng cộng **6 chiều**, ra một bảng 6 kết quả.
- Dùng phần **text có sẵn** trong FLEURS làm input và reference (không phụ thuộc output của ASR, để tách bạch lỗi của từng khối).
- **Độ đo: BLEU và COMET.**
  - COMET là độ đo dựa trên mô hình, sử dụng **`Unbabel/wmt22-comet-da`**.

### c) Đánh giá độ trễ tổng thể của toàn hệ thống

- Đo end-to-end: **từ khi ASR nhận input speech cho đến khi TTS generate ra translated speech**.
- Bao gồm đủ chuỗi: VAD kích hoạt → Whisper (ASR) → NLLB (MT) → TTS.
- **Hai chỉ số:**
  - **Total Inference Time** — tổng thời gian tạo ra kết quả.
  - **RTF (Real-Time Factor)** — chỉ số độ trễ tương đối.

> **Việc cần làm:** tự tra lại công thức tính RTF và xác định **ngưỡng bao nhiêu thì được coi là hệ thống real-time đạt yêu cầu, bao nhiêu thì không đạt**, rồi báo cáo lại cho thầy.
>
> _(Định nghĩa phổ biến: RTF = thời gian xử lý / thời lượng audio; RTF < 1 nghĩa là xử lý nhanh hơn thời gian thực. Cần kiểm chứng lại và trích nguồn trước khi đưa vào báo cáo.)_

### d) Bổ sung phần đánh giá vào trong ứng dụng

Thầy đề nghị thêm một **màn hình/chế độ đánh giá** ngay trong app:

- Chọn một số câu mẫu có sẵn bản dịch tham chiếu (lấy từ dataset).
- Nói/chạy câu đó qua hệ thống, app tự tính ra độ trễ **và** các độ đo chất lượng (dịch có đúng không), chứ không chỉ chẩn đoán trên mặt thời gian như hiện tại.
- Phần demo chính khi bảo vệ vẫn là phần phiên dịch trực tiếp; đây chỉ là phần đo bổ trợ.

---

## 4. Vấn đề kỹ thuật cần xử lý

### 4.1. Hallucination trên đoạn im lặng

Hiện tượng: ở những đoạn người dùng không nói gì, mô hình vẫn sinh ra text (ví dụ các câu quảng cáo/kênh YouTube).

- **Nguyên nhân thầy giải thích:** training data của Whisper bị bias — các cụm này xuất hiện rất nhiều trong dữ liệu huấn luyện (phụ đề video). Mô hình còn yếu ở các đoạn âm thanh ngắn, và các khoảng "dừng" trong hội thoại thực tế không thực sự im lặng mà còn tiếng động/noise, nên bị nhận nhầm là giọng nói.
- **Hướng xử lý:** thiết kế **timeout cho silence** — khi người dùng dừng nói thì phải dừng thu âm, và định nghĩa rõ khi nào bắt đầu thu lại.
- **Phương án dự phòng:** nếu không fix được, chuyển sang mô hình tương tác kiểu ứng dụng dịch thông thường — nhấn, nói, dừng, rồi mới dịch.
- **Cách trả lời hội đồng** nếu vẫn còn lỗi lúc bảo vệ: giải thích đúng bản chất kỹ thuật như trên, không né tránh.

### 4.2. Cơ chế tách câu khi nói liên tục

Khi người nói nói liên tục, hệ thống không tìm được điểm ngắt câu hợp lý, phải chờ một câu dài khoảng 5–10 giây mới xử lý được. Cần đặt giới hạn rõ ràng: nói tối đa bao lâu, im lặng bao lâu thì chốt câu và bắt đầu dịch.

### 4.3. Cân nhắc về phạm vi Google Meet

Thầy gợi ý **cân nhắc bỏ ràng buộc Google Meet** ra khỏi đề tài, đưa về một ứng dụng dịch giọng nói local thuần tuý. Lý do: kịch bản nói liên tục trong cuộc họp làm lộ rõ hai vấn đề ở mục 4.1 và 4.2, trong khi mô hình "nói — dừng — dịch" ổn định và dễ demo hơn. Nếu giữ được real-time ổn định thì vẫn tốt, nhưng phải đảm bảo không phát sinh lỗi.

_(Đây là gợi ý cần cân nhắc, chưa phải quyết định chốt — phụ thuộc vào việc có xử lý được phần silence detection hay không.)_

---

## 5. Trọng tâm báo cáo và hướng so sánh

- Báo cáo sẽ **mix giữa hai hướng**: xây dựng ứng dụng và xây dựng hệ thống.
- Hiện tại chưa nghiêng hẳn về "xây dựng hệ thống" vì **chưa có đủ dữ liệu so sánh**.
- Nếu còn thời gian: tích hợp thêm nhiều mô hình khác, lập bảng so sánh **chất lượng và độ trễ** giữa các mô hình, đánh giá tất cả trên cùng bộ tiêu chí (a), (b), (c) ở mục 3.
- Từ đó thiết kế **các option cho người dùng khi setup**, ví dụ 3 mức: nhanh/nhẹ ↔ chất lượng cao nhưng tốn tài nguyên hơn.
- **Thứ tự ưu tiên:** chốt cấu hình hiện tại (Whisper large-v3-turbo + NLLB-200), chạy xong phần đánh giá và hoàn thiện demo trước; phần so sánh nhiều mô hình làm sau.
- Lý do cần có so sánh: hội đồng sẽ hỏi "tại sao chọn những mô hình này". Câu trả lời thực tế là các mô hình này đang tốt và không tốn quá nhiều tài nguyên — nhưng nên có số liệu chứng minh.

---

## 6. Giải đáp 6 câu hỏi sinh viên đặt ra

| #   | Câu hỏi                                                | Trả lời của thầy                                                                                                                                                                                                |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Quy mô và chỉ số đánh giá đến đâu là đủ cho khoá luận? | Đã chốt: 3 nhóm chỉ số (a) WER cho ASL, (b) BLEU + COMET cho MT, (c) Total Inference Time + RTF cho toàn hệ thống — trên tập test của FLEURS. Xem mục 3.                                                        |
| 2   | Ngưỡng nào được coi là "đạt" cho gần thời gian thực?   | Dựa vào **RTF**. Sinh viên tự tra công thức và ngưỡng chuẩn, rồi báo cáo lại.                                                                                                                                   |
| 3   | Lấy giọng người thật ở đâu cho hợp lệ?                 | **Không còn cần thiết** — đã có dataset FLEURS với audio người thật, có license rõ ràng.                                                                                                                        |
| 4   | Trọng tâm báo cáo nghiêng về đâu?                      | Mix giữa xây dựng ứng dụng và xây dựng hệ thống. Xem mục 5.                                                                                                                                                     |
| 5   | Có nên so sánh với giải pháp cloud làm đối chứng?      | **Có.** Sẽ tích hợp một baseline cloud ở buổi sau. Ưu tiên chạy xong phần code đánh giá trước; thầy sẽ hướng dẫn phần này sau.                                                                                  |
| 6   | Hình thức demo lúc bảo vệ?                             | Ưu tiên **demo real-time trực tiếp** nếu hệ thống ổn định. Đồng thời **backup sẵn các sample có kịch bản chuẩn bị trước** để kết quả dịch nằm trong dự đoán, tránh bị trừ điểm vì nói ngẫu hứng ra kết quả sai. |

---

## 7. Việc cần làm tiếp

### Ưu tiên 1 — Bộ đánh giá (làm trước, làm xong mới sang phần khác)

- [ ] Kiểm tra lại link FLEURS, xác nhận có đủ vi/en/zh/ja và có split `test`
- [ ] Tự tìm hiểu các thuật ngữ/độ đo mới: WER, BLEU, COMET, RTF — có gì thắc mắc nhắn riêng cho thầy
- [ ] Viết code đánh giá ASR trên từng ngôn ngữ → bảng WER
- [ ] Viết code đánh giá MT trên 6 chiều → bảng BLEU + COMET (`Unbabel/wmt22-comet-da`)
- [ ] Đo end-to-end latency → Total Inference Time + RTF
- [ ] Tra công thức RTF và ngưỡng real-time, **báo cáo lại cho thầy**

### Ưu tiên 2 — Hoàn thiện hệ thống

- [ ] Xử lý hallucination trên đoạn im lặng (silence timeout, ngưỡng VAD)
- [ ] Cải thiện cơ chế tách câu khi người nói nói nhanh/liên tục
- [ ] Quyết định giữ hay bỏ ràng buộc Google Meet
- [ ] Thêm màn hình đánh giá vào trong app (latency + chất lượng trên câu mẫu)
- [ ] Cải thiện chất lượng dịch Nhật → Việt
- [ ] Kiểm tra ứng dụng chạy ổn định trên Windows 11
- [ ] Chạy thật trên Google Meet (nếu giữ hướng này)

### Ưu tiên 3 — Sau khi xong ưu tiên 1 và 2

- [ ] Tích hợp baseline cloud để đối chứng _(thầy hướng dẫn ở buổi sau — **nhắc thầy sau 2 tuần**)_
- [ ] Tích hợp thêm mô hình khác, lập bảng so sánh chất lượng/độ trễ
- [ ] Thiết kế option nhanh–nhẹ / chất lượng cao cho người dùng
- [ ] Báo cáo, đóng gói cài đặt, video demo
- [ ] **Báo cáo thử một lần trước khi bảo vệ** để lấy góp ý và chuẩn bị bộ câu hỏi dự phòng cho hội đồng

### Quy ước làm việc

- Làm xong phần nào thì báo cáo cho thầy — nhắn riêng hoặc nhắn trong group.
- Thắc mắc về thuật ngữ/độ đo: nhắn riêng.
- Tự note lại nội dung buổi họp.

---

## Phụ lục — Thuật ngữ

| Viết tắt | Đầy đủ                                                      | Nghĩa                                                |
| -------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| VAD      | Voice Activity Detection                                    | Phát hiện giọng nói                                  |
| ASR      | Automatic Speech Recognition                                | Nhận dạng giọng nói thành văn bản (speech-to-text)   |
| MT       | Machine Translation                                         | Dịch máy                                             |
| TTS      | Text-to-Speech                                              | Chuyển văn bản thành giọng nói                       |
| WER      | Word Error Rate                                             | Tỉ lệ lỗi từ — độ đo chất lượng ASR                  |
| BLEU     | Bilingual Evaluation Understudy                             | Độ đo chất lượng dịch máy dựa trên trùng khớp n-gram |
| COMET    | Crosslingual Optimized Metric for Evaluation of Translation | Độ đo chất lượng dịch máy dựa trên mô hình neural    |
| RTF      | Real-Time Factor                                            | Tỉ số giữa thời gian xử lý và thời lượng audio       |
| PTT      | Push-to-Talk                                                | Nhấn để nói                                          |
