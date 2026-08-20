# Nhập tệp âm thanh — chuyển tệp có sẵn thành văn bản

**Giai đoạn:** ngoài lịch tuần · **Hiện thực:** 20/08/2026
**Mục tiêu:** trả nốt màn "Nhập tệp" — màn duy nhất trong bản thiết kế còn ở trạng
thái tắt vì thiếu API bên AI service.

> Không thuộc tuần nào trong đề cương `00`. Đây là một màn có sẵn trong bản thiết kế
> giao diện (xem [`08_week6-desktop.md`](08_week6-desktop.md)) nhưng bị vô hiệu hoá vì
> service mới chỉ có luồng realtime qua WebSocket. Tính năng cũng có ích cho phần thực
> nghiệm: chạy lại một bản ghi cuộc họp nhiều lần với các preset khác nhau mà không
> phải nói lại vào micro.

---

## 1. Xử lý theo lô, không phải một chế độ của pipeline realtime

`application/transcribe.py` là một use case riêng chứ không phải một nhánh `if` trong
`TranslationPipeline`. Ba khác biệt khiến việc nhét chung vào sẽ làm hỏng cả hai:

|               | Realtime (`/ws`)                           | Nhập tệp (`POST /api/transcribe`)                  |
| ------------- | ------------------------------------------ | -------------------------------------------------- |
| Đầu vào       | luồng khung 100 ms, không biết bao giờ hết | cả tệp, biết trước độ dài                          |
| Chốt câu cuối | chờ khoảng lặng / nhả Push-to-talk         | `flush()` ở cuối tệp                               |
| TTS           | có (chiều outgoing)                        | **không** — người dùng cần chữ, không cần nghe lại |
| Kết quả       | event chảy dần qua WebSocket               | một response duy nhất + tiến trình hỏi song song   |

Điểm chung được giữ nguyên: cùng `ProviderSet` (VAD/ASR/MT), cùng `ModelManager`, cùng
kiểu ghi lịch sử. Đổi adapter ASR/MT thì màn này hưởng luôn, không phải sửa gì.

## 2. Giải mã tệp đặt ở desktop, không đặt ở service

Người dùng thả vào MP3, M4A, WebM… còn pipeline chỉ ăn PCM 16-bit mono 16 kHz. Chỗ
giải mã có hai lựa chọn:

| Phương án                            | Đánh giá                                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| ffmpeg trong service                 | Phải đóng gói thêm binary cho cả Windows và macOS, hoặc bắt người dùng tự cài — trái với mục tiêu "cài một lần là chạy offline". |
| **Web Audio của Chromium (đã chọn)** | Electron đã có sẵn bộ giải mã MP3/WAV/M4A/FLAC/OGG/WebM/Opus. Không thêm phụ thuộc nào, vẫn chạy hoàn toàn cục bộ.               |

`adapters/audio-file-decode.ts` dùng `OfflineAudioContext(1, 1, 16000)` — `decodeAudioData`
resample thẳng về tần số của context, nên chỉ còn phải trộn kênh về mono và đổi
Float32 → Int16. Body gửi lên vì thế là PCM thô, đúng định dạng nội bộ của pipeline.

Service vẫn nhận được **WAV PCM 16-bit** (trộn mono + resample bằng nội suy tuyến tính)
để gọi bằng `curl` khi kiểm thử vẫn tiện; định dạng nén thì không, và đó là chủ ý.

## 3. Tiến trình đo bằng vị trí trong tệp

`POST /api/transcribe` chặn tới khi xong — một tệp 30 phút chạy vài phút, nên phải có
thứ để nhìn. Cách làm giống tiến trình nạp model: `GET /api/transcribe/progress` trả
trạng thái của lượt **đang chạy**, giao diện hỏi lại mỗi 0,7 giây.

`percent` = **vị trí trong tệp đã chạy qua VAD** ÷ độ dài tệp. Đây là số thật, không
phải ước lượng theo thời gian: tệp 10 phút chạy tới giây 300 thì đúng là 50%, máy nhanh
hay chậm không ảnh hưởng. Đổi lại, thanh chạy không đều — đoạn im lặng lướt qua rất
nhanh, đoạn dày tiếng nói thì chậm; như vậy vẫn trung thực hơn là nội suy tuyến tính
theo đồng hồ.

Mỗi lúc chỉ chạy một tệp (`409` nếu đang bận): model dùng chung, chạy song song chỉ
làm chậm cả hai. Giao diện chạy danh sách tệp **lần lượt** vì lý do đó, và khoá nút khi
đang có phiên dịch trực tiếp.

### 3.1. Dừng giữa chừng

`POST /api/transcribe/cancel` đặt cờ; vòng xử lý hỏi cờ đó ở ranh giới mỗi khúc rồi
dừng, và `POST /api/transcribe` **trả về bình thường** với `cancelled: true` cùng những
đoạn đã chạy xong — huỷ không có nghĩa là vứt đi phần đã dịch.

Vì sao phải là một endpoint chứ không phải đóng kết nối cho xong: **uvicorn không huỷ
handler khi client ngắt kết nối**. Bỏ request giữa chừng thì service vẫn chạy hết tệp
và vẫn giữ cờ "đang bận", nên tệp kế tiếp lãnh nguyên một cái `409` vô lý. Cùng lý do
đó, `should_stop` còn hỏi thêm `request.is_disconnected()` để lượt chạy tự dừng khi
người dùng đóng app giữa chừng.

Ba chỗ dễ kẹt cờ "đang bận", đều đã bịt và có test:

| Tình huống                      | Xử lý                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `asyncio.CancelledError`        | Là `BaseException`, nhánh `except Exception` **không** bắt được → phải có nhánh riêng, nếu không cờ kẹt tới lần khởi động sau. |
| Tệp hỏng / model không nạp được | Chỗ được giữ từ trước khi nạp model, nên mọi lối thoát sớm đều phải `release()`.                                               |
| Huỷ trong lúc đang nạp model    | Chỗ được **giữ trước** (`reserve`) chứ không đợi tới `begin`, nên yêu cầu huỷ trong quãng nạp model không bị xoá mất.          |

## 4. Kết quả vào thẳng lịch sử

Bản ghi được lưu thành một phiên trong SQLite (bỏ qua nếu người dùng đã tắt lưu lịch
sử — SPEC 14.4), nên phần tìm kiếm, đổi tên, xuất `.txt`/`.srt` và xoá của màn Lịch sử
dùng lại được nguyên vẹn, không phải viết bản thứ hai.

Kèm theo là một giá trị mới cho `AudioSource`: **`file`**. Câu nhập từ tệp không phải
giọng của mình cũng không phải giọng phía cuộc họp; mượn tạm `system` sẽ khiến màn Lịch
sử dán nhãn "REMOTE" cho một thứ không có bên nào. Nhãn `FILE` là cách nói đúng.

Mốc thời gian của từng câu = lúc bắt đầu nhập + **vị trí trong tệp**, nên bản ghi giữ
đúng thứ tự và người đọc thấy được câu nằm ở phút thứ mấy. Bản `.srt` xuất từ màn Nhập
tệp vì thế khớp thẳng với tệp âm thanh gốc.

## 5. Giao diện dựng theo bản thiết kế

Màn này lấy nguyên bố cục từ dự án Claude Design của đồ án: vùng kéo & thả (vòng tròn
icon + nút gradient "Chọn tệp"), rồi **hàng đợi xử lý một cột** — mỗi tệp một dòng có
tên, dung lượng, thời lượng, trạng thái, thanh tiến trình lúc đang chạy, và bản ghi tự
mở ngay bên trong dòng khi xong. Thả tệp vào là chạy luôn, không có nút "bắt đầu" riêng.

Bốn chỗ lệch so với mockup, đều có lý do:

| Chỗ lệch                                                      | Vì sao                                                                                                                                              |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thêm một hàng chọn **ngôn ngữ tệp / dịch sang / lưu lịch sử** | Mockup chỉ giả lập việc chuyển thành chữ; ASR thật thì phải biết ngôn ngữ nguồn trước khi chạy.                                                     |
| Nút **"Phân biệt người nói"** để tắt, kèm tooltip             | Pipeline không có khâu diarization. Đúng nguyên tắc đã theo suốt dự án: giữ chỗ theo thiết kế nhưng không bịa dữ liệu (ở đây là bịa tên người nói). |
| Bản ghi hiện thêm dòng dịch (`→ …`)                           | Mockup chỉ có một dòng chữ gốc vì không có MT.                                                                                                      |
| Thêm nút **Huỷ** và trạng thái "Đã huỷ"                       | Mockup giả lập bằng `setTimeout` nên không cần huỷ; chạy thật thì một tệp dài chiếm model hàng phút.                                                |

Hàng đợi thật nằm trong một `ref` chứ không suy ra từ state: vòng chạy sống lâu hơn một
lần render, đọc state trong đó sẽ bỏ sót tệp vừa thả vào giữa chừng.

## 6. Kiểm thử

`tests/test_transcribe.py` (15 test):

- giải mã: PCM thô đi thẳng, WAV stereo 48 kHz được trộn mono + resample, dữ liệu rác
  bị từ chối bằng `400` chứ không phải `500`;
- endpoint: cắt được đoạn và dịch, bỏ `target` thì không dịch, `target` trùng `source`
  không phải là dịch, ghi đúng một phiên vào lịch sử (`source = file`, phiên đóng
  ngay), tắt lưu lịch sử thì `sessionId` rỗng;
- huỷ: dừng sớm nhưng **giữ** đoạn đã chạy xong, `CancelledError` vẫn dọn được cờ, tệp
  hỏng cũng nhả chỗ (lần sau không dính `409`), endpoint huỷ lúc rảnh là no-op;
- tiến trình: về `active=false`, `percent=100` sau khi chạy xong;
- `/ws` từ chối `audio.chunk` mang `source: file` (giá trị đó là của luồng nhập tệp,
  lọt vào phiên trực tiếp sẽ bị hiểu nhầm là mic).

VAD là Silero **thật** ở các test đi qua HTTP (chỉ ASR/MT là bản giả của `conftest`),
nên phần cắt đoạn được kiểm tra trên tín hiệu tổng hợp giống nhịp nói, đúng như luồng
realtime.

Toàn suite sau đợt này: **114 passed, 4 skipped**; desktop typecheck + eslint sạch.

## 7. Còn nợ

- Chưa chạy thử với tệp thật dài (>30 phút) trên máy có model thật — cần đo lại xem
  `POST` giữ kết nối lâu như vậy có ổn không, và có nên đổi sang mô hình job + polling
  hay không. Với tệp cỡ một cuộc họp (5–15 phút) thì cách hiện tại là đủ.
- **Dịch theo lô**: hiện mỗi đoạn gọi NLLB một lần. Gộp nhiều đoạn vào một lần gọi sẽ
  nhanh hơn đáng kể cho tệp dài, nhưng phải mở rộng port `TranslationProvider` (thêm
  `translate_batch`) nên để lại cho đợt tối ưu, không làm lẫn vào đây.
- Cả tệp nằm trong RAM ở cả hai phía (renderer giải mã xong mới gửi, service
  `await request.body()`). Trần 400 MB PCM ≈ 3,5 giờ; muốn dài hơn thì phải stream
  xuống tệp tạm.
