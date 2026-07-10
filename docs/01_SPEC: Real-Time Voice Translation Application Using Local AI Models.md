# SPEC: Ứng dụng dịch giọng nói trực tiếp bằng mô hình Local AI

**Tên tạm thời:** Local Live Voice Translator
**Phiên bản:** 1.0
**Ngày tạo:** 10/07/2026
**Loại sản phẩm:** Desktop Application
**Mục đích:** Đồ án nghiên cứu và xây dựng hệ thống dịch giọng nói gần thời gian thực, hoạt động hoàn toàn trên máy tính người dùng.

---

## 1. Tổng quan

Ứng dụng cho phép người dùng giao tiếp đa ngôn ngữ trong các cuộc họp trực tuyến như Google Meet, Microsoft Teams, Zoom hoặc Discord.

Hệ thống sẽ xử lý hai nguồn âm thanh:

1. **Âm thanh từ máy tính**

   Ví dụ: giọng nói của người khác trong Google Meet.

   Hệ thống sẽ:
   - Thu âm thanh đang phát trên máy tính.
   - Chuyển giọng nói thành văn bản.
   - Dịch sang ngôn ngữ người dùng lựa chọn.
   - Hiển thị phụ đề hoặc phát lại bằng giọng nói đã dịch.

2. **Âm thanh từ microphone**

   Ví dụ: người dùng nói tiếng Việt và muốn người trong Google Meet nghe bằng tiếng Nhật.

   Hệ thống sẽ:
   - Thu giọng nói từ microphone.
   - Chuyển giọng nói thành văn bản.
   - Dịch sang ngôn ngữ đích.
   - Tổng hợp thành giọng nói.
   - Truyền âm thanh đã dịch vào Google Meet thông qua microphone ảo.

Toàn bộ quá trình nhận diện giọng nói, dịch thuật và tổng hợp giọng nói phải được xử lý trên máy tính người dùng, không gửi dữ liệu âm thanh hoặc nội dung hội thoại lên server bên ngoài.

---

## 2. Mục tiêu

### 2.1. Mục tiêu chính

Xây dựng một ứng dụng desktop có khả năng:

- Nhận diện giọng nói gần thời gian thực.
- Dịch giọng nói giữa nhiều ngôn ngữ.
- Hiển thị phụ đề song ngữ.
- Chuyển nội dung đã dịch thành giọng nói.
- Truyền giọng nói đã dịch vào phần mềm họp trực tuyến.
- Hoạt động offline sau khi đã cài đặt đầy đủ model.
- Bảo vệ quyền riêng tư bằng cách xử lý dữ liệu hoàn toàn local.

### 2.2. Ngôn ngữ hỗ trợ trong MVP

MVP hỗ trợ sáu chiều dịch:

| Ngôn ngữ nguồn | Ngôn ngữ đích |
| -------------- | ------------- |
| Tiếng Việt     | Tiếng Anh     |
| Tiếng Việt     | Tiếng Nhật    |
| Tiếng Việt     | Tiếng Trung   |
| Tiếng Anh      | Tiếng Việt    |
| Tiếng Nhật     | Tiếng Việt    |
| Tiếng Trung    | Tiếng Việt    |

Quy ước:

- Tiếng Anh: `en-US`
- Tiếng Nhật: `ja-JP`
- Tiếng Trung: `zh-CN`, tiếng Trung phổ thông, chữ giản thể
- Tiếng Việt: `vi-VN`

Dịch trực tiếp giữa Anh, Nhật và Trung không nằm trong phạm vi MVP.

---

## 3. Phạm vi hệ thống

### 3.1. Trong phạm vi MVP

- Ứng dụng chạy trên máy tính.
- Thu âm thanh từ microphone vật lý.
- Thu âm thanh đang phát trên máy tính.
- Nhận diện giọng nói bằng model local.
- Dịch văn bản bằng model local.
- Tổng hợp giọng nói bằng model local.
- Hiển thị nội dung gốc và nội dung đã dịch.
- Phát giọng nói đã dịch ra tai nghe hoặc loa.
- Truyền giọng nói đã dịch vào Google Meet thông qua thiết bị âm thanh ảo.
- Chọn ngôn ngữ nguồn và ngôn ngữ đích.
- Lưu lịch sử bản dịch dưới dạng văn bản.
- Chạy offline sau khi model đã được tải hoặc cài đặt.
- Cho phép lựa chọn model hoặc chế độ hiệu năng.

### 3.2. Ngoài phạm vi MVP

- Ứng dụng mobile.
- Ứng dụng web.
- Dịch cuộc gọi điện thoại.
- Dịch trực tiếp giữa mọi cặp ngôn ngữ.
- Nhận diện chính xác từng người nói.
- Giữ nguyên giọng nói của người dùng sau khi dịch.
- Voice cloning.
- Phân tích cảm xúc.
- Dịch đồng thời từng từ khi người dùng vẫn đang nói.
- Đồng bộ lịch sử lên cloud.
- Tự phát triển audio driver hoặc virtual microphone driver.
- Loại bỏ hoàn toàn tiếng vọng khi sử dụng loa ngoài.
- Hỗ trợ nhiều người nói chồng âm cùng lúc.

---

## 4. Đối tượng sử dụng

### 4.1. Người dùng chính

- Người tham gia cuộc họp với người nước ngoài.
- Người học ngoại ngữ.
- Nhân viên làm việc trong nhóm đa quốc gia.
- Người tham gia phỏng vấn hoặc trao đổi trực tuyến.
- Người có nhu cầu giao tiếp nhưng không thành thạo ngôn ngữ đối phương.

### 4.2. Môi trường sử dụng

- Google Meet.
- Microsoft Teams.
- Zoom.
- Discord.
- Các ứng dụng có thể lựa chọn thiết bị microphone và speaker.

---

## 5. Các chế độ hoạt động

### 5.1. Chế độ Listen

Dùng để nghe và dịch giọng nói của người khác.

Ví dụ:

> Người trong Google Meet nói tiếng Nhật, người dùng đọc phụ đề tiếng Việt.

Luồng xử lý:

```text
Google Meet Audio
    ↓
System Audio Capture
    ↓
Voice Activity Detection
    ↓
Speech-to-Text
    ↓
Japanese Text
    ↓
Translation
    ↓
Vietnamese Text
    ↓
Subtitle hoặc Text-to-Speech
```

Đầu ra:

- Phụ đề ngôn ngữ gốc.
- Phụ đề ngôn ngữ đã dịch.
- Giọng nói đã dịch phát tại máy người dùng, tùy chọn.

### 5.2. Chế độ Speak

Dùng để dịch giọng nói của người dùng và truyền vào cuộc họp.

Ví dụ:

> Người dùng nói tiếng Việt, người trong Google Meet nghe bằng tiếng Anh.

Luồng xử lý:

```text
Physical Microphone
    ↓
Voice Activity Detection
    ↓
Speech-to-Text
    ↓
Vietnamese Text
    ↓
Translation
    ↓
English Text
    ↓
Text-to-Speech
    ↓
Virtual Microphone
    ↓
Google Meet
```

### 5.3. Chế độ Two-way Conversation

Listen Mode và Speak Mode hoạt động đồng thời.

Ví dụ:

- Người trong cuộc họp nói tiếng Nhật.
- Người dùng nhận phụ đề tiếng Việt.
- Người dùng trả lời bằng tiếng Việt.
- Người trong cuộc họp nghe giọng nói tiếng Nhật.

Hai pipeline âm thanh phải được xử lý độc lập để tránh âm thanh đầu ra bị đưa ngược trở lại hệ thống nhận diện.

---

## 6. Luồng sử dụng chính

### 6.1. Thiết lập ban đầu

1. Người dùng mở ứng dụng.
2. Hệ thống kiểm tra model đã được cài đặt hay chưa.
3. Người dùng chọn:
   - Microphone vật lý.
   - Nguồn âm thanh từ máy tính.
   - Speaker hoặc tai nghe.
   - Virtual microphone.

4. Người dùng kiểm tra thử âm thanh.
5. Người dùng mở Google Meet.
6. Trong Google Meet, người dùng chọn virtual microphone làm microphone đầu vào.
7. Người dùng bắt đầu phiên dịch.

### 6.2. Bắt đầu phiên dịch

1. Chọn chế độ hoạt động.
2. Chọn ngôn ngữ nguồn.
3. Chọn ngôn ngữ đích.
4. Chọn chế độ gửi giọng nói:
   - Push-to-talk.
   - Tự động nhận diện.

5. Nhấn `Start Translation`.
6. Hệ thống bắt đầu thu và xử lý âm thanh.

### 6.3. Kết thúc phiên

1. Người dùng nhấn `Stop`.
2. Hệ thống dừng thu âm.
3. Hàng đợi TTS được xóa hoặc phát hết theo cấu hình.
4. Người dùng có thể:
   - Xem lịch sử hội thoại.
   - Xuất file văn bản.
   - Xóa toàn bộ dữ liệu phiên.

---

## 7. Yêu cầu chức năng

### 7.1. Quản lý thiết bị âm thanh

| ID     | Yêu cầu                                        | Ưu tiên |
| ------ | ---------------------------------------------- | ------- |
| AUD-01 | Hiển thị danh sách microphone khả dụng         | P0      |
| AUD-02 | Hiển thị danh sách thiết bị phát âm thanh      | P0      |
| AUD-03 | Cho phép chọn nguồn system audio               | P0      |
| AUD-04 | Cho phép chọn virtual microphone               | P0      |
| AUD-05 | Hiển thị mức âm lượng theo thời gian thực      | P0      |
| AUD-06 | Cho phép kiểm tra microphone trước khi bắt đầu | P0      |
| AUD-07 | Thông báo khi thiết bị bị ngắt kết nối         | P0      |
| AUD-08 | Tự kết nối lại thiết bị khi có thể             | P1      |
| AUD-09 | Điều chỉnh input gain và output volume         | P1      |

### 7.2. Nhận diện giọng nói

| ID     | Yêu cầu                                              | Ưu tiên |
| ------ | ---------------------------------------------------- | ------- |
| ASR-01 | Chuyển giọng nói thành văn bản bằng model local      | P0      |
| ASR-02 | Hỗ trợ Việt, Anh, Nhật và Trung                      | P0      |
| ASR-03 | Hiển thị kết quả tạm thời khi người dùng đang nói    | P1      |
| ASR-04 | Trả về kết quả hoàn chỉnh khi người dùng dừng nói    | P0      |
| ASR-05 | Hiển thị độ tin cậy nếu model hỗ trợ                 | P1      |
| ASR-06 | Cho phép cấu hình ngôn ngữ đầu vào                   | P0      |
| ASR-07 | Tự động phát hiện ngôn ngữ trong bốn ngôn ngữ hỗ trợ | P2      |
| ASR-08 | Tự thêm dấu câu cơ bản                               | P1      |

### 7.3. Phát hiện giọng nói

Hệ thống phải sử dụng Voice Activity Detection để:

- Phát hiện thời điểm người dùng bắt đầu nói.
- Phát hiện khi người dùng dừng nói.
- Không gửi đoạn im lặng vào model ASR.
- Chia âm thanh thành các câu hoặc đoạn có độ dài phù hợp.
- Tránh kích hoạt bởi tiếng ồn nhỏ.

Các tham số cần cấu hình:

- Ngưỡng âm lượng.
- Thời gian im lặng để kết thúc câu.
- Thời lượng câu tối thiểu.
- Thời lượng câu tối đa.
- Khoảng âm thanh được giữ lại trước khi phát hiện giọng nói.

### 7.4. Dịch văn bản

| ID    | Yêu cầu                                                  | Ưu tiên |
| ----- | -------------------------------------------------------- | ------- |
| MT-01 | Dịch văn bản bằng model chạy local                       | P0      |
| MT-02 | Hỗ trợ sáu chiều dịch trong phạm vi MVP                  | P0      |
| MT-03 | Giữ nguyên tên người, mã nguồn, URL và con số khi có thể | P1      |
| MT-04 | Cho phép cấu hình từ điển riêng                          | P2      |
| MT-05 | Cho phép sửa nội dung dịch trước khi phát                | P1      |
| MT-06 | Hiển thị thời gian xử lý mỗi câu                         | P1      |
| MT-07 | Không dịch lại các kết quả ASR tạm thời đã bị thay thế   | P0      |

### 7.5. Tổng hợp giọng nói

| ID     | Yêu cầu                                                 | Ưu tiên |
| ------ | ------------------------------------------------------- | ------- |
| TTS-01 | Chuyển văn bản đã dịch thành giọng nói bằng model local | P0      |
| TTS-02 | Có ít nhất một giọng đọc cho mỗi ngôn ngữ               | P0      |
| TTS-03 | Cho phép điều chỉnh tốc độ nói                          | P1      |
| TTS-04 | Cho phép điều chỉnh âm lượng                            | P1      |
| TTS-05 | Cho phép nghe thử giọng đọc                             | P1      |
| TTS-06 | Phát âm thanh theo đúng thứ tự câu                      | P0      |
| TTS-07 | Cho phép hủy câu đang chờ phát                          | P0      |
| TTS-08 | Không phát các câu ASR có độ tin cậy quá thấp           | P1      |

### 7.6. Virtual microphone

Hệ thống phải đưa âm thanh TTS đến một thiết bị microphone ảo để Google Meet có thể nhận giọng nói đã dịch.

Trong MVP, có thể sử dụng một giải pháp virtual audio có sẵn trên hệ điều hành.

Hệ thống phải:

- Phát hiện virtual audio device.
- Hướng dẫn người dùng cấu hình thiết bị.
- Gửi âm thanh TTS đến đúng virtual device.
- Không gửi âm thanh TTS trở lại pipeline ASR.
- Cho phép truyền âm thanh gốc từ microphone cùng với âm thanh đã dịch, tùy chọn.
- Hiển thị trạng thái đang phát âm thanh vào cuộc họp.

### 7.7. Push-to-talk

Push-to-talk là chế độ mặc định của Speak Mode trong MVP.

Quy trình:

1. Người dùng giữ phím tắt.
2. Hệ thống bắt đầu ghi microphone.
3. Người dùng thả phím.
4. Hệ thống hoàn tất ASR và dịch.
5. Nội dung dịch được chuyển thành giọng nói.
6. Giọng nói được phát vào virtual microphone.

Ứng dụng phải cho phép cấu hình phím tắt toàn cục.

Ví dụ:

- `Ctrl + Space`
- `Option + Space`
- Phím chuột phụ

### 7.8. Chế độ tự động

Trong chế độ tự động:

- VAD tự phát hiện câu nói.
- Hệ thống tự dịch khi câu kết thúc.
- Nội dung được phát vào cuộc họp mà không cần nhấn phím.
- Người dùng có thể tạm dừng bằng nút mute.
- Hệ thống phải có thời gian đếm ngược ngắn trước khi gửi, nếu chức năng xác nhận được bật.

### 7.9. Phụ đề trực tiếp

Màn hình phụ đề phải hiển thị:

- Nội dung ngôn ngữ gốc.
- Nội dung đã dịch.
- Nguồn âm thanh:
  - `Remote`
  - `Me`

- Thời gian phát hiện.
- Trạng thái:
  - Listening
  - Recognizing
  - Translating
  - Speaking
  - Completed
  - Failed

Nội dung tạm thời phải được phân biệt với nội dung đã xác nhận.

### 7.10. Chỉnh sửa trước khi gửi

Ứng dụng có tùy chọn `Review before speaking`.

Khi bật:

1. Người dùng nói.
2. Hệ thống nhận diện và dịch.
3. Nội dung dịch hiển thị trong ô chỉnh sửa.
4. Người dùng sửa nội dung nếu cần.
5. Nhấn `Send`.
6. TTS được tạo và gửi vào cuộc họp.

Chế độ này phù hợp khi độ chính xác quan trọng hơn tốc độ.

### 7.11. Lịch sử hội thoại

Ứng dụng lưu các thông tin:

- Thời gian.
- Nguồn âm thanh.
- Ngôn ngữ nguồn.
- Ngôn ngữ đích.
- Nội dung nhận diện.
- Nội dung dịch.
- Thời gian xử lý ASR.
- Thời gian xử lý dịch.
- Thời gian xử lý TTS.
- Trạng thái thành công hoặc thất bại.

Mặc định không lưu file âm thanh.

Người dùng có thể:

- Xóa từng dòng.
- Xóa toàn bộ phiên.
- Xuất file `.txt`.
- Xuất file `.json`.
- Xuất file `.srt` trong giai đoạn mở rộng.

---

## 8. Giao diện

### 8.1. Màn hình Setup

Hiển thị:

- Microphone input.
- System audio input.
- Speaker hoặc headphone output.
- Virtual microphone output.
- Nút kiểm tra từng thiết bị.
- Trạng thái model.
- Trạng thái GPU hoặc CPU.
- Cảnh báo cấu hình sai.

### 8.2. Màn hình chính

```text
┌──────────────────────────────────────────────────────────┐
│ Local Live Voice Translator                              │
├──────────────────────────────────────────────────────────┤
│ Mode: Two-way                                            │
│ Remote: Japanese → Vietnamese                            │
│ Me: Vietnamese → Japanese                                │
├──────────────────────────────────────────────────────────┤
│ REMOTE                                                   │
│ Original: 本日の会議を始めます。                           │
│ Translated: Chúng ta sẽ bắt đầu cuộc họp hôm nay.        │
├──────────────────────────────────────────────────────────┤
│ ME                                                       │
│ Original: Tôi đã hoàn thành phần triển khai.             │
│ Translated: 実装部分は完了しました。                        │
│ [Edit] [Speak] [Cancel]                                  │
├──────────────────────────────────────────────────────────┤
│ Mic: ● Active        Virtual Mic: ● Connected            │
│ ASR: 620ms  MT: 350ms  TTS: 480ms                       │
├──────────────────────────────────────────────────────────┤
│ [Start] [Stop] [Mute] [Push to Talk] [Settings]          │
└──────────────────────────────────────────────────────────┘
```

### 8.3. Màn hình Model Manager

Cho phép:

- Xem danh sách model đã cài đặt.
- Xem dung lượng model.
- Chọn model mặc định.
- Import model từ thư mục local.
- Xóa model.
- Kiểm tra tính hợp lệ của model.
- Chọn mức chất lượng:
  - Fast
  - Balanced
  - Quality

### 8.4. Màn hình Diagnostics

Hiển thị:

- Sample rate.
- Audio buffer size.
- Input latency.
- ASR latency.
- Translation latency.
- TTS latency.
- Tổng latency.
- CPU usage.
- RAM usage.
- GPU usage.
- VRAM usage.
- Số audio frame bị mất.
- Lỗi thiết bị âm thanh.

---

## 9. Kiến trúc hệ thống

### 9.1. Kiến trúc tổng quan

```text
┌──────────────────────────────────────────────────────────┐
│                    Desktop Application                   │
├──────────────────────────────────────────────────────────┤
│ UI Layer                                                 │
│ - Session controls                                       │
│ - Subtitle                                               │
│ - Device settings                                        │
│ - Model settings                                         │
├──────────────────────────────────────────────────────────┤
│ Session Manager                                          │
│ - Pipeline state                                         │
│ - Language configuration                                 │
│ - History                                                │
├───────────────────┬──────────────────────────────────────┤
│ Incoming Pipeline │ Outgoing Pipeline                    │
│                   │                                      │
│ System Audio      │ Physical Microphone                  │
│      ↓             │      ↓                               │
│ Preprocessing     │ Preprocessing                        │
│      ↓             │      ↓                               │
│ VAD               │ VAD                                  │
│      ↓             │      ↓                               │
│ ASR               │ ASR                                  │
│      ↓             │      ↓                               │
│ Translation       │ Translation                          │
│      ↓             │      ↓                               │
│ Subtitle / TTS    │ TTS                                  │
│      ↓             │      ↓                               │
│ Headphones        │ Virtual Microphone                   │
└───────────────────┴──────────────────────────────────────┘
```

### 9.2. Các module chính

#### Audio Capture Module

Trách nhiệm:

- Thu microphone.
- Thu system audio.
- Chuẩn hóa sample rate.
- Chuyển audio về mono khi cần.
- Chia audio thành các frame.
- Gắn nhãn nguồn audio.
- Phát hiện thiết bị bị mất kết nối.

Định dạng nội bộ đề xuất:

```text
PCM 16-bit
16.000 Hz
Mono
Frame size: 20–100 ms
```

Model cụ thể có thể yêu cầu sample rate khác; Audio Capture Module phải tự chuyển đổi định dạng.

#### Audio Preprocessing Module

Bao gồm:

- Noise suppression.
- Automatic gain control.
- High-pass filter.
- Echo cancellation nếu được hỗ trợ.
- Resampling.
- Normalization.

#### Voice Activity Detection Module

Trách nhiệm:

- Phân biệt giọng nói và khoảng lặng.
- Gom các audio frame thành một utterance.
- Phát sự kiện bắt đầu và kết thúc câu.
- Ngắt câu nếu vượt quá thời lượng tối đa.

#### Speech-to-Text Module

Interface đề xuất:

```text
initialize(modelConfig)
startStream(language)
pushAudio(audioChunk)
finishUtterance()
onPartialTranscript(callback)
onFinalTranscript(callback)
dispose()
```

Kết quả ASR:

```json
{
  "utteranceId": "uuid",
  "language": "vi",
  "text": "Tôi đã hoàn thành công việc",
  "isFinal": true,
  "confidence": 0.91,
  "processingTimeMs": 640
}
```

#### Translation Module

Interface đề xuất:

```text
initialize(modelConfig)
translate(text, sourceLanguage, targetLanguage)
dispose()
```

Kết quả:

```json
{
  "utteranceId": "uuid",
  "sourceLanguage": "vi",
  "targetLanguage": "ja",
  "sourceText": "Tôi đã hoàn thành công việc",
  "translatedText": "作業は完了しました。",
  "processingTimeMs": 380
}
```

#### Text-to-Speech Module

Interface đề xuất:

```text
initialize(voiceConfig)
synthesize(text, language, voice)
cancel(requestId)
dispose()
```

Kết quả:

```json
{
  "requestId": "uuid",
  "audioFormat": "pcm_s16le",
  "sampleRate": 24000,
  "durationMs": 2100,
  "processingTimeMs": 520
}
```

#### Audio Output Router

Trách nhiệm:

- Phát translated audio ra tai nghe.
- Phát translated audio vào virtual microphone.
- Quản lý hàng đợi audio.
- Không để các câu nói chồng lên nhau.
- Hủy audio đang chờ.
- Gửi sự kiện khi bắt đầu và kết thúc phát.

#### Model Manager

Trách nhiệm:

- Load và unload model.
- Kiểm tra tài nguyên máy.
- Chọn CPU hoặc GPU.
- Quản lý model đã cài đặt.
- Không load đồng thời model không cần thiết.
- Giải phóng RAM và VRAM khi kết thúc phiên.

---

## 10. Kiến trúc triển khai đề xuất

Đối với đồ án, có thể sử dụng kiến trúc hai process:

### Desktop Client

Có thể sử dụng Flutter Desktop để xây dựng:

- Giao diện.
- Quản lý trạng thái.
- Cấu hình thiết bị.
- Hiển thị phụ đề.
- Lịch sử hội thoại.
- Điều khiển session.

### Local AI Service

Một process local riêng đảm nhiệm:

- VAD.
- ASR.
- Machine Translation.
- TTS.
- Quản lý model.
- Theo dõi hiệu năng.

Desktop Client và AI Service giao tiếp qua:

- WebSocket trên `127.0.0.1`.
- Local socket.
- gRPC.
- Standard input/output trong bản prototype đơn giản.

Service chỉ được lắng nghe trên localhost và không được mở truy cập từ mạng bên ngoài.

### Audio Integration Layer

Audio Integration Layer xử lý các API đặc thù của hệ điều hành:

- Thu microphone.
- Thu loopback audio.
- Phát âm thanh đến virtual device.
- Theo dõi thay đổi thiết bị.

Phần này có thể được triển khai bằng native code hoặc thư viện audio đa nền tảng.

---

## 11. Quản lý trạng thái pipeline

Mỗi pipeline có các trạng thái:

```text
Idle
Initializing
Listening
SpeechDetected
Recognizing
Translating
WaitingForConfirmation
Synthesizing
Queued
Speaking
Completed
Error
Stopped
```

Ứng dụng không được xử lý hai lần cùng một utterance.

Mỗi utterance phải có ID duy nhất để theo dõi xuyên suốt các bước:

```text
Audio → ASR → Translation → TTS → Audio Output
```

---

## 12. Kiểm soát vòng lặp âm thanh

Đây là yêu cầu quan trọng nhất khi hệ thống chạy cùng Google Meet.

Hệ thống phải tách biệt:

- Microphone vật lý.
- Âm thanh từ Google Meet.
- Giọng nói TTS được gửi vào virtual microphone.
- Giọng nói TTS phát cho người dùng.

Các biện pháp:

1. Không capture virtual microphone làm nguồn system audio.
2. Không đưa TTS output trở lại ASR input.
3. Gắn nhãn cho mọi audio stream.
4. Tạm dừng ASR tương ứng khi hệ thống đang phát TTS, nếu cần.
5. Khuyến nghị sử dụng tai nghe.
6. Cảnh báo người dùng khi phát hiện output device và input device có nguy cơ tạo vòng lặp.
7. Không bật microphone vật lý trực tiếp trong Google Meet khi đang sử dụng virtual microphone.

---

## 13. Xử lý hội thoại chồng âm

Trong MVP:

- Incoming và outgoing pipeline có thể chạy đồng thời.
- Mỗi pipeline chỉ xử lý một người nói chính tại một thời điểm.
- Khi nhiều người trong cuộc họp nói chồng nhau, hệ thống vẫn cố nhận diện nhưng không đảm bảo chính xác.
- Hệ thống không thực hiện speaker diarization.
- TTS outgoing có độ ưu tiên cao hơn TTS incoming.
- TTS incoming có thể bị tạm dừng khi người dùng bắt đầu nói.

---

## 14. Yêu cầu phi chức năng

### 14.1. Hiệu năng

Mục tiêu trên máy có GPU phù hợp với model:

| Hạng mục                         | Mục tiêu             |
| -------------------------------- | -------------------- |
| Thời gian phát hiện kết thúc câu | Dưới 700 ms          |
| ASR cho một câu ngắn             | Dưới 1.500 ms        |
| Dịch văn bản                     | Dưới 1.000 ms        |
| TTS                              | Dưới 1.500 ms        |
| Tổng độ trễ outgoing             | Trung vị dưới 4 giây |
| Tổng độ trễ phụ đề incoming      | Trung vị dưới 3 giây |

Trên CPU-only, hệ thống có thể chậm hơn nhưng phải tiếp tục hoạt động ổn định.

Độ trễ được đo từ thời điểm người dùng kết thúc câu đến thời điểm:

- Phụ đề dịch xuất hiện.
- Giọng nói dịch bắt đầu được phát.

### 14.2. Tính ổn định

- Hoạt động liên tục tối thiểu 60 phút.
- Không crash khi thay đổi thiết bị âm thanh.
- Không mất toàn bộ phiên khi một model gặp lỗi.
- Có thể khởi động lại từng pipeline độc lập.
- Giải phóng tài nguyên sau khi kết thúc phiên.
- Không tăng RAM liên tục theo thời gian sử dụng.

### 14.3. Offline

Sau khi cài đặt đầy đủ model:

- Không yêu cầu kết nối Internet.
- Không gọi API dịch cloud.
- Không gọi API speech-to-text cloud.
- Không gọi API text-to-speech cloud.
- Ứng dụng phải hiển thị rõ trạng thái `Offline Ready`.

### 14.4. Quyền riêng tư

- Không gửi âm thanh ra khỏi máy.
- Không lưu audio mặc định.
- Không lưu lịch sử nếu người dùng tắt chức năng này.
- Cho phép xóa toàn bộ dữ liệu phiên.
- Hiển thị rõ đường dẫn lưu dữ liệu.
- Không ghi nội dung hội thoại vào log kỹ thuật.
- Log kỹ thuật chỉ chứa ID, thời gian xử lý và mã lỗi.

### 14.5. Khả năng sử dụng

- Người dùng mới có thể hoàn thành cấu hình trong vòng năm phút.
- Có trình hướng dẫn thiết lập audio.
- Có nút test microphone và virtual microphone.
- Lỗi phải có hướng dẫn xử lý cụ thể.
- Trạng thái pipeline phải được hiển thị rõ ràng.

---

## 15. Cấu hình model

Ứng dụng cung cấp ba preset.

### Fast

- Model nhỏ hoặc đã quantize.
- Ưu tiên độ trễ thấp.
- Chất lượng nhận diện và dịch thấp hơn.
- Phù hợp CPU hoặc máy cấu hình yếu.

### Balanced

- Cân bằng giữa tốc độ và chất lượng.
- Là cấu hình mặc định.
- Phù hợp máy có GPU phổ thông.

### Quality

- Model lớn hơn.
- Chất lượng dịch tốt hơn.
- Yêu cầu nhiều RAM hoặc VRAM.
- Độ trễ cao hơn.

Model phải được đóng gói dưới dạng module để có thể thay đổi mà không sửa toàn bộ ứng dụng.

---

## 16. Lưu trữ dữ liệu

### 16.1. Session

```json
{
  "id": "session-uuid",
  "startedAt": "2026-07-10T13:00:00+07:00",
  "endedAt": "2026-07-10T14:00:00+07:00",
  "mode": "two_way",
  "incomingLanguage": {
    "source": "ja",
    "target": "vi"
  },
  "outgoingLanguage": {
    "source": "vi",
    "target": "ja"
  }
}
```

### 16.2. Utterance

```json
{
  "id": "utterance-uuid",
  "sessionId": "session-uuid",
  "sourceType": "microphone",
  "sourceLanguage": "vi",
  "targetLanguage": "ja",
  "sourceText": "Tôi sẽ kiểm tra lại vấn đề này.",
  "translatedText": "この問題を再度確認します。",
  "startedAt": "2026-07-10T13:10:02+07:00",
  "endedAt": "2026-07-10T13:10:05+07:00",
  "asrLatencyMs": 740,
  "translationLatencyMs": 360,
  "ttsLatencyMs": 510,
  "status": "completed"
}
```

---

## 17. Xử lý lỗi

| Trường hợp                        | Hành vi mong muốn                             |
| --------------------------------- | --------------------------------------------- |
| Không tìm thấy microphone         | Hiển thị màn hình chọn lại thiết bị           |
| Không tìm thấy virtual microphone | Hiển thị hướng dẫn cấu hình                   |
| Model chưa được cài đặt           | Không cho bắt đầu session                     |
| Không đủ RAM hoặc VRAM            | Đề xuất chuyển sang model nhỏ hơn             |
| ASR không nhận diện được          | Bỏ qua câu hoặc cho phép thử lại              |
| Dịch thất bại                     | Giữ nội dung gốc và hiển thị lỗi              |
| TTS thất bại                      | Cho phép gửi lại hoặc chỉ hiển thị text       |
| Audio device bị ngắt              | Tạm dừng pipeline tương ứng                   |
| AI Service bị dừng                | Thử khởi động lại local service               |
| Hàng đợi TTS quá dài              | Cho phép bỏ câu cũ hoặc tạm dừng nhận câu mới |
| Mất kết nối Internet              | Không ảnh hưởng khi model đã được cài đặt     |

---

## 18. Tiêu chí nghiệm thu MVP

MVP được coi là hoàn thành khi đáp ứng các điều kiện sau:

1. Ứng dụng chạy được trên hệ điều hành mục tiêu.
2. Có thể lựa chọn microphone, speaker và virtual microphone.
3. Có thể thu âm thanh từ microphone.
4. Có thể thu âm thanh đang phát từ máy tính.
5. Có thể nhận diện giọng nói bằng model local.
6. Có thể dịch sáu chiều ngôn ngữ đã xác định.
7. Có thể tổng hợp giọng nói bằng model local.
8. Có thể truyền giọng nói đã dịch vào Google Meet.
9. Người trong Google Meet nghe được âm thanh TTS.
10. Người dùng xem được phụ đề gốc và phụ đề dịch.
11. Incoming và outgoing pipeline không tạo vòng lặp âm thanh.
12. Ứng dụng hoạt động không cần Internet sau khi cài model.
13. Không có dữ liệu âm thanh hoặc hội thoại được gửi ra bên ngoài.
14. Có thể chạy liên tục trong ít nhất 60 phút mà không crash.
15. Có báo cáo độ trễ của ASR, dịch, TTS và toàn pipeline.
16. Có thể xóa lịch sử phiên.
17. Có tài liệu hướng dẫn cấu hình Google Meet và virtual microphone.

---

## 19. Kịch bản kiểm thử chính

### Test Case 1: Dịch tiếng Việt sang tiếng Anh

- Người dùng chọn `Vietnamese → English`.
- Người dùng nói một câu tiếng Việt.
- Hệ thống hiển thị văn bản tiếng Việt.
- Hệ thống hiển thị bản dịch tiếng Anh.
- Hệ thống phát giọng tiếng Anh vào virtual microphone.
- Người tham gia Google Meet nghe được nội dung tiếng Anh.

### Test Case 2: Dịch tiếng Nhật sang tiếng Việt

- Google Meet phát một câu tiếng Nhật.
- Hệ thống capture được system audio.
- Hệ thống hiển thị nội dung tiếng Nhật.
- Hệ thống hiển thị bản dịch tiếng Việt.
- Không gửi bản dịch vào microphone của Google Meet.

### Test Case 3: Two-way Conversation

- Remote nói tiếng Anh.
- Người dùng nhận phụ đề tiếng Việt.
- Người dùng trả lời bằng tiếng Việt.
- Remote nghe giọng tiếng Anh.
- Hệ thống không nhận diện lại giọng TTS vừa phát.

### Test Case 4: Không có Internet

- Ngắt kết nối Internet.
- Khởi động ứng dụng.
- Bắt đầu session.
- ASR, dịch và TTS vẫn hoạt động.

### Test Case 5: Microphone bị ngắt kết nối

- Đang sử dụng thì rút microphone.
- Hệ thống tạm dừng outgoing pipeline.
- Hiển thị lỗi.
- Người dùng chọn microphone mới.
- Pipeline tiếp tục hoạt động.

### Test Case 6: Câu nói dài

- Người dùng nói liên tục trên 30 giây.
- Hệ thống tự chia thành các đoạn nhỏ.
- Nội dung được dịch theo đúng thứ tự.
- Hàng đợi TTS không bị đảo câu.

### Test Case 7: Âm thanh chồng nhau

- Người dùng nói trong khi remote đang nói.
- Hai pipeline vẫn được phân biệt.
- TTS incoming không che TTS outgoing.
- Không hình thành vòng lặp audio.

---

## 20. Các chỉ số đánh giá đồ án

### Chất lượng ASR

- Word Error Rate đối với tiếng Việt và tiếng Anh.
- Character Error Rate đối với tiếng Nhật và tiếng Trung.
- Độ chính xác trong môi trường yên tĩnh.
- Độ chính xác khi có tiếng ồn.
- Độ chính xác với microphone khác nhau.

### Chất lượng dịch

- Mức độ giữ đúng ý nghĩa.
- Mức độ tự nhiên.
- Độ chính xác với câu giao tiếp thông thường.
- Độ chính xác với thuật ngữ kỹ thuật.
- Đánh giá thủ công bởi người biết ngôn ngữ.

### Chất lượng TTS

- Khả năng nghe hiểu.
- Độ tự nhiên.
- Tốc độ phát âm.
- Khả năng phát âm tên riêng và từ tiếng nước ngoài.

### Hiệu năng

- ASR latency.
- Translation latency.
- TTS latency.
- End-to-end latency.
- CPU usage.
- GPU usage.
- RAM usage.
- VRAM usage.

---

## 21. Rủi ro kỹ thuật

### Độ trễ cao

Nguyên nhân:

- Model quá lớn.
- Chạy trên CPU.
- Audio chunk quá dài.
- Load đồng thời nhiều model.

Biện pháp:

- Quantize model.
- Sử dụng GPU.
- Chọn preset Fast.
- Load model theo nhu cầu.
- Dịch theo từng utterance ngắn.

### Dịch sai do ASR sai

Lỗi ASR sẽ truyền sang bước dịch.

Biện pháp:

- Hiển thị nội dung gốc.
- Cho phép sửa trước khi gửi.
- Sử dụng confidence threshold.
- Cho phép phát lại hoặc nhận diện lại.

### Vòng lặp âm thanh

Biện pháp:

- Tách thiết bị input và output.
- Không capture virtual microphone.
- Sử dụng tai nghe.
- Tạm dừng pipeline khi phát TTS nếu cần.

### TTS nói chậm hơn tốc độ hội thoại

Biện pháp:

- Tăng tốc độ giọng đọc.
- Rút gọn bản dịch.
- Hủy các câu đã quá cũ.
- Giới hạn độ dài hàng đợi.

### Khác biệt giữa các hệ điều hành

Audio loopback và virtual device hoạt động khác nhau trên Windows, macOS và Linux.

MVP nên chỉ chọn một hệ điều hành mục tiêu. Sau khi pipeline AI ổn định mới mở rộng sang hệ điều hành khác.

---

## 22. Kế hoạch phát triển

### Giai đoạn 1: Proof of Concept

- Thu microphone.
- Chạy ASR local.
- Dịch văn bản local.
- Chạy TTS local.
- Phát kết quả ra loa.
- Chưa tích hợp Google Meet.

### Giai đoạn 2: Outgoing Translation

- Tích hợp virtual microphone.
- Truyền TTS vào Google Meet.
- Thêm Push-to-talk.
- Hiển thị transcript và translation.
- Ngăn audio loopback.

### Giai đoạn 3: Incoming Translation

- Capture system audio.
- Dịch giọng remote.
- Hiển thị phụ đề.
- Phát bản dịch ra tai nghe.

### Giai đoạn 4: Two-way Translation

- Chạy đồng thời hai pipeline.
- Quản lý ưu tiên audio.
- Xử lý hàng đợi TTS.
- Thêm chế độ tự động.

### Giai đoạn 5: Tối ưu và đánh giá

- Đo latency.
- Đo CPU, RAM, GPU và VRAM.
- So sánh các model.
- Đánh giá độ chính xác.
- Kiểm thử phiên họp dài.
- Hoàn thiện báo cáo đồ án.

---

## 23. Kết quả đầu ra của đồ án

Đồ án cần cung cấp:

1. Ứng dụng desktop chạy được.
2. Source code.
3. Tài liệu cài đặt.
4. Tài liệu cấu hình virtual microphone.
5. Tài liệu hướng dẫn sử dụng với Google Meet.
6. Kiến trúc hệ thống.
7. Báo cáo lựa chọn model.
8. Báo cáo hiệu năng.
9. Báo cáo độ chính xác.
10. Video demo cuộc hội thoại hai chiều.
11. Danh sách hạn chế và hướng phát triển.
