# Các đợt bổ sung ngoài lịch tuần

**Phạm vi:** 18/08 – 06/09/2026 · **Nguồn yêu cầu:** nợ kỹ thuật của Tuần 6–8, SPEC, bản
thiết kế giao diện, và [biên bản họp GVHD 19/08](meetings/bien-ban-hop-GVHD-2026-08-19.md).

> Tám ghi chú rời trước đây, gộp thành một bản ghi theo thứ tự thời gian. Không việc nào
> thuộc một tuần trong đề cương [`00`](00_project-outline.md) — chúng phát sinh từ việc
> dùng thử, từ những chỗ giao diện có sẵn mà backend còn thiếu, và từ yêu cầu của thầy.
>
> Ghi chú theo tuần: [`03_nhat-ky-tuan-1-8.md`](03_nhat-ky-tuan-1-8.md). Việc còn treo:
> [`08_viec-con-lai.md`](08_viec-con-lai.md).

| §   | Đợt   | Nội dung                                               |
| --- | ----- | ------------------------------------------------------ |
| 1   | 18/08 | Lịch sử phiên, đổi thư mục model, khởi động nhanh      |
| 2   | 20/08 | Màn Nhập tệp — audio/video có sẵn thành văn bản        |
| 3   | 05/09 | Backend ASR thứ hai (MLX) + tách người nói             |
| 4   | 05/09 | Duyệt trước khi gửi + bốn nút quản lý model bị vô hiệu |
| 5   | 05/09 | Màn Đánh giá trong app + backend ASR thứ ba            |
| 6   | 06/09 | Ba lần sửa cùng một chỗ: cách đặt tên và tải model     |

---

## 1. Lịch sử phiên, thư mục model, khởi động nhanh — 18/08

Ba khoản nợ của Tuần 6–8, đều chặn phần "ứng dụng dùng được thật" chứ không phải phần
pipeline. Hai cái phát sinh trực tiếp từ việc dùng thử: bật app lên chờ 45 giây mới thấy
giao diện, và ổ đĩa hệ thống hết chỗ vì model nằm cứng ở `~/.llvt/models`.

### 1.1. Lịch sử phiên lưu trong SQLite

SPEC `01` §7.11 yêu cầu lưu nội dung phiên, tiêu chí nghiệm thu 16 yêu cầu xoá được. Tuần
6 chỉ có phụ đề sống trong bộ nhớ renderer: đóng app là mất.

**Service ghi, không phải desktop.** Pipeline biết chính xác lúc nào một câu kết thúc và
mất bao nhiêu mili giây ở từng khâu; để renderer ghi thì con số đó phải đi vòng qua
WebSocket rồi quay lại, và bản ghi sẽ mất mỗi khi cửa sổ đóng giữa chừng.

| Quyết định                           | Vì sao                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| SQLAlchemy **Core**, không ORM       | Hai bảng phẳng, truy vấn đơn giản — không cần identity map hay lazy loading                                              |
| `create_all`, **không Alembic**      | CSDL chỉ tồn tại trên máy người dùng, luôn do đúng phiên bản app đang chạy tạo ra; đổi schema bằng `PRAGMA user_version` |
| `LIKE`, **không FTS5**               | Một máy, một người dùng, cỡ vài nghìn câu — đổi lấy việc không phải nuôi bảng ảo + trigger đồng bộ                       |
| Mọi câu lệnh qua `asyncio.to_thread` | pysqlite là blocking; chạy thẳng sẽ chặn event loop của FastAPI ngay giữa phiên dịch                                     |
| **Không** lưu file âm thanh          | SPEC 14: chỉ văn bản + số đo. Audio là dữ liệu nhạy cảm nhất và cũng nặng nhất                                           |

**Quyền riêng tư (SPEC 14.4).** `HistoryPolicy` hiện thực chính port `SessionRepository` và
bọc quanh adapter thật. Chính sách thuộc về application chứ không phải adapter — adapter
biết _cách_ lưu, không biết _có được phép_ lưu. Khi tắt: lệnh ghi thành no-op, còn đọc/xoá
vẫn chạy, nên dữ liệu cũ vẫn xem và xoá được.

Desktop đọc **thẳng từ REST**, không giữ bản sao trong `localStorage`: hai nguồn sự thật
cho cùng một danh sách là cách chắc chắn nhất để chúng lệch nhau.

### 1.2. Đổi thư mục lưu model

Khó ở chỗ: `Settings` đọc từ **biến môi trường**, mà người dùng cuối không đặt được, còn
lựa chọn của họ lại phải sống sót qua lần mở app sau.

Cách giải: thêm **nguồn cấu hình thứ hai** — `~/.llvt/settings.json`, cắm vào
pydantic-settings ở vị trí **dưới** env vars. Ai đã đặt `LLVT_MODELS_DIR` là có chủ ý rõ
ràng → API trả `modelsDirEditable: false`, giao diện khoá ô lại, `PUT` trả **409**.

Ba chi tiết dễ bỏ sót:

- File settings **không** nằm trong thư mục model — nếu không, đổi thư mục model xong là
  mất luôn chỗ ghi nhớ vừa đổi.
- Ghi ra file tạm rồi `replace()`, mất điện giữa chừng không để lại JSON cụt.
- Chỉ `models_dir` được phép ghi (`WRITABLE_KEYS`), để file này không dần biến thành nơi
  chứa mọi thứ.

**Đổi thư mục thì unload chứ không reload.** Thư mục mới gần như luôn rỗng; reload ngay
trong request nghĩa là tải vài GB trong lúc người dùng đang chờ một cái nút.

`DELETE /api/models` chỉ động vào bốn thư mục do app tạo — `whisper-cpp/`, `nllb/`,
`sherpa-tts/`, `kokoro-ja/` — chứ không xoá sạch `models_dir`: người dùng hoàn toàn có thể
trỏ nó vào một thư mục đang chứa thứ khác. Phải unload trước khi xoá, nếu không Windows
không cho xoá file đang mở.

### 1.3. Không nạp model lúc khởi động

Trước: lifespan gọi `load_preset()` → mở service mất **~45 giây**. Sau: lifespan gọi
`select_preset()` — **ghi nhận** preset, không dựng provider nào. Service mở trong **~0,4
giây**. Model vào bộ nhớ ở đúng ba chỗ, cả ba đi qua `ModelManager.ensure_loaded()`: nút
"Khởi động model", `session.start`, và `POST /api/benchmark`.

`LLVT_PRELOAD_MODELS=true` khôi phục hành vi nạp sẵn — cần cho các lần chạy headless.

**Tín hiệu "chưa có gì trong bộ nhớ"** ở mức giao thức là mảng `stages` **rỗng** trong
`GET /api/config`. Giao diện lấy đúng cái đó làm trạng thái badge thay vì đoán.

Hệ quả phải nói rõ với người dùng: bắt đầu phiên khi model chưa nạp thì **câu đầu tiên
phải chờ** hàng chục giây. Màn Phiên dịch hiện một `Notice` giải thích, để không ai tưởng
ứng dụng treo.

### 1.4. Tiến trình nạp — đo thứ chắc chắn đúng

`POST /api/models/load` chặn tới lúc xong, nên lần đầu người dùng ngồi nhìn một vòng xoay
vài phút. `GET /api/models/progress` trả tiến trình **trong lúc** lệnh kia còn chạy — được,
vì `provider.load()` đẩy phần chặn sang thread khác nên event loop vẫn rảnh trả lời REST.

pywhispercpp và transformers đều tự tải bằng `tqdm` riêng, không có callback nào để cắm
vào; vá đè `tqdm` của thư viện thứ ba thì gãy mỗi lần nâng phiên bản. Nên
`application/load_progress.py` đo **số byte đã nằm trên đĩa** trong thư mục của khâu đó,
lấy mẫu 0,5 giây một lần, trừ đi phần đã có sẵn từ trước (nếu không, lần nạp thứ hai hiện
100% ngay từ đầu).

Giữ nguyên tắc "không hiển thị số bịa": `percent` là `null` khi không biết tổng — giao diện
hiện số MB, tuyệt đối không đoán %. Tổng xấp xỉ thì kèm dấu `≈`.

Phần trăm chia **đều** cho bốn khâu chứ không theo dung lượng: VAD và TTS gần như tức thì,
chia theo dung lượng thì thanh sẽ đứng im ở 0% suốt lúc tải NLLB rồi nhảy vọt.

---

## 2. Màn Nhập tệp — 20/08

Màn duy nhất trong bản thiết kế còn ở trạng thái tắt vì thiếu API bên AI service. Cũng có
ích cho phần thực nghiệm: chạy lại một bản ghi cuộc họp nhiều lần với các preset khác nhau
mà không phải nói lại vào micro.

### 2.1. Use case riêng, không phải một chế độ của pipeline realtime

`application/transcribe.py` là một use case riêng chứ không phải một nhánh `if` trong
`TranslationPipeline`. Ba khác biệt khiến nhét chung sẽ làm hỏng cả hai:

|               | Realtime (`/ws`)                           | Nhập tệp (`POST /api/transcribe`)                  |
| ------------- | ------------------------------------------ | -------------------------------------------------- |
| Đầu vào       | luồng khung 100 ms, không biết bao giờ hết | cả tệp, biết trước độ dài                          |
| Chốt câu cuối | chờ khoảng lặng / nhả Push-to-talk         | `flush()` ở cuối tệp                               |
| TTS           | có (chiều outgoing)                        | **không** — người dùng cần chữ, không cần nghe lại |
| Kết quả       | event chảy dần qua WebSocket               | một response duy nhất + tiến trình hỏi song song   |

Điểm chung giữ nguyên: cùng `ProviderSet`, cùng `ModelManager`, cùng kiểu ghi lịch sử. Đổi
adapter ASR/MT thì màn này hưởng luôn.

### 2.2. Giải mã đặt ở desktop, không đặt ở service

| Phương án                            | Đánh giá                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| ffmpeg trong service                 | Phải đóng gói thêm binary cho cả hai OS, hoặc bắt người dùng tự cài — trái mục tiêu "cài một lần là chạy offline" |
| **Web Audio của Chromium (đã chọn)** | Electron có sẵn bộ giải mã cho cả tệp audio lẫn container video thông dụng. Không thêm phụ thuộc nào              |

`OfflineAudioContext(1, 1, 16000)` — `decodeAudioData` resample thẳng về tần số của context,
nên chỉ còn phải trộn kênh về mono và đổi Float32 → Int16. Nó cũng demux luôn container
video và chỉ lấy track tiếng, nên "tệp video → văn bản" dùng đúng đường đã có.

Đo thật trên Electron 39 (macOS arm64), không phỏng đoán theo tài liệu:

| Container                              | Kết quả                            |
| -------------------------------------- | ---------------------------------- |
| mp3, m4a, wav, flac, ogg               | ✅                                 |
| webm (vp8 + opus)                      | ✅                                 |
| **mp4 / mov / m4v / 3gp** (h264 + aac) | ✅ tách được tiếng từ tệp có video |
| **mkv** (h264 + aac, và h264 + opus)   | ✅                                 |
| avi, mpeg-ts, flv, wmv                 | ❌ Chromium không có demuxer       |

Nhóm hỏng đều là định dạng cũ, trong khi Google Meet, Zoom và OBS đều xuất ra mp4/mkv/webm —
nên **không** đóng gói `ffmpeg.wasm` (~30 MB) chỉ để cứu vài định dạng hiếm. Chromium chỉ
trả đúng một câu lỗi `Unable to decode audio data` cho mọi trường hợp, nên `media-decode.ts`
phân loại theo đuôi tệp để phân biệt "định dạng không đọc được" với "video không có track
tiếng".

### 2.3. Tiến trình đo bằng vị trí trong tệp

`percent` = **vị trí trong tệp đã chạy qua VAD** ÷ độ dài tệp. Đây là số thật: tệp 10 phút
chạy tới giây 300 thì đúng là 50%, máy nhanh hay chậm không ảnh hưởng. Đổi lại, thanh chạy
không đều — đoạn im lặng lướt qua rất nhanh, đoạn dày tiếng nói thì chậm; vẫn trung thực hơn
nội suy tuyến tính theo đồng hồ.

Mỗi lúc chỉ chạy một tệp (`409` nếu đang bận): model dùng chung, chạy song song chỉ làm chậm
cả hai.

**Dừng giữa chừng phải là một endpoint, không phải đóng kết nối.** `uvicorn` **không huỷ
handler khi client ngắt kết nối** — bỏ request giữa chừng thì service vẫn chạy hết tệp và
vẫn giữ cờ "đang bận", nên tệp kế tiếp lãnh nguyên một cái `409` vô lý.
`POST /api/transcribe/cancel` đặt cờ; `POST /api/transcribe` **trả về bình thường** với
`cancelled: true` cùng những đoạn đã chạy xong — huỷ không có nghĩa là vứt đi phần đã dịch.

Ba chỗ dễ kẹt cờ "đang bận", đều đã bịt và có test:

| Tình huống                      | Xử lý                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `asyncio.CancelledError`        | Là `BaseException`, nhánh `except Exception` **không** bắt được → phải có nhánh riêng          |
| Tệp hỏng / model không nạp được | Chỗ được giữ từ trước khi nạp model, nên mọi lối thoát sớm đều phải `release()`                |
| Huỷ trong lúc đang nạp model    | Chỗ được **giữ trước** (`reserve`) chứ không đợi tới `begin`, nên yêu cầu huỷ không bị xoá mất |

### 2.4. Kết quả vào thẳng lịch sử

Bản ghi lưu thành một phiên trong SQLite, nên tìm kiếm, đổi tên, xuất `.txt`/`.srt` và xoá
của màn Lịch sử dùng lại được nguyên vẹn.

Kèm một giá trị mới cho `AudioSource`: **`file`**. Câu nhập từ tệp không phải giọng của mình
cũng không phải giọng phía cuộc họp; mượn tạm `system` sẽ khiến màn Lịch sử dán nhãn
"REMOTE" cho một thứ không có bên nào.

Mốc thời gian của từng câu = lúc bắt đầu nhập + **vị trí trong tệp**, nên bản `.srt` khớp
thẳng với tệp âm thanh gốc.

### 2.5. Đổi tab không được mất việc đang làm

Router cũ tháo bỏ màn cũ mỗi lần đổi tab. Với màn Nhập tệp thì đó không chỉ là mất ô tìm
kiếm: **vòng chạy vẫn tiếp tục ngầm** (service vẫn nghiền tệp) nhưng kết quả đổ vào một
component đã bị tháo, nên quay lại tab thì hàng đợi trống trơn như chưa từng chạy gì.

Sửa ở `App.tsx`: mọi màn dựng một lần và **giữ nguyên**, đổi tab chỉ ẩn/hiện (`display:none`;
màn đang mở dùng `display:contents` để không phá layout flex).

Đánh đổi: màn bị ẩn vẫn chạy hook của nó, nên mọi query có `refetchInterval` phải tự tắt khi
khuất — `useIsScreen(id)` làm việc đó cho `useResources` và `useSessions`.

Hàng đợi thật nằm trong một `ref` chứ không suy ra từ state: vòng chạy sống lâu hơn một lần
render, đọc state trong đó sẽ bỏ sót tệp vừa thả vào giữa chừng.

### 2.6. Bốn chỗ lệch so với mockup

| Chỗ lệch                                              | Vì sao                                                                                    |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Thêm hàng chọn ngôn ngữ tệp / dịch sang / lưu lịch sử | Mockup chỉ giả lập chuyển thành chữ; ASR thật phải biết ngôn ngữ nguồn trước khi chạy     |
| Nút "Phân biệt người nói" để tắt, kèm tooltip         | Lúc đó pipeline chưa có diarization — giữ chỗ theo thiết kế nhưng không bịa tên người nói |
| Bản ghi hiện thêm dòng dịch (`→ …`)                   | Mockup chỉ có một dòng chữ gốc vì không có MT                                             |
| Thêm nút Huỷ và trạng thái "Đã huỷ"                   | Mockup giả lập bằng `setTimeout`; chạy thật thì một tệp dài chiếm model hàng phút         |

---

## 3. Backend ASR thứ hai (MLX) và tách người nói — 05/09

**Nguồn ý tưởng:** danh mục model của TranscriptionSuite (tài liệu tham khảo [1] của đề
cương). Câu hỏi xuất phát: tab _Models_ của TS liệt kê 43 model, danh mục của mình mới có
10 — có gì đáng lấy sang không?

### 3.1. Lọc danh mục: lấy được bao nhiêu trong 43?

| Họ model trong TS               | Số  | Lấy?   | Lý do                                                                      |
| ------------------------------- | --- | ------ | -------------------------------------------------------------------------- |
| whisper.cpp (GGML)              | 11  | **Có** | Đúng runtime đang chạy; trước đợt này preset mới dùng 3 biến thể           |
| MLX Whisper (Apple Silicon)     | 12  | **Có** | 99 ngôn ngữ, có vi/ja/zh → backend ASR thứ hai                             |
| Diarization (pyannote)          | 1   | **Có** | Không nằm trong pipeline dịch, nhưng hợp với màn Nhập tệp                  |
| Faster Whisper (CTranslate2)    | 10  | Chưa   | Dùng được nhưng adapter còn là stub — làm ở §5                             |
| Parakeet / Canary (NVIDIA NeMo) | 5   | Không  | Chỉ 25 tiếng châu Âu — **không có tiếng Việt, Nhật, Trung**                |
| SenseVoice (FunASR)             | 1   | Không  | zh/en/yue/ja/ko — thiếu đúng tiếng Việt                                    |
| VibeVoice (9B)                  | 4   | Không  | 6–18 GB, thiết kế cho xử lý theo lô — không có cửa chạy gần thời gian thực |

Hơn một nửa danh mục của TS không dùng được ở đây, và lý do luôn là **ngôn ngữ**, không phải
chất lượng model. TS nhắm hội thoại tiếng Anh/châu Âu; đồ án này bắt buộc phải có tiếng Việt
ở một đầu.

Sau khi mở rộng: `whisper_cpp.MODEL_MAP` có 15 mục, `mlx_whisper.MODEL_MAP` có 12, dung lượng
lấy thật từ API của HuggingFace chứ không ước lượng — nhân tiện sửa được hai con số sai:
`ggml-large-v3-turbo-q5_0.bin` là **574 MB** (không phải 809 MB) và `-q8` là **874 MB** (không
phải 1,2 GB).

Cố ý **không** đưa vào các biến thể English-only (`small.en`…) dù whisper.cpp có: ứng dụng
luôn phải nhận cả vi/ja/zh, model English-only sẽ trả rác cho ba thứ tiếng đó.

### 3.2. MLX — kiểm chứng rằng kiến trúc hexagonal không chỉ nằm trên giấy

Cả whisper.cpp và MLX đều chạy Whisper trên GPU Apple nhưng bằng hai đường khác nhau: C++
với Metal shader tự viết, so với framework mảng của Apple dùng unified memory. Câu "chọn cái
nào" phải trả lời bằng số, mà muốn có số thì phải chạy được cả hai.

Thêm backend này tốn đúng ba chỗ, không đụng `pipeline.py`, `transcribe.py`, transport hay
giao diện:

- thêm `adapters/asr/mlx_whisper.py`;
- thêm **một dòng** vào `ASR_REGISTRY`;
- thêm một dòng `asr_alternatives` cho mỗi preset.

Chỗ dễ sai nhất: **preset là một mức nhanh/chất lượng, không phải một model.** Tên model của
hai runtime không thay nhau được, nên `PresetConfig.asr_alternatives` giữ bảng tương đương và
`asr_model(cfg, adapter)` tra sang cột đúng. Đặt sai tên adapter thì service **cảnh báo trong
log rồi dùng tiếp adapter của preset**, không chết lúc khởi động.

```bash
make setup-mlx                      # chỉ macOS + Apple Silicon
LLVT_ASR_ADAPTER=mlx_whisper make service
```

> `uv sync` gỡ mọi nhóm/extra không được nêu trong chính lệnh đó — chạy `make setup-mlx` sau
> `make setup` là mất nhóm `eval` và các backend còn lại.

### 3.3. Bảy model MLX, đo thật để chọn — 06/09

Bảng `asr_alternatives` ban đầu chọn model theo suy đoán ("turbo cho nhanh, fp16 cho chất
lượng"). Đo thật để kiểm chứng: cùng **20 câu đầu tiếng Việt** của FLEURS `test`, cùng tham
số giải mã (`temperature=0`, không fallback), bộ lọc câu ma tắt, trên Apple M4.

| Model MLX (`mlx-community/…`)       | Trên đĩa |    WER |   RTF | Ước tính chạy đầy đủ 4 ngôn ngữ |
| ----------------------------------- | -------: | -----: | ----: | ------------------------------- |
| `whisper-large-v3-asr-fp16`         |   2,9 GB |   6,7% |  0,18 | ~110 phút                       |
| `whisper-large-v3-asr-8bit`         |   1,2 GB |   6,7% |  0,14 | ~86 phút                        |
| `whisper-large-v3-asr-4bit`         |   852 MB |   7,2% |  0,13 | ~80 phút                        |
| `whisper-large-v3-turbo-asr-fp16`   |   1,5 GB |   8,1% |  0,08 | ~49 phút                        |
| `whisper-large-v3-turbo-asr-8bit`   |   829 MB |   8,1% |  0,08 | ~49 phút                        |
| `whisper-large-v3-turbo-asr-4bit`   |   447 MB |   8,9% |  0,08 | ~49 phút                        |
| `whisper-small-asr-fp16`            |   490 MB | 133,5% |  0,14 | không dùng được                 |
| _whisper.cpp `large-v3-turbo-q5_0`_ |   570 MB |   8,6% | 0,089 | ~55 phút                        |

**Ba điều rút ra:**

1. **Lượng tử hoá gần như miễn phí.** fp16 → 8bit **không đổi WER** (6,7% cả hai) nhưng nhỏ
   hơn 2,3 lần và nhanh hơn 22%. Xuống 4bit mới mất 0,5–0,8 điểm. Không có lý do nào để dùng
   bản fp16 của cùng một model.
2. **Turbo mới là chỗ đánh đổi thật:** nhanh gấp ~2 lần (RTF 0,08 so với 0,14) nhưng mất 1,4
   điểm WER. Đây là quyết định sản phẩm, không phải quyết định kỹ thuật.
3. **Bản `small` không dùng được cho tiếng Việt.** WER 133,5% (vượt 100% được vì lỗi **chèn**
   cũng bị tính) với 10/20 câu trả rỗng, số còn lại rơi vào vòng lặp lặp chữ.

**Họ `whisper-small-asr-*` của mlx-community hỏng — preset Fast phải đổi.** Đo tiếp bản mà
preset Fast đang dùng, và đo thêm bản GGML cùng cỡ để biết lỗi nằm ở đâu:

| Model                                         | Ngôn ngữ |    WER |  RTF | Câu rỗng |
| --------------------------------------------- | -------- | -----: | ---: | -------: |
| MLX `whisper-small-asr-8bit` (preset Fast cũ) | vi       | 125,4% | 0,28 |    10/20 |
| MLX `whisper-small-asr-8bit`                  | en       | 162,1% | 0,38 |     3/20 |
| MLX `whisper-small-asr-fp16`                  | vi       | 133,5% | 0,14 |    10/20 |
| whisper.cpp `ggml-small-q5_1` (cùng cỡ)       | vi       |  20,6% | 0,07 |     0/20 |

Bản GGML cùng cỡ chạy bình thường — kém chính xác nhưng **hoạt động**. Vậy lỗi không phải
"model small quá nhỏ", cũng không phải tham số giải mã của mình, mà là **các bản chuyển đổi
`whisper-small-asr-*` của mlx-community**. Đáng chú ý hơn: bản MLX small còn **chậm hơn** mọi
model lớn — vì kẹt vòng lặp thì nó sinh token tới khi hết hạn mức.

Đã sửa preset Fast trỏ `mlx_whisper` sang `whisper-large-v3-turbo-asr-4bit`: 447 MB (nhỏ hơn
bản small fp16), RTF 0,08, WER 8,9% — thắng bản small ở cả ba trục nên đây không phải một sự
đánh đổi. Danh mục đánh dấu ba bản small là "không khuyến nghị" thay vì gỡ hẳn.

**Hai giới hạn của bảng này**, phải nói kèm khi trích vào báo cáo: chỉ 20 câu và chỉ tiếng
Việt, nên chênh lệch dưới ~1 điểm WER chưa kết luận được; và dòng whisper.cpp khác dòng MLX
ở **cả** runtime lẫn cỡ model, nên nó không phải phép so sánh runtime thuần tuý.

### 3.4. Hai chi tiết kỹ thuật của MLX

**Thread affinity.** MLX gắn GPU stream vào chính thread đã tạo ra nó; gọi từ thread khác thì
ném `RuntimeError: There is no stream (gpu,0) in current thread`
([ml-explore/mlx#2133](https://github.com/ml-explore/mlx/issues/2133)). `SerialExecutor` dùng
`asyncio.to_thread`, tức pool mặc định với các worker thay thế nhau được — `load()` và
`transcribe()` gần như chắc chắn rơi vào hai thread khác nhau. Nên có thêm `PinnedExecutor`:
pool đúng một worker, mọi lời gọi ở cùng một thread, và tuần tự sẵn nên không cần lock.

**Độ tin cậy không cùng đại lượng.** pywhispercpp trả `probability` = trung bình **cộng** xác
suất token; mlx-audio chỉ có `avg_logprob`, nên `exp()` của nó là trung bình **nhân**. Trung
bình nhân luôn ≤ trung bình cộng ⇒ cùng một ngưỡng `LLVT_ASR_MIN_CONFIDENCE` sẽ khắt khe hơn
một chút trên MLX. Ghi ra đây để lúc so hai runtime không kết luận nhầm rằng "MLX kém tự tin
hơn".

Tham số giải mã của hai adapter được đặt **đối xứng** (`no_context` ↔
`condition_on_previous_text=False`, tắt fallback nhiệt độ ở cả hai): so hai runtime chỉ có
nghĩa khi chính sách giải mã giống nhau.

### 3.5. Tách người nói — chỉ cho màn Nhập tệp

**Vì sao không dùng cho phiên trực tiếp.** Không phải vì khó, mà vì không cần và không đúng:
trong phiên hai chiều ai nói đã biết sẵn (mic là người dùng, system audio là phía bên kia);
và model diarization phải gom cụm giọng trên toàn bộ đoạn âm thanh mới ổn định được danh
tính, trong khi mỗi câu realtime chỉ dài vài giây nên `SPEAKER_00` của câu này không có liên
hệ gì với `SPEAKER_00` của câu sau.

Port riêng `ports/diarization.py`, **không** nhét vào `SpeechToTextProvider`: hai bài toán độc
lập. `ProviderSet.diarizer` là `Optional` — bản cài không có diarization vẫn chạy đủ.

```
PCM cả tệp ─┬─► diarize()  → [SpeakerTurn]  → rename_by_first_appearance()
            └─► VAD → ASR → MT (từng đoạn) → label_for(đoạn, turns)
```

`application/speaker_labels.py` là hàm thuần, tách ra vì đây là chỗ hai cách cắt âm thanh gặp
nhau và **chúng không trùng nhau**: VAD cắt theo khoảng lặng (một câu), diarization cắt theo
giọng (một lượt nói, có thể chồng lấn). Nên không tra được theo mốc bắt đầu — phải hỏi "trong
khoảng thời gian của câu này, ai chiếm nhiều thời lượng nhất", và bỏ trống khi không ai chiếm
quá 25%.

Nhãn model đặt (`SPEAKER_03`) được đánh số lại theo **thứ tự ai lên tiếng trước** →
`speaker-1`, `speaker-2`. Service trả về **mã**, không trả câu chữ: lịch sử là dữ liệu lưu lâu
dài, người dùng đổi ngôn ngữ giao diện thì bản ghi cũ phải đổi theo chứ không được đóng băng
tiếng Việt trong SQLite.

**Mặc định TẮT, và nói thẳng vì nó đi ngược mục tiêu "hoàn toàn cục bộ":**

1. `pyannote/speaker-diarization-community-1` là repo **gated** — phải đồng ý điều khoản trên
   huggingface.co và có access token mới tải được. Token chỉ dùng cho **lần tải đầu tiên**;
   sau đó model (~33 MB) chạy offline như mọi model khác.
2. `pyannote.audio` kéo theo torchaudio/lightning/optuna — vài trăm MB phụ thuộc cho một tính
   năng của một màn hình.

**Hỏng thì xuống nước, không kéo cả ứng dụng theo.** Nạp model hỏng: khâu `DIA` bị đánh dấu
`failed` kèm lý do, bốn khâu của pipeline dịch vẫn nạp bình thường. Chạy hỏng giữa chừng: bỏ
nhãn người nói, giữ nguyên bản ghi — bản ghi không có nhãn vẫn dùng được, không có bản ghi thì
không.

### 3.6. Token HuggingFace — bí mật duy nhất của ứng dụng

Màn Cài đặt vốn đã có ô "Hugging Face Token" từ bản thiết kế nhưng là placeholder: token nằm
trong `localStorage` của renderer và **không đi đâu cả**. Diarization là tính năng đầu tiên
thật sự cần nó, nên nhân tiện sửa luôn vấn đề bảo mật có sẵn — `localStorage` lưu văn bản
thường, mọi script trong renderer đọc được.

Token giờ do service giữ trong `~/.llvt/settings.json` **quyền 0600**, và không bao giờ đi
ngược lại renderer: `GET /api/config` chỉ trả `hfTokenSet`, `hfTokenSource` và một đoạn che
(`hf_AbC…2345`). Log chỉ ghi việc đã đổi chứ không ghi giá trị. `LocalPreferences.load()`
**chủ động xoá** khoá `hfToken` còn sót trong localStorage của bản cũ.

| Nguồn                               | `hfTokenSource` | Sửa trong app? |
| ----------------------------------- | --------------- | -------------- |
| `LLVT_HF_TOKEN`                     | `env`           | Không (409)    |
| Ô nhập ở màn Cài đặt                | `saved`         | Có             |
| `HF_TOKEN` người dùng tự export sẵn | `inherited`     | Không cần      |

Mấu chốt để "hỗ trợ HF" không dừng ở pyannote: `publish_hf_token()` chép token đang có hiệu
lực vào biến `HF_TOKEN`. Cả ba đường tải model của đồ án — transformers (NLLB),
`snapshot_download` (MLX) và pyannote — đều gọi `huggingface_hub.get_token()`, mà hàm đó đọc
`os.environ` **tại thời điểm gọi**. Đặt một biến là đủ cho cả ba, thay vì luồn tham số
`token=` qua từng adapter.

`POST /api/hf/verify` hỏi `whoami` của huggingface.co. Có nó vì cách còn lại để phát hiện
token sai là **chờ hết một lượt tải model vài phút** rồi mới thấy 401. Token sai trả **200 kèm
`ok: false`** chứ không phải lỗi HTTP: đó là kết quả bình thường của việc kiểm tra, không phải
request hỏng.

### 3.7. Sửa kèm

| Chỗ                               | Thay đổi                                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adapters/persistence/sqlite.py`  | Thêm cột `utterances.speaker` + nâng cấp schema bằng `PRAGMA user_version` (v1 → v2) — `create_all` bỏ qua bảng đã tồn tại nên không bơm được cột mới |
| `application/installed_models.py` | Quét thêm `mlx-whisper/` và `pyannote/`, và cho `DELETE /api/models` xoá đúng chúng                                                                   |
| Contract REST                     | `diarizationEnabled`, `?diarize=`, `TranscriptSegment.speaker`, `speakerCount`, `TranscribeProgress.phase`, `UtteranceSchema.speaker`                 |
| Thanh tiến trình nhập tệp         | Diarization chạy trên cả tệp **trước** khi nhận dạng chữ nên `percent` đứng ở 0 suốt quãng đó → thêm `phase`                                          |
| `Stage` (cả hai phía)             | Thêm `'DIA'`                                                                                                                                          |

---

## 4. Duyệt trước khi gửi + bốn nút quản lý model — 05/09

**Nguồn yêu cầu:** SPEC 7.10 / 7.8 và bản thiết kế giao diện. Đợt này đóng nốt nhóm tính năng
**đã có chỗ trong giao diện hoặc trong contract nhưng chưa có backend**. Rà lại toàn bộ
`DisabledButton`, `notSupported` và các giá trị enum không ai phát ra thì còn đúng năm chỗ.

### 4.1. Chỉnh sửa trước khi gửi (SPEC 7.10)

Đáng chú ý nhất vì nó là một **yêu cầu chức năng có số hiệu**, không phải một nút phụ:
`WaitingForConfirmation` đã nằm trong `PipelineState` của cả hai phía từ Tuần 6 nhưng **không
chỗ nào phát ra nó**.

`TranslationPipeline` tách bước tổng hợp giọng ra thành `_speak()`. Bật `review` thì luồng
dừng **sau khâu MT**, treo câu lại và báo `WaitingForConfirmation`; TTS chỉ chạy khi client
gửi `control.confirm`. Chỉ áp cho chiều **outgoing**: câu của phía bên kia không phải của mình
mà sửa, và chiều incoming vốn không tổng hợp giọng.

**Ba quyết định về dữ liệu:**

- **Ghi lịch sử ngay lúc treo, không đợi bấm gửi.** App tắt giữa lúc đang treo thì câu đã dịch
  vẫn còn, chỉ mất việc chưa đọc ra. Bấm gửi sẽ upsert kèm `tts_ms`.
- **Bản đã sửa ghi đè bản dịch máy.** Cái được gửi đi mới là cái đáng lưu; giữ bản máy dịch rồi
  vứt bản người sửa là ghi sai sự thật.
- **Bỏ một câu vẫn giữ nó trong lịch sử.** Người dùng quyết định không gửi cũng là một sự việc
  có thật của cuộc họp; dấu hiệu nhận biết là `ttsMs` rỗng.

**Đếm ngược (SPEC 7.8) đặt ở client.** Đồng hồ nằm ở `ReviewPanel` chứ không ở service, vì đó
là thứ người dùng đang nhìn — service giữ timer thì nó phải đoán khi nào giao diện sẵn sàng.
**Gõ vào ô sửa sẽ huỷ đếm ngược**: đang sửa dở mà câu tự bay đi là hỏng việc, mà đó lại đúng
lúc người dùng cần nó nhất.

**Chặn trên số câu treo:** `MAX_PENDING = 32`, bỏ câu **cũ nhất** chứ không từ chối câu mới —
trong hội thoại, câu vừa nói mới là câu người ta còn muốn gửi.

### 4.2. Bốn nút từng bị vô hiệu

| Nút                    | Trước đây                                | Giờ                                                   |
| ---------------------- | ---------------------------------------- | ----------------------------------------------------- |
| Huỷ khi đang nạp model | vô hiệu — `POST /api/models/load` chặn   | `POST /api/models/load/cancel`, dừng ở ranh giới khâu |
| Ô "Tự chọn"            | vô hiệu — "cần API model bên AI service" | preset `custom` + bảng chọn model từng khâu           |
| Tải model từ danh mục  | vô hiệu — "tải model vẫn làm thủ công"   | `POST /api/models/download`                           |
| Xoá lẻ một model       | vô hiệu — service chỉ xoá được tất cả    | `DELETE /api/models/one?path=`                        |

**Huỷ nạp: nói thẳng cái nó KHÔNG làm được.** Dừng ở **ranh giới khâu kế tiếp**, không dừng
được một lượt tải đang chạy — `huggingface_hub` và pywhispercpp tải trong worker thread, mà
thread thì không giết ngang được. Vẫn đáng bấm: chỗ tốn nhất thường là khâu SAU (bấm huỷ trước
khi tới NLLB là tiết kiệm ~2,4 GB). Những khâu đã nạp xong được **giải phóng** khi huỷ — nạp
nửa vời còn tệ hơn không nạp. Trạng thái là `cancelled` chứ không phải `failed`, REST trả
**409** chứ không phải 503: dừng theo yêu cầu không phải lỗi.

**Preset `custom`** là một giá trị trong enum `Preset` thay vì một cờ riêng, nên `preset` vẫn
là bộ chọn duy nhất trong contract. Khâu nào chưa chọn thì lấy theo **Balanced** — mở ô "Tự
chọn" lần đầu ra một cấu hình chạy được chứ không phải biểu mẫu trống. Chỉ đổi được **ASR và
MT**: VAD là ngưỡng endpointing chứ không phải lựa chọn model, còn TTS đã tự định tuyến theo
ngôn ngữ đích.

**Tải một model:** `application/model_download.py` **định tuyến theo tên** rồi gọi lại đúng hàm
tải đã có trong adapter tương ứng. Cố ý không viết lại logic tải: hai đường tải cho cùng một
model là hai chỗ để lệch nhau.

**Xoá một model — chỗ duy nhất phải cẩn thận.** Nhận đường dẫn từ REST rồi `rmtree` là cách
nhanh nhất để xoá nhầm thư mục người dùng. `remove_one()` bắt buộc **cả hai** điều kiện: nằm
trong một `MANAGED_DIRS` (và không phải chính thư mục gốc đó), **và** là thứ `scan()` thật sự
liệt kê. Đường dẫn tuỳ ý, traversal `..`, hay một file lạ nằm đúng thư mục — đều bị từ chối
bằng 400.

---

## 5. Màn Đánh giá trong app + backend ASR thứ ba — 05/09

**Nguồn yêu cầu:** [biên bản GVHD 19/08](meetings/bien-ban-hop-GVHD-2026-08-19.md) mục 3d (Ưu
tiên 2) và mục 7 Ưu tiên 3.

### 5.1. Vì sao không dùng jiwer/sacrebleu trong app

Hai gói đó nằm ở nhóm phụ thuộc `eval`, **không có** trong bản cài của người dùng. Tệ hơn:
tokenizer `flores200` của sacrebleu **tải thêm một model** lần đầu dùng — trái với "cài xong là
chạy offline", thứ là toàn bộ lý do tồn tại của đồ án.

Nên phần tính trong app là Levenshtein + chrF thuần Python (`application/evaluation.py`). Đổi
lại phải nói rõ, và giao diện có nói rõ:

|                                     | Màn Đánh giá trong app              | `make eval-asr` / `make eval-mt`         |
| ----------------------------------- | ----------------------------------- | ---------------------------------------- |
| Độ đo                               | WER/CER + chrF thuần Python         | jiwer + **spBLEU** (tokenizer flores200) |
| Cần mạng                            | không                               | có, lần đầu                              |
| Dùng để                             | thử nhanh, so các cấu hình với nhau | **bảng đưa vào báo cáo**                 |
| So được với số công bố của NLLB-200 | không                               | có                                       |

Bản trong package là **nguồn duy nhất**: `scripts/accuracy.py` bỏ phần chép tay và import từ
đây, `scripts/eval_latency.py` cũng gọi chung hàm `percentile` — cùng một bộ dữ liệu phải ra
cùng một con số p90, dù đọc ở đâu.

### 5.2. Ba điều màn hình phải nói thật

- **Dịch từ câu tham chiếu, không dịch từ đầu ra ASR** — dịch từ cái ASR vừa nghe được thì lỗi
  hai khâu cộng dồn.
- **Câu không có bản ghi thì chạy bằng giọng tổng hợp**, và giọng tổng hợp sạch và đều nên số
  **lạc quan hơn thực tế**. Kết quả trả cờ `hasSyntheticAudio`, màn hình hiện dải cảnh báo
  riêng trước khi người đọc kịp chép con số vào báo cáo.
- **Khai báo `audio` mà sai đường dẫn thì BÁO LỖI**, không lặng lẽ rơi về giọng tổng hợp —
  người chạy sẽ tưởng mình đang có số đo giọng thật.

**Báo p50/p90, không báo trung bình:** người dùng cảm nhận được đúng những câu chậm nhất; trung
bình thì che mất chúng.

### 5.3. Số đo được khi làm, và cái bẫy khi đọc nó

Chạy 2 câu đầu của bộ mẫu trên MacBook (whisper large-v3-turbo-q5 + NLLB-600M): WER 18,8%,
chrF 35,9%, ASR p50/p90 970/1046 ms, MT p50/p90 246/733 ms, RTF p90 1,022.

Cả hai câu đều là **giọng tổng hợp** nên đây chưa phải số dùng được cho báo cáo. Số cho báo cáo
ở [`05` §8](05_bo-danh-gia-fleurs.md). Đừng đặt `RTF p90 1,022` ở đây cạnh `RTF p90 0,395–0,786`
của §8c rồi kết luận hệ thống đã nhanh lên: hai con số khác **phạm vi** (đây là ASR+MT, kia là
cả chuỗi có TTS), khác **model**, và khác cả **dữ liệu**.

Hai điều đáng chú ý: ASR nghe "API" thành "A.V." và "kiểm thử" thành "kiểm thư" — lỗi đúng kiểu
Whisper trên từ mượn và thanh điệu. Và chrF chỉ ~36% dù bản dịch **đúng nghĩa** ("I've completed
the API deployment" so với tham chiếu "I have finished the API implementation") — đây là hành vi
đúng của chrF trên câu ngắn có cách diễn đạt khác, và cũng là lý do bảng báo cáo cần thêm COMET.

### 5.4. faster-whisper — backend thứ ba

Adapter này là stub từ Tuần 3. Giờ hiện thực thật vì hai lý do đều đã đến hạn: **Windows 11 là
một trong hai nền tảng mục tiêu** (ở đó whisper.cpp không có Metal, mà nhân CUDA của nó cũng
không bằng CTranslate2), và thầy giao ở Ưu tiên 3 việc lập bảng so sánh — có ba runtime cho
**cùng một model Whisper** là bảng so sánh sạch nhất có thể.

|          | whisper.cpp        | MLX                      | faster-whisper                     |
| -------- | ------------------ | ------------------------ | ---------------------------------- |
| Engine   | C++ + Metal shader | framework mảng của Apple | CTranslate2                        |
| Thiết bị | Metal / CPU        | Metal (bắt buộc)         | CUDA fp16 / CPU int8               |
| Nền tảng | cả hai             | macOS Apple Silicon      | cả hai, mạnh nhất ở Windows+NVIDIA |
| Gói      | mặc định           | `--extra mlx`            | `--extra ctranslate2`              |

Ba chi tiết khi làm:

- **Tham số giải mã đối xứng** với hai adapter kia. `temperature=(0.0,)` là cách faster-whisper
  tắt fallback: tham số nhận một dãy, đưa đúng một phần tử thì nó không còn nhiệt độ nào để lùi về.
- **VAD riêng của nó: TẮT.** Đoạn vào đây đã do Silero cắt sẵn; cắt thêm lần nữa là bỏ mất phần
  đệm đầu/cuối câu mà khâu VAD cố tình chừa (`speech_pad_ms`).
- **Phải duyệt hết generator trong worker thread.** `transcribe()` trả `(generator, info)` và
  phần giải mã thật sự chạy khi duyệt — trả generator ra ngoài thì phần nặng lại chạy trên event
  loop. Có một test riêng cho chuyện này.

`accel` báo kèm kiểu tính toán (`cuda (float16)`, `cpu (int8)`): cùng một GPU nhưng fp16 và int8
cho hai con số tốc độ khác hẳn, thiếu nó thì bảng đo không đọc được.

---

## 6. Ba lần sửa cùng một chỗ: cách đặt tên và tải model — 06/09

Ba đợt liên tiếp trên màn **Quản lý model**. Gộp lại vì chúng là một chuỗi: đợt đầu sửa cách đặt
tên, đợt hai sửa một lỗi do chính đợt đầu tạo ra, đợt ba sửa thứ mà cả hai đợt trước đều bỏ qua.

### 6.1. Tên model là đường dẫn thật ở thượng nguồn

Danh mục trước đây có **hai hệ tên chồng nhau**, và không nhất quán:

| Khâu               | Danh mục cũ               | Thật ra là                                               |
| ------------------ | ------------------------- | -------------------------------------------------------- |
| ASR whisper.cpp    | `whisper-small-q5`        | file `ggml-small-q5_1.bin` trong `ggerganov/whisper.cpp` |
| ASR MLX            | `mlx-whisper-large-v3`    | repo `mlx-community/whisper-large-v3-asr-fp16`           |
| ASR faster-whisper | `fw-whisper-small`        | repo `Systran/faster-whisper-small`                      |
| MT                 | `nllb-200-distilled-600M` | repo `facebook/nllb-200-distilled-600M`                  |
| DIA                | `pyannote/…-community-1`  | **chính nó** — mục duy nhất đã đúng                      |

Hậu quả đo được:

- **Không tải được bằng đường dẫn thật.** `POST /api/models/download` với
  `mlx-community/whisper-large-v3-asr-fp16` trả lỗi "không biết model", trong khi đó chính là
  chuỗi người dùng đọc được trên HuggingFace.
- **Nhãn "đã tải" của mọi mục whisper.cpp không bao giờ sáng.** Trên đĩa là
  `ggml-large-v3-turbo-q5_0`, danh mục ghi `whisper-large-v3-turbo-q5` — so bằng `===` thì không
  đời nào khớp. Model có sẵn vẫn hiện như chưa tải.

**Cách sửa:** khoá của mọi `MODEL_MAP` giờ là **đường dẫn thật** — HF repo id với
MLX/faster-whisper/NLLB/pyannote, tên file trong repo với GGML (whisper.cpp phân phối theo file
chứ không theo repo con). Giá trị của bảng vẫn là thứ runtime cần: pywhispercpp muốn id rút gọn
nên bảng GGML vẫn là phép ánh xạ thật; ba bảng còn lại thành ánh xạ đồng nhất, tức chúng chỉ còn
đóng vai **danh sách model app biết**. Tên ngoài danh sách vẫn truyền thẳng xuống adapter.

Một chuỗi ấy giờ dùng ở **mọi chỗ**: danh mục hiển thị, ô "Tự chọn", `preset.asr_model` và
`asr_alternatives`, `POST /api/models/download`, `EXPECTED_BYTES`, và (bỏ đuôi `.bin`) chính là
tên `GET /api/models` báo về trên đĩa.

Nhân tiện bỏ `nllb-200-distilled-600M-int8`: mục này trỏ về **đúng repo gốc**, nên preset Fast
quảng cáo "int8" nhưng nạp y hệt Balanced. Đó là một cái tên, không phải một model. Và thêm
`facebook/nllb-200-1.3B` — vốn đã nằm trong danh mục giao diện nhưng **thiếu ở `MODEL_MAP`** nên
chọn hay tải đều không được.

> **Ảnh hưởng tới người đang dùng:** ai đã lưu bộ "Tự chọn" bằng tên cũ trong
> `~/.llvt/settings.json` thì lần chạy tới, tên đó rơi vào nhánh "truyền thẳng" và adapter báo
> lỗi không tìm thấy model. Chọn lại một mục trong ô "Tự chọn" là xong.

### 6.2. Chọn model không phải là nạp model

Ba lỗi cùng một gốc: giao diện cho người dùng _chọn_, còn service hiểu mỗi lần chọn là một mệnh
lệnh _làm ngay_.

**Bấm preset không còn tự nạp model.** Trước, `PUT /api/config {"preset":"fast"}` gọi thẳng
`load_preset()` — bấm thử một preset để xem nó gồm những model gì là đủ để service ngồi nạp 4
khâu, đo thực tế 12,9 giây với model đã có sẵn trên đĩa và hàng phút nếu chưa tải. Nút "Khởi
động model" ngay bên cạnh vì thế thành vô nghĩa. Sau: đổi preset chỉ `unload()` rồi
`select_preset()`, trả về trong **13 ms** với `stages: []`.

Hai test cũ khẳng định hành vi cũ đã được **viết lại theo hợp đồng mới** thay vì sửa cho qua —
chúng đang kiểm đúng thứ vừa cố tình bỏ đi.

**Danh sách model tự chọn phải tách theo runtime.** Trước, `custom.asrModelChoices` là **một**
danh sách phẳng gộp cả 33 model của ba runtime. Người dùng chọn được `mlx_whisper` +
`ggml-tiny-q5_1.bin`; MLX khi đó đi hỏi HuggingFace một repo tên đúng theo nghĩa đen là
`ggml-tiny-q5_1.bin` → 404 → HTTP 500. Ba runtime dùng ba định dạng khác hẳn nhau nên **không có
model nào dùng chung được** — gộp một danh sách là mời người dùng chọn sai.

Sau: `asrModelChoices` thành `dict[adapter → models]`, service từ chối tổ hợp chéo bằng **400**
kèm lời giải thích, và đổi runtime mà không kèm model thì model đang lưu **tự xoá** nếu nó không
thuộc runtime mới.

> Đây là lỗi do chính đợt trước tự tạo ra, kèm một comment giải thích _sai_; ghi lại để đừng gộp
> lại lần nữa.

Còn một nửa nữa chỉ lộ ra khi có test ở mức màn hình: đổi runtime thì bản nháp mới chỉ _bỏ_ model
cũ đi, nên ô model rơi về giá trị service đang giữ — model của runtime **cũ**. Người dùng nhìn
thấy sẵn một tổ hợp không tồn tại đang được chọn, bấm Lưu là ăn 400 mà không hiểu vì sao.

**Tìm kiếm model tải được cả repo ngoài danh mục.** Vì tên model **chính là** đường dẫn thật ở
thượng nguồn (§6.1), gõ đường dẫn để tải là việc tự nhiên nhất người dùng sẽ thử.
`POST /api/models/download` nhận thêm `kind` — thứ service không tự suy ra nổi, vì `org/repo`
nhìn từ ngoài thì repo nào cũng như repo nào, mà nó quyết định model nằm vào thư mục nào và
runtime nào sẽ chạy.

| Tình huống                           | Mã  | Vì sao không phải 503                              |
| ------------------------------------ | --- | -------------------------------------------------- |
| Tên ngoài danh mục, không kèm `kind` | 400 | Thiếu thông tin trong yêu cầu                      |
| Đường dẫn không có trên HF (gõ nhầm) | 404 | Repo đó sẽ không bao giờ tồn tại                   |
| Repo _gated_, chưa được cấp quyền    | 403 | Phải xin quyền trên web, không phải sự cố tạm thời |
| Mất mạng, hết đĩa                    | 503 | Đúng nghĩa "thử lại sau"                           |

Thứ tự `except` có ràng buộc: `GatedRepoError` là **lớp con** của `RepositoryNotFoundError`, đảo
lại thì repo gated bị báo thành "gõ sai đường dẫn".

### 6.3. Tải dở dang không phải là "đã tải"

Tải một model hàng GB bị ngắt giữa chừng vẫn để lại thứ gì đó trên đĩa, và bảng "Model đã tải"
đếm luôn nó. Tệ hơn: **mọi** đường tải trong dự án đều bỏ qua model "đã có", nên bản hỏng đó nằm
lại vĩnh viễn — không có thao tác nào trong app sửa được nó.

Ba việc phải làm, không thay thế được cho nhau.

**(1) Tải xong mới đặt vào chỗ thật.** `whisper.cpp` hỏng nặng nhất:
`pywhispercpp.utils.download_model` ghi thẳng vào đường dẫn cuối cùng và chỉ dọn dẹp khi _bắt
được_ exception — bị kill thì không có exception nào để bắt, nên nó để lại một `.bin` cụt đúng
chỗ file thật, và lần sau chính nó thấy `file_path.exists()` là bỏ qua. `download_ggml()` tải vào
`whisper-cpp/.incomplete/` rồi `os.replace()` sang chỗ thật — nguyên tử trong cùng một phân vùng:
file hoặc chưa có, hoặc đã đủ. sherpa-onnx cũng đổi thành giải nén vào `.incomplete-<voice>/` rồi
đổi tên. Cache HuggingFace vốn đã làm đúng.

**(2) Nhận ra bản dở đã lỡ nằm trên đĩa.** `InstalledModel` mang thêm cờ `complete`. Model dở
**vẫn được liệt kê** — giấu đi thì người dùng thấy đĩa đầy mà không có cách nào xoá — nhưng không
được tính là đã tải ở bất cứ đâu.

Với cache HuggingFace, ba dấu vết theo đúng thứ tự nó có thể chết: còn `.incomplete` mà **blob
đích chưa có**; không revision nào trong `snapshots/` khớp `refs/`; symlink trỏ vào blob không
tồn tại.

Điều kiện đầu ban đầu viết là "có bất kỳ `.incomplete` nào". Thư mục model thật trên máy dev bác
bỏ ngay: `models--facebook--nllb-200-distilled-600M` có hai file `.incomplete` 0 byte nằm cạnh
blob 2,4 GB **đã tải xong** — file tạm của một lượt chết nằm lại vĩnh viễn kể cả sau khi lượt sau
thành công. Đếm cả rác cũ là bắt người dùng tải lại 2,5 GB vô ích.

**Chỗ không bắt được**, nói rõ ra chứ không giấu: chết đúng khe giữa hai file, khi file trước xong
hẳn và file sau chưa kịp tạo `.incomplete`. Biết được nó thiếu thì phải hỏi HuggingFace, tức phải
có mạng, trong khi hàm này chạy cả lúc offline. Đó là lý do phải có việc thứ ba.

**(3) Nút "Tải lại".** `POST /api/models/download` nhận thêm `force: true` — xoá bản đang có rồi
tải lại từ đầu. Không có nó thì một bản hỏng mà máy không nhận ra được là ngõ cụt hoàn toàn.
Model dở hiện nhãn cam "Tải chưa xong" kèm nút "Tải lại"; nút xoá vẫn ở đó — hai lối thoát.

Kiểm chứng trên service thật, thư mục model tạm:

| Việc                                            | Kết quả                                               |
| ----------------------------------------------- | ----------------------------------------------------- |
| Tải `ggml-tiny-q5_1.bin`                        | 200, 32,2 MB, `.incomplete/` không còn sót lại        |
| Giả lập kill giữa chừng (unit test)             | không có `.bin` nào ở thư mục thật, `scan()` trả rỗng |
| Cắt file còn 5 MB rồi tải lại **không** `force` | 200 nhưng vẫn 5,0 MB — đúng cái bug cũ                |
| Cắt file còn 5 MB rồi tải lại **có** `force`    | 32,2 MB                                               |
| Quét thư mục model thật (6 model)               | không có báo nhầm nào                                 |
