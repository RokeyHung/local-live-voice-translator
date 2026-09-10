# ĐẠI HỌC QUỐC GIA TP. HỒ CHÍ MINH

## TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN

**CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**
_Độc Lập - Tự Do - Hạnh Phúc_

---

# ĐỀ CƯƠNG CHI TIẾT

**Tên đề tài:** Xây dựng hệ thống dịch giọng nói đa ngôn ngữ gần thời gian thực sử dụng mô hình AI chạy cục bộ

**Tên đề tài (tiếng Anh):** A Near Real-Time Speech Translation System Using Locally Hosted AI Models

**Cán bộ hướng dẫn:** ThS. Nguyễn Thành Luân

**Thời gian thực hiện:** Từ ngày 16/7/2026 đến ngày 23/9/2026

**Sinh viên thực hiện:**

- Ngô Mạnh Hùng – 24410300
  - Hệ đào tạo: Đào tạo từ xa

---

> ## Điều chỉnh phạm vi — 10/09/2026
>
> **Bỏ phần tích hợp Google Meet qua microphone ảo.** Toàn bộ văn bản đề cương bên
> dưới giữ nguyên như đã nộp; mục này ghi lại chỗ đã thay đổi so với kế hoạch ban đầu.
>
> | Đề cương ghi                                                               | Thực tế chốt lại                                                    |
> | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
> | Truyền âm thanh TTS ra VB-CABLE / BlackHole để Google Meet nhận (2.1, 3.4) | **Bỏ.** Bản dịch phát ra loa/tai nghe của người dùng                |
> | Kiểm thử các luồng chính với Google Meet (Nội dung 5)                      | **Bỏ.** Đo trên FLEURS và trên bản ghi thật, không qua phần mềm họp |
> | Thu microphone + system audio, phụ đề song ngữ, sáu chiều dịch             | **Giữ nguyên** — vẫn dịch được cả hai phía của một cuộc gọi         |
>
> **Lý do:** GVHD gợi ý cân nhắc bỏ ràng buộc Google Meet ngay ở buổi họp 19/08/2026
> (biên bản mục 4.3), vì kịch bản nói liên tục trong cuộc họp làm lộ rõ hai vấn đề —
> Whisper bịa chữ trên đoạn im lặng, và không tìm được điểm ngắt câu khi người nói
> không nghỉ. Cả hai đã có mã xử lý nhưng **chưa kiểm chứng được trên giọng người
> thật** trước hạn nộp, nên chốt bỏ thay vì giữ một tính năng chưa chắc ổn định lúc
> bảo vệ. Phân tích đầy đủ, kèm cách bật lại, ở
> [`11_pham-vi-da-bo-google-meet.md`](11_pham-vi-da-bo-google-meet.md).
>
> Phần hiện thực đã làm xong ở Tuần 5 và Tuần 7 vẫn còn trong mã nguồn, chỉ tắt ở lớp
> giao diện — nên đây là **thu hẹp phạm vi nghiệm thu**, không phải một hạng mục bỏ dở.

---

## 1. Nội dung đề tài

Trong bối cảnh làm việc và học tập trực tuyến ngày càng phổ biến, nhu cầu giao tiếp giữa những người sử dụng các ngôn ngữ khác nhau trên các nền tảng hội họp như Google Meet, Microsoft Teams hoặc Zoom ngày càng tăng. Các giải pháp dịch giọng nói hiện nay phần lớn phụ thuộc vào dịch vụ điện toán đám mây, yêu cầu kết nối Internet ổn định và có thể phát sinh các vấn đề về chi phí, độ trễ cũng như quyền riêng tư của nội dung hội thoại.

Đề tài tập trung xây dựng một ứng dụng demo dịch giọng nói gần thời gian thực, hoạt động trực tiếp trên máy tính cá nhân và xử lý dữ liệu bằng các mô hình AI chạy cục bộ. Hệ thống hỗ trợ hai luồng chính:

1. Thu âm thanh đang phát trên máy tính để nhận diện, dịch và hiển thị phụ đề.
2. Thu giọng nói từ microphone, nhận diện và dịch sang ngôn ngữ đích, sau đó tổng hợp thành giọng nói và truyền vào ứng dụng hội họp thông qua thiết bị âm thanh ảo.

Trong phạm vi đồ án, hệ thống tập trung vào một số cặp ngôn ngữ cụ thể gồm tiếng Việt hai chiều với tiếng Anh, tiếng Nhật và tiếng Trung. Khái niệm "gần thời gian thực" được hiểu là hệ thống xử lý theo từng đoạn phát ngôn sau khi phát hiện người nói kết thúc câu hoặc tạm dừng; đề tài không đặt mục tiêu dịch đồng thời theo từng từ khi người dùng vẫn đang nói. Pipeline gồm Voice Activity Detection (VAD), Automatic Speech Recognition (ASR), Machine Translation (MT), Text-to-Speech (TTS) và Audio Routing. Kiến trúc được tham khảo từ TranscriptionSuite [1] và mở rộng thêm module dịch máy, tổng hợp giọng nói và định tuyến âm thanh hai chiều.

Giải pháp dự kiến sử dụng:

- **Silero VAD** để phát hiện đoạn có giọng nói [5]
- **Whisper** thông qua whisper.cpp để nhận diện đa ngôn ngữ [2][3]
- **NLLB-200 distilled 600M** để dịch văn bản [4]
- **sherpa-onnx** để tổng hợp giọng nói offline [6]

Ứng dụng desktop được xây dựng bằng Electron, React và TypeScript; dịch vụ AI cục bộ được phát triển bằng Python, FastAPI và WebSocket. Hệ thống hướng tới hai nền tảng Windows và macOS, trong đó sử dụng WASAPI Loopback trên Windows [7] và ScreenCaptureKit trên macOS [8] để thu âm thanh hệ thống.

---

## 2. Mục tiêu, đối tượng và phạm vi

### 2.1. Mục tiêu nghiên cứu

Mục tiêu tổng quát của đề tài là thiết kế và phát triển một ứng dụng demo dịch giọng nói gần thời gian thực, chạy trên máy tính cá nhân và hỗ trợ giao tiếp hai chiều trong cuộc họp trực tuyến mà không sử dụng dịch vụ cloud trong quá trình phiên dịch.

Các mục tiêu cụ thể gồm:

- Thiết kế và hiện thực pipeline ứng dụng gồm phát hiện giọng nói, nhận diện tiếng nói, dịch máy, tổng hợp tiếng nói và định tuyến âm thanh.
- Xây dựng cơ chế thu đồng thời âm thanh từ microphone và âm thanh đang phát trên máy tính, bảo đảm phân tách hai nguồn và hạn chế vòng lặp âm thanh.
- Tích hợp các mô hình AI chạy local để hỗ trợ sáu chiều dịch: Việt - Anh, Việt - Nhật, Việt - Trung và các chiều ngược lại.
- Xây dựng ứng dụng desktop demo trên Windows và macOS, có giao diện thiết lập thiết bị, điều khiển phiên dịch và hiển thị phụ đề song ngữ.
- Tích hợp giọng nói đã dịch vào Google Meet hoặc ứng dụng tương đương thông qua thiết bị microphone ảo.
- Đánh giá khả năng hoạt động của ứng dụng thông qua độ trễ đầu-cuối, độ chính xác cơ bản của các thành phần và kiểm thử các kịch bản sử dụng chính trên Windows và macOS.

### 2.2. Đối tượng nghiên cứu

- Các mô hình nhận diện giọng nói đa ngôn ngữ, tập trung vào họ mô hình Whisper và runtime whisper.cpp.
- Các mô hình dịch máy đa ngôn ngữ chạy cục bộ, tập trung vào NLLB-200 distilled 600M.
- Các mô hình tổng hợp giọng nói offline và runtime sherpa-onnx.
- Các kỹ thuật Voice Activity Detection, chia đoạn tiếng nói, xử lý audio streaming và giảm vòng lặp âm thanh.
- Các cơ chế thu và định tuyến âm thanh trên Windows và macOS phục vụ ứng dụng hội họp trực tuyến.
- Các chỉ số đánh giá ASR, dịch máy, TTS và hiệu năng của hệ thống dịch giọng nói gần thời gian thực.

### 2.3. Phạm vi nghiên cứu

- **Hệ điều hành:** Windows 11 x64 và macOS 13 trở lên trên Apple Silicon.
- **Ngôn ngữ:** tiếng Việt, tiếng Anh, tiếng Nhật và tiếng Trung giản thể; MVP chỉ bắt buộc hỗ trợ các cặp dịch hai chiều giữa tiếng Việt và ba ngôn ngữ còn lại.
- **Nguồn âm thanh:** microphone vật lý và âm thanh hệ thống từ ứng dụng hội họp trực tuyến.
- **Hình thức đầu ra:** phụ đề song ngữ, âm thanh TTS phát cho người dùng và âm thanh TTS đưa vào microphone ảo.
- Toàn bộ ASR, dịch máy và TTS được xử lý cục bộ sau khi model đã được cài đặt; hệ thống không sử dụng API cloud trong quá trình phiên dịch.
- Đề tài sử dụng driver âm thanh ảo có sẵn như VB-CABLE trên Windows và BlackHole trên macOS, không nghiên cứu phát triển driver âm thanh mới.
- Đề tài không nghiên cứu phương pháp hoặc mô hình AI mới; không đi sâu vào voice cloning, giữ nguyên giọng người nói, speaker diarization, dịch nhiều người nói chồng nhau, ứng dụng mobile/web hoặc tối ưu cho môi trường sản xuất quy mô lớn.

---

## 3. Nội dung và phương pháp dự định nghiên cứu

### Nội dung 1: Khảo sát và thiết kế kiến trúc hệ thống

**Mục tiêu:** Xác định các yêu cầu chức năng, yêu cầu phi chức năng và kiến trúc tổng thể cho ứng dụng dịch giọng nói chạy local.

**Phương pháp:**

- Khảo sát các công trình và phần mềm liên quan đến nhận diện giọng nói, dịch máy, TTS và ứng dụng transcription cục bộ.
- Phân tích kiến trúc Electron frontend kết hợp Python backend của TranscriptionSuite [1] để lựa chọn cách phân tách desktop client và local AI service.
- Thiết kế abstraction layer cho các provider VAD, ASR, MT và TTS nhằm hỗ trợ thay thế model hoặc runtime mà không ảnh hưởng pipeline chính.
- Xây dựng mô hình trạng thái cho mỗi utterance từ lúc phát hiện giọng nói đến khi phát âm thanh đã dịch.

### Nội dung 2: Xây dựng module thu và tiền xử lý âm thanh

**Mục tiêu:** Thu nhận ổn định hai nguồn audio và phân đoạn tiếng nói phù hợp cho xử lý gần thời gian thực.

**Phương pháp:**

- Trên Windows, sử dụng WASAPI để thu microphone và WASAPI Loopback để thu audio đang được phát qua thiết bị output [7].
- Trên macOS, sử dụng CoreAudio cho microphone và ScreenCaptureKit để thu system audio [8].
- Chuẩn hóa audio về PCM mono, sample rate 16 kHz cho ASR; thực hiện resampling, normalization và buffering.
- Tích hợp Silero VAD để phát hiện bắt đầu/kết thúc câu, loại bỏ khoảng lặng và giới hạn độ dài utterance [5].
- Thiết kế cơ chế gắn nhãn nguồn audio, hàng đợi và ngăn âm thanh TTS quay trở lại pipeline ASR.

### Nội dung 3: Xây dựng pipeline AI cục bộ

**Mục tiêu:** Hoàn thiện chuỗi xử lý Speech-to-Text → Machine Translation → Text-to-Speech cho bốn ngôn ngữ.

**Phương pháp:**

- **ASR:** tích hợp Whisper large-v3-turbo dạng quantized thông qua whisper.cpp; chỉ sử dụng tác vụ transcribe để lấy văn bản theo ngôn ngữ nguồn [2][3].
- **Dịch máy:** tích hợp NLLB-200 distilled 600M, ánh xạ mã ngôn ngữ `vie_Latn`, `eng_Latn`, `jpn_Jpan` và `zho_Hans` [4].
- **TTS:** tích hợp sherpa-onnx và lựa chọn ít nhất một voice model cho từng ngôn ngữ mục tiêu [6].
- Xây dựng các preset **Fast**, **Balanced** và **Quality** để khảo sát sự đánh đổi giữa chất lượng, độ trễ và tài nguyên.
- Thiết kế cơ chế timeout, retry, hủy câu, quản lý hàng đợi và giải phóng RAM/VRAM khi kết thúc phiên.

### Nội dung 4: Xây dựng ứng dụng desktop và tích hợp hội họp trực tuyến

**Mục tiêu:** Cung cấp prototype có thể cấu hình và sử dụng trực tiếp trong một phiên họp Google Meet.

**Phương pháp:**

- Xây dựng Electron desktop client bằng React và TypeScript; xây dựng Python local AI service bằng FastAPI.
- Sử dụng REST API cho cấu hình/model/lịch sử và WebSocket cho audio stream, partial transcript, kết quả dịch và trạng thái realtime.
- Phát triển các màn hình: Setup, Session, Subtitle, Model Manager, History và Diagnostics.
- Truyền âm thanh TTS ra VB-CABLE trên Windows hoặc BlackHole trên macOS để Google Meet nhận như microphone.
- Triển khai Push-to-talk làm chế độ mặc định; nghiên cứu bổ sung chế độ VAD tự động và Review before speaking.
- Lưu lịch sử văn bản và metrics vào SQLite; không lưu file âm thanh mặc định.

> **Hình 1.** Kiến trúc tổng quát của hệ thống đề xuất

### Nội dung 5: Thực nghiệm và đánh giá

**Mục tiêu:** Kiểm chứng ứng dụng demo có thể vận hành đúng luồng, đạt độ trễ phù hợp và hoạt động trên hai nền tảng mục tiêu.

**Phương pháp:**

- Tự xây dựng một bộ câu thoại kiểm thử quy mô nhỏ cho các cặp ngôn ngữ trong phạm vi, gồm hội thoại thông thường và một số thuật ngữ kỹ thuật. Bộ dữ liệu này phục vụ kiểm thử ứng dụng, không được xem là bộ dữ liệu nghiên cứu mới.
- Đánh giá ASR bằng WER hoặc CER trên bộ câu thoại kiểm thử và ghi nhận các trường hợp nhận diện sai phổ biến.
- Đánh giá bản dịch chủ yếu bằng kiểm tra thủ công theo tiêu chí đúng nghĩa, đầy đủ và dễ hiểu; chỉ số tự động được sử dụng bổ trợ khi phù hợp.
- Kiểm tra TTS theo khả năng phát âm rõ ràng và mức độ người nghe hiểu được nội dung trong kịch bản demo.
- Đo độ trễ của từng bước và độ trễ đầu-cuối; ghi nhận mức sử dụng CPU, RAM và GPU/VRAM trên các máy thử nghiệm.
- Kiểm thử ứng dụng trên ít nhất một máy Windows và một máy macOS Apple Silicon.
- Kiểm thử các luồng chính với Google Meet, bao gồm thu system audio, dịch từ microphone, phát qua microphone ảo và xử lý vòng lặp âm thanh.

---

## 4. Kết quả mong đợi

- **Về kỹ thuật:** Ứng dụng hỗ trợ thu microphone và system audio, hiển thị phụ đề song ngữ, dịch các cặp ngôn ngữ trong phạm vi và đưa âm thanh TTS vào Google Meet thông qua microphone ảo.
- **Về thực nghiệm:** Một bộ kết quả kiểm thử cơ bản về độ trễ, độ chính xác và khả năng hoạt động của ứng dụng trên Windows và macOS.
- **Về ứng dụng:** Một ứng dụng desktop demo chạy trên Windows và macOS, thực hiện được pipeline dịch giọng nói theo từng đoạn phát ngôn bằng các mô hình AI chạy cục bộ.
- **Về học thuật:** Báo cáo khóa luận hoàn chỉnh, mã nguồn, tài liệu cài đặt, tài liệu cấu hình thiết bị âm thanh ảo và hướng dẫn tái lập thí nghiệm.

---

## 5. Kế hoạch thực hiện

| Thời gian                  | Nội dung công việc dự kiến                                                                                                                                                                                                            | Kết quả mong đợi                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Tuần 1** (16/07 – 22/07) | **Khảo sát và chuẩn bị nền tảng:**<br>• Tổng hợp yêu cầu và nghiên cứu các giải pháp ASR, MT, TTS local.<br>• Thiết lập repository, Electron client, Python service và quy ước giao tiếp.<br>• Chuẩn bị máy thử nghiệm Windows/macOS. | • Tài liệu khảo sát và kiến trúc sơ bộ.<br>• Môi trường phát triển hoạt động trên hai nền tảng. |
| **Tuần 2** (23/07 – 29/07) | **Xây dựng Audio Capture và VAD:**<br>• Thu microphone trên Windows/macOS.<br>• Thu system audio bằng WASAPI Loopback và ScreenCaptureKit.<br>• Chuẩn hóa audio, buffering và tích hợp Silero VAD.                                    | • Hai nguồn audio được thu ổn định.<br>• Utterance được phân đoạn và gắn timestamp.             |
| **Tuần 3** (30/07 – 05/08) | **Xây dựng module ASR:**<br>• Tích hợp whisper.cpp và model Whisper quantized.<br>• Hỗ trợ vi/en/ja/zh và trả kết quả transcript theo từng đoạn phát ngôn.<br>• Kiểm tra độ chính xác và độ trễ cơ bản.                               | • Module ASR local hoạt động cho các ngôn ngữ trong phạm vi.<br>• Có kết quả kiểm thử ban đầu.  |
| **Tuần 4** (06/08 – 12/08) | **Xây dựng module Machine Translation:**<br>• Tích hợp NLLB-200 distilled 600M.<br>• Xây dựng mapping mã ngôn ngữ và normalization.<br>• Kiểm thử sáu chiều dịch.                                                                     | • Module dịch local hoàn chỉnh.<br>• Có bộ câu kiểm thử và kết quả đánh giá thủ công.           |
| **Tuần 5** (13/08 – 19/08) | **Xây dựng module TTS và Audio Output:**<br>• Tích hợp sherpa-onnx và voice model cho bốn ngôn ngữ.<br>• Xây dựng hàng đợi phát, cancel và speed control.<br>• Định tuyến tới VBCABLE/BlackHole.                                      | • TTS offline phát được ra loa và microphone ảo.<br>• Google Meet nhận được âm thanh đã dịch.   |
| **Tuần 6** (20/08 – 26/08) | **Tích hợp ứng dụng desktop:**<br>• Xây dựng màn hình Setup, Session, Subtitle và Diagnostics.<br>• Kết nối REST/WebSocket với AI service.<br>• Hoàn thiện luồng microphone → ASR → dịch → TTS → microphone ảo.                       | • Ứng dụng demo có giao diện và luồng xử lý chính hoạt động.                                    |
| **Tuần 7** (27/08 – 02/09) | **Hoàn thiện dịch hai chiều:**<br>• Kết hợp incoming và outgoing pipeline.<br>• Hoàn thiện Push-to-talk, mute và xử lý hàng đợi.<br>• Kiểm tra audio loopback khi dùng Google Meet.                                                   | • Thực hiện được kịch bản dịch hai chiều gần thời gian thực trong Google Meet.                  |
| **Tuần 8** (03/09 – 09/09) | **Thực nghiệm, tối ưu và đánh giá:**<br>• Đo độ trễ đầu-cuối và tài nguyên sử dụng.<br>• Kiểm tra độ chính xác cơ bản trên bộ câu thoại tự xây dựng.<br>• Kiểm thử trên Windows và macOS, sửa các lỗi chính.                          | • Báo cáo kết quả kiểm thử.<br>• Ứng dụng demo hoạt động ổn định trong các kịch bản chính.      |
| **Tuần 9** (10/09 – 23/09) | **Viết báo cáo và chuẩn bị bảo vệ:**<br>• Hoàn thiện báo cáo, tài liệu cài đặt và hướng dẫn sử dụng.<br>• Đóng gói ứng dụng, quay video demo và thiết kế slide.<br>• Rà soát với cán bộ hướng dẫn.                                    | • Báo cáo khóa luận hoàn chỉnh.<br>• Source code, bộ cài, slide và video demo sẵn sàng.         |

---

## Tài liệu tham khảo

[1] homelab-00. _TranscriptionSuite: A fully local and private Speech-to-Text application._ GitHub repository, 2026. https://github.com/homelab00/TranscriptionSuite.

[2] Radford, A., Kim, J. W., Xu, T., Brockman, G., McLeavey, C., & Sutskever, I. (2023). Robust Speech Recognition via Large-Scale Weak Supervision. _Proceedings of the 40th International Conference on Machine Learning_, 202, 28492–28518.

[3] ggml-org. _whisper.cpp: Port of OpenAI's Whisper model in C/C++._ GitHub repository, 2026. https://github.com/ggml-org/whisper.cpp.

[4] Costa-jussà, M. R., Cross, J., Çelebi, O., Elbayad, M., Heafield, K., Heffernan, K., et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation. _arXiv:2207.04672_.

[5] Silero Team. _Silero VAD: Pre-trained enterprise-grade Voice Activity Detector._ GitHub repository, 2026. https://github.com/snakers4/silero-vad.

[6] k2-fsa. _sherpa-onnx: Speech-to-text, text-to-speech and audio processing with ONNX Runtime._ Documentation and GitHub repository, 2026. https://k2-fsa.github.io/sherpa/onnx/.

[7] Microsoft. _Loopback Recording - Windows Audio Session API (WASAPI)._ Microsoft Learn, 2025.

[8] Apple Inc. _ScreenCaptureKit - Capturing screen content and audio in macOS._ Apple Developer Documentation, 2026.

[9] Papineni, K., Roukos, S., Ward, T., & Zhu, W. J. (2002). BLEU: a Method for Automatic Evaluation of Machine Translation. _Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics_, 311–318.

[10] Rei, R., Stewart, C., Farinha, A. C., & Lavie, A. (2020). COMET: A Neural Framework for MT Evaluation. _Proceedings of EMNLP 2020_, 2685–2702.

[11] International Telecommunication Union. (1996). _ITU-T Recommendation P.800: Methods for Subjective Determination of Transmission Quality._

[12] Meta AI. _NLLB-200 distilled 600M Model Card._ Hugging Face, 2022. License CC-BY-NC-4.0.

---

_TP. HCM, ngày 15 tháng 07 năm 2026_

| Xác nhận của CBHD           | Sinh viên                   |
| --------------------------- | --------------------------- |
| _(Ký tên và ghi rõ họ tên)_ | _(Ký tên và ghi rõ họ tên)_ |
|                             | **Ngô Mạnh Hùng**           |
