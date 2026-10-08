# Từ viết tắt: nghĩa và cách đọc

Giải thích và cách đọc to các từ viết tắt trong
[danh mục từ viết tắt của quyển đồ án](gvhd/khoa-luan.md), cộng thêm những từ có trong
[slide](slides/24410300_NgoManhHung_SlideBaoVe.pdf) và
[kịch bản thuyết trình](13_kich-ban-thuyet-trinh.md) mà danh mục không có. Cột "Trong đồ
án" ghi từ đó dùng vào việc gì trong hệ thống, để trả lời được khi hội đồng hỏi "cái này là
gì".

## Quy ước đọc

Từ viết tắt tiếng Anh đọc theo tên chữ cái tiếng Anh, viết phiên âm gần đúng bằng tiếng Việt
ở bảng dưới: A là "ây", B là "bi", C là "xi", D là "đi", E là "i", F là "ép", G là "gi", L là
"eo", M là "em", N là "en", P là "pi", R là "a", S là "ét", T là "ti", U là "iu", V là "vi",
W là "đắp-bờ-liu", X là "ếch".

Một số từ vốn là một từ có nghĩa (COMET, FLEURS, REST, RAM, LAN) thì đọc liền thành từ,
không đánh vần.

Lần đầu nhắc một khâu trong bài nói, nên nói nghĩa tiếng Việt trước rồi mới nói từ viết tắt,
ví dụ "khâu nhận dạng tiếng nói, tức ASR". Những lần sau dùng từ viết tắt cho gọn. Từ viết
tắt tiếng Việt như GVHD, ĐATN thì đọc đầy đủ: "giảng viên hướng dẫn", "đồ án tốt nghiệp".

## 1. Danh mục từ viết tắt của quyển đồ án

| Viết tắt | Tiếng Anh                                                           | Nghĩa                                                | Cách đọc                                                  | Trong đồ án                                                                                                           |
| -------- | ------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| API      | Application Programming Interface                                   | Giao diện lập trình ứng dụng                         | ây-pi-ai                                                  | Ứng dụng desktop gọi dịch vụ AI qua các API, ví dụ `/api/config` để đọc cấu hình                                      |
| ASR      | Automatic Speech Recognition                                        | Nhận dạng tiếng nói                                  | ây-ét-a                                                   | Khâu thứ hai của chuỗi: Whisper chuyển giọng nói thành văn bản                                                        |
| CER      | Character Error Rate                                                | Tỷ lệ lỗi ký tự                                      | xi-i-a                                                    | Độ đo ASR cho tiếng Trung và tiếng Nhật, vì hai thứ tiếng này không tách từ bằng khoảng trắng                         |
| COMET    | Crosslingual Optimized Metric for Evaluation of Translation         | Độ đo dịch máy dựa trên mô hình neural               | đọc thành từ: "cô-mít" (giống "comet", sao chổi)          | Chấm bản dịch theo nghĩa bằng checkpoint `Unbabel/wmt22-comet-da`. Điểm từ 0 đến 1, không phải phần trăm              |
| FLEURS   | Few-shot Learning Evaluation of Universal Representations of Speech | Bộ dữ liệu giọng đọc đa ngôn ngữ                     | đọc thành từ: "phlơz"                                     | Bộ dữ liệu đánh giá chính, tập test: 3.099 bản thu cho ASR, 2.022 cặp câu cho MT                                      |
| G2P      | Grapheme-to-Phoneme                                                 | Chuyển chữ viết thành âm vị                          | gi-tu-pi (số 2 đọc là "tu", tức "to")                     | Bước trong TTS tiếng Nhật: OpenJTalk chuyển chữ Nhật thành âm vị để Kokoro đọc                                        |
| MT       | Machine Translation                                                 | Dịch máy                                             | em-ti                                                     | Khâu thứ ba: NLLB-200 dịch văn bản sang ngôn ngữ đích                                                                 |
| NLLB     | No Language Left Behind                                             | Họ mô hình dịch máy đa ngôn ngữ của Meta             | en-eo-eo-bi                                               | Mô hình dịch của đồ án. "NLLB-200 distilled 600M" đọc là "en-eo-eo-bi hai trăm, bản distilled sáu trăm triệu tham số" |
| PCM      | Pulse-Code Modulation                                               | Âm thanh số không nén                                | pi-xi-em                                                  | Định dạng âm thanh nội bộ trước khi vào VAD: PCM 16-bit, 16 kHz, một kênh                                             |
| PTT      | Push-to-talk                                                        | Giữ phím để nói                                      | pi-ti-ti; khi thuyết trình nên nói luôn "giữ phím để nói" | Chiều đi chỉ thu micro khi người dùng đang giữ phím                                                                   |
| REST     | Representational State Transfer                                     | Kiểu API theo tài nguyên qua HTTP                    | đọc thành từ: "rét-xt" (giống "rest")                     | Kênh cho các việc không cần thời gian thực: cấu hình, quản lý mô hình, lịch sử                                        |
| RSS      | Resident Set Size                                                   | Bộ nhớ thực tế tiến trình đang chiếm                 | a-ét-ét                                                   | Số đo bộ nhớ trong bài chạy 60 phút: từ 1.110 lên 1.122 MB                                                            |
| RTF      | Real-Time Factor                                                    | Hệ số thời gian thực                                 | a-ti-ép                                                   | Thời gian xử lý chia thời lượng âm thanh. Tối thiểu p90 dưới 1, mục tiêu p90 không quá 0,5                            |
| spBLEU   | SentencePiece BLEU                                                  | BLEU tính trên cách tách từ SentencePiece dùng chung | ét-pi-blu ("BLEU" đọc như "blue")                         | Độ đo dịch máy theo độ trùng chuỗi; tách từ bằng SentencePiece để dùng được cho cả tiếng Trung, tiếng Nhật            |
| TTS      | Text-to-Speech                                                      | Tổng hợp tiếng nói                                   | ti-ti-ét                                                  | Khâu cuối: sherpa-onnx (vi, en, zh) hoặc Kokoro (ja) đọc bản dịch thành tiếng                                         |
| VAD      | Voice Activity Detection                                            | Phát hiện đoạn có giọng nói                          | vi-ây-đi                                                  | Khâu đầu: Silero VAD tách dòng âm thanh thành từng câu                                                                |
| WER      | Word Error Rate                                                     | Tỷ lệ lỗi từ                                         | đắp-bờ-liu-i-a; nhiều người đọc gọn là "uơ"               | Độ đo ASR cho tiếng Việt và tiếng Anh: số từ sai chia số từ của câu tham chiếu                                        |
| WS       | WebSocket                                                           | Kênh truyền hai chiều liên tục                       | không đọc tắt, nói cả từ "WebSocket": "oép-sóc-kít"       | Kênh `/ws` truyền âm thanh lên dịch vụ và đẩy kết quả nhận dạng, bản dịch, giọng đọc về ứng dụng                      |

## 2. Có trong slide nhưng không có trong danh mục

Những từ này không cần đưa vào quyển đồ án, nhưng sẽ phải đọc to khi thuyết trình hoặc trả lời.

| Viết tắt, ký hiệu | Đầy đủ                                   | Cách đọc                                    | Trong đồ án                                                         |
| ----------------- | ---------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| GVHD              | Giảng viên hướng dẫn                     | đọc đầy đủ: "giảng viên hướng dẫn", "thầy"  | Slide 11 và 44                                                      |
| CPU               | Central Processing Unit                  | xi-pi-iu                                    | TTS và VAD chạy CPU                                                 |
| GPU               | Graphics Processing Unit                 | gi-pi-iu                                    | ASR và MT chạy GPU trên máy Windows                                 |
| RAM               | Random Access Memory                     | đọc thành từ: "ram"                         | Mô hình chiếm khoảng 2 GB RAM                                       |
| LAN               | Local Area Network                       | đọc thành từ: "lan"                         | Dịch vụ chỉ lắng nghe trên 127.0.0.1, không mở ra mạng LAN          |
| CUDA              | Compute Unified Device Architecture      | đọc thành từ: "cu-đa"                       | Nền tính toán GPU của NVIDIA; NLLB và faster-whisper chạy trên CUDA |
| MPS               | Metal Performance Shaders                | em-pi-ét                                    | NLLB chạy trên GPU của máy Mac qua MPS                              |
| MLX               | (tên framework của Apple)                | em-eo-ếch                                   | Runtime ASR trên Apple Silicon                                      |
| ONNX              | Open Neural Network Exchange             | đọc thành từ: "o-níc"                       | Định dạng mô hình mà sherpa-onnx và Kokoro dùng để chạy offline     |
| WASAPI            | Windows Audio Session API                | đọc thành từ: "oa-sa-pi"                    | API Windows dùng để thu âm thanh hệ thống (loopback)                |
| OBS               | Open Broadcaster Software                | ô-bi-ét                                     | LocalVocal là một plugin của OBS (slide 5)                          |
| JSON              | JavaScript Object Notation               | đọc thành từ: "giây-xơn"                    | Kết quả đo gốc được lưu thành tệp JSON                              |
| p90               | Percentile 90                            | "phân vị 90" lần đầu, sau đó "pi chín mươi" | 90% số câu nhanh hơn mức này                                        |
| fp16              | Floating Point 16-bit                    | ép-pi mười sáu                              | Bản mô hình số thực 16 bit của faster-whisper                       |
| q5_0              | Quantized 5-bit (biến thể 0)             | "kiu năm không", hoặc "lượng tử hóa 5 bit"  | Bản whisper.cpp đã lượng tử hóa, dùng ở preset Cân bằng             |
| chrF++            | Character F-score (kèm n-gram từ)        | xi-ếch-a-ép cộng cộng                       | Độ đo dịch máy theo ký tự, đi kèm spBLEU                            |
| ms, kHz, MB, GB   | mili giây, kilohertz, megabyte, gigabyte | mi-li-giây, ki-lô-héc, mê-ga-bai, gi-ga-bai | Đơn vị trong các bảng kết quả                                       |

## 3. Tên riêng hay phải đọc to

Không phải từ viết tắt, nhưng xuất hiện liên tục trong bài nói.

| Tên            | Cách đọc                                     | Là gì                                                   |
| -------------- | -------------------------------------------- | ------------------------------------------------------- |
| Whisper        | "uýt-xpơ"                                    | Mô hình nhận dạng tiếng nói của OpenAI                  |
| whisper.cpp    | "uýt-xpơ xi-pi-pi"                           | Bản cài đặt Whisper bằng C++, chạy được Vulkan và Metal |
| faster-whisper | "phát-xtơ uýt-xpơ"                           | Runtime Whisper dựa trên CTranslate2, chạy CUDA         |
| Silero         | "xi-le-rô"                                   | Mô hình VAD                                             |
| sherpa-onnx    | "sơ-pa o-níc"                                | Thư viện TTS chạy offline                               |
| Kokoro         | "cô-cô-rô" (tiếng Nhật, nghĩa là "trái tim") | Mô hình TTS dùng cho tiếng Nhật                         |
| OpenJTalk      | "âu-pần giây tóc"                            | Bộ chuyển chữ Nhật thành âm vị (G2P)                    |
| Vulkan         | "vôn-căn"                                    | API đồ họa có sẵn trong driver NVIDIA, AMD, Intel       |
| Metal          | "mé-tồ"                                      | API GPU của Apple                                       |
| Electron       | "i-léc-trôn"                                 | Nền tảng ứng dụng desktop của phần giao diện            |
| FastAPI        | "phát ây-pi-ai"                              | Framework Python của dịch vụ AI                         |
| SeamlessM4T    | "xim-lợt em-pho-ti"                          | Mô hình dịch giọng nói đầu cuối của Meta (slide 5, 39)  |
