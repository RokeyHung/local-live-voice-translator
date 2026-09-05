# Thêm backend ASR (MLX) và khâu tách người nói (diarization)

**Giai đoạn:** ngoài lịch tuần · **Hiện thực:** 05/09/2026
**Nguồn ý tưởng:** danh mục model của TranscriptionSuite — tài liệu tham khảo [1] của
[`00_project-outline.md`](00_project-outline.md).

> Không thuộc tuần nào trong đề cương. Xuất phát từ một câu hỏi thực tế: tab _Models_
> của TranscriptionSuite liệt kê 43 model, còn danh mục của mình mới có 10 — có gì
> đáng lấy sang không?

---

## 1. Lọc danh mục: 43 model của TS, lấy được bao nhiêu?

Bảng dưới đối chiếu `dashboard/src/services/modelRegistry.ts` của TranscriptionSuite
với ràng buộc của đồ án này (vi ↔ en/ja/zh, chạy cục bộ, gần thời gian thực).

| Họ model trong TS               | Số  | Lấy?   | Lý do                                                                                                  |
| ------------------------------- | --- | ------ | ------------------------------------------------------------------------------------------------------ |
| whisper.cpp (GGML)              | 11  | **Có** | Đúng runtime mình đang chạy. Trước đợt này preset mới dùng 3 biến thể.                                 |
| MLX Whisper (Apple Silicon)     | 12  | **Có** | 99 ngôn ngữ, có vi/ja/zh. Thành backend ASR thứ hai — mục 2.                                           |
| Diarization (pyannote)          | 1   | **Có** | Không nằm trong pipeline dịch, nhưng hợp với màn Nhập tệp — mục 3.                                     |
| Faster Whisper (CTranslate2)    | 10  | Chưa   | Dùng được (vi/ja/zh), nhưng `adapters/asr/faster_whisper.py` vẫn là stub. Để lại cho giai đoạn tối ưu. |
| Parakeet / Canary (NVIDIA NeMo) | 5   | Không  | Chỉ 25 tiếng châu Âu — **không có tiếng Việt, Nhật, Trung**. Vô dụng với đồ án này.                    |
| SenseVoice (FunASR)             | 1   | Không  | zh/en/yue/ja/ko — thiếu đúng tiếng Việt.                                                               |
| VibeVoice (9B)                  | 4   | Không  | 6–18 GB, thiết kế cho xử lý theo lô. Không có cửa chạy gần thời gian thực trên laptop.                 |

Nói cách khác: hơn một nửa danh mục của TS không dùng được ở đây, và lý do luôn là
**ngôn ngữ**, không phải chất lượng model. TS nhắm hội thoại tiếng Anh/châu Âu; đồ án
này bắt buộc phải có tiếng Việt ở một đầu.

### 1.1. Danh mục sau khi mở rộng

`whisper_cpp.MODEL_MAP` giờ có 15 tên (tiny → large-v3, các mức lượng tử hoá q5/q8),
`mlx_whisper.MODEL_MAP` có 12. Danh mục hiển thị ở màn Quản lý model
(`application/presets.ts`) liệt kê đủ cả hai, kèm **dung lượng thật lấy từ API của
HuggingFace** chứ không phải số ước lượng.

Nhân tiện sửa được hai con số sai trong danh mục cũ: `whisper-large-v3-turbo-q5` là
**574 MB** (không phải 809 MB) và `-q8` là **874 MB** (không phải 1,2 GB).

Cố ý **không** đưa vào các biến thể English-only (`small.en`, `medium.en`…) dù
whisper.cpp có: ứng dụng luôn phải nhận cả vi/ja/zh, model English-only sẽ trả rác cho
ba thứ tiếng đó. Ai muốn đo riêng chiều en→vi vẫn đặt thẳng `small.en` vào preset được
— `MODEL_MAP` chỉ là lớp đặt tên, tên lạ được truyền thẳng xuống pywhispercpp.

---

## 2. MLX Whisper — backend ASR thứ hai trên macOS

### 2.1. Vì sao thêm khi đã có whisper.cpp

Cả hai đều chạy Whisper trên GPU Apple, nhưng bằng hai đường khác nhau: whisper.cpp là
C++ với Metal shader tự viết, MLX là framework mảng của Apple dùng unified memory. Câu
"chọn cái nào" phải trả lời bằng số, mà muốn có số thì phải chạy được cả hai. Hai
adapter đứng sau cùng port `SpeechToTextProvider` nên bộ đánh giá ở
[`17_bo-danh-gia-fleurs.md`](17_bo-danh-gia-fleurs.md) chạy được cả hai mà không sửa
pipeline.

Đây cũng đúng là ví dụ "thêm backend mới" mà `ARCHITECTURE.md` mô tả — kiểm chứng rằng
kiến trúc hexagonal không chỉ nằm trên giấy:

- thêm `adapters/asr/mlx_whisper.py`;
- thêm **một dòng** vào `ASR_REGISTRY` của `application/model_manager.py`;
- thêm một dòng `asr_alternatives` cho mỗi preset.

Không đụng tới `application/pipeline.py`, `application/transcribe.py`, transport hay
giao diện.

### 2.2. Đổi runtime mà không đổi mức chất lượng

```bash
make setup-mlx                      # uv sync --extra mlx (chỉ macOS + Apple Silicon)
LLVT_ASR_ADAPTER=mlx_whisper make service
```

Chỗ dễ sai nhất: preset là một **mức** nhanh/chất lượng, không phải một model. Tên
model của hai runtime không thay nhau được (`large-v3-turbo-q5_0` và
`mlx-community/whisper-large-v3-turbo-asr-8bit`), nên `PresetConfig.asr_alternatives`
giữ bảng tương đương và `asr_model(cfg, adapter)` tra sang cột đúng:

| Preset   | whisper.cpp                 | mlx_whisper                     |
| -------- | --------------------------- | ------------------------------- |
| Fast     | `whisper-small-q5`          | `mlx-whisper-small-q8`          |
| Balanced | `whisper-large-v3-turbo-q5` | `mlx-whisper-large-v3-turbo-q8` |
| Quality  | `whisper-large-v3-turbo-q8` | `mlx-whisper-large-v3-turbo`    |

Đặt sai tên adapter thì service **cảnh báo trong log rồi dùng tiếp adapter của preset**,
không chết lúc khởi động.

### 2.3. Hai chi tiết kỹ thuật đáng ghi lại

**Thread affinity.** MLX gắn GPU stream vào chính thread đã tạo ra nó; gọi từ thread
khác thì ném `RuntimeError: There is no stream (gpu,0) in current thread`
([ml-explore/mlx#2133](https://github.com/ml-explore/mlx/issues/2133)).
`SerialExecutor` của mình dùng `asyncio.to_thread`, tức pool mặc định với các worker
thay thế nhau được — `load()` và `transcribe()` gần như chắc chắn rơi vào hai thread
khác nhau. Nên có thêm `PinnedExecutor`: pool đúng một worker, mọi lời gọi ở cùng một
thread, và tuần tự sẵn nên không cần lock. (TranscriptionSuite gặp đúng lỗi này ở
GH #134 và giải bằng một mixin tương đương.)

**Độ tin cậy không cùng đại lượng.** pywhispercpp trả `probability` = trung bình **cộng**
xác suất token của đoạn; mlx-audio chỉ có `avg_logprob`, nên `exp()` của nó là trung
bình **nhân**. Trung bình nhân luôn ≤ trung bình cộng ⇒ cùng một ngưỡng
`LLVT_ASR_MIN_CONFIDENCE` sẽ khắt khe hơn một chút trên MLX. Ghi ra đây để lúc so hai
runtime không kết luận nhầm rằng "MLX kém tự tin hơn".

Ngoài ra tham số giải mã của hai adapter được đặt **đối xứng** (`no_context` ↔
`condition_on_previous_text=False`, tắt fallback nhiệt độ ở cả hai): so hai runtime chỉ
có nghĩa khi chính sách giải mã giống nhau.

---

## 3. Tách người nói — chỉ cho màn Nhập tệp

### 3.1. Vì sao không dùng cho phiên trực tiếp

Không phải vì khó, mà vì **không cần và không đúng**:

- Trong phiên hai chiều, ai nói đã biết sẵn: mic là người dùng, system audio là phía
  bên kia. `AudioSource` của mỗi câu đã mang thông tin đó.
- Model diarization gom cụm giọng trên toàn bộ đoạn âm thanh mới ổn định được danh
  tính. Mỗi câu realtime chỉ dài vài giây, nên `SPEAKER_00` của câu này không có liên
  hệ gì với `SPEAKER_00` của câu sau.

Còn ở màn Nhập tệp thì ngược lại: một bản ghi cuộc họp có nhiều người, cả tệp nằm sẵn
trong RAM, và nhãn người nói là thứ làm bản ghi đọc được.

### 3.2. Kiến trúc

Port riêng `ports/diarization.py` (`SpeakerDiarizer`), **không** nhét vào
`SpeechToTextProvider`: hai bài toán độc lập, đổi model diarization không được đụng tới
ASR. `ProviderSet.diarizer` là `Optional` — bản cài không có diarization vẫn chạy đủ.

Luồng trong `application/transcribe.py`:

```
PCM cả tệp ─┬─► diarize()  → [SpeakerTurn]  → rename_by_first_appearance()
            └─► VAD → ASR → MT (từng đoạn) → label_for(đoạn, turns)
```

`application/speaker_labels.py` là hàm thuần, tách ra vì đây là chỗ hai cách cắt âm
thanh gặp nhau và **chúng không trùng nhau**: VAD cắt theo khoảng lặng (một câu),
diarization cắt theo giọng (một lượt nói, có thể chồng lấn khi hai người nói đè lên
nhau). Nên không tra được theo mốc bắt đầu — phải hỏi "trong khoảng thời gian của câu
này, ai chiếm nhiều thời lượng nhất", và bỏ trống khi không ai chiếm quá 25% (câu rơi
đúng chỗ chuyển lượt). Quy tắc đó kiểm thử được mà không cần tải model gated về
(`tests/test_speaker_labels.py`, 10 test).

Nhãn model đặt (`SPEAKER_03`) được đánh số lại theo **thứ tự ai lên tiếng trước** →
`speaker-1`, `speaker-2`. Service trả về **mã**, không trả câu chữ: lịch sử là dữ liệu
lưu lâu dài, người dùng đổi ngôn ngữ giao diện thì bản ghi cũ phải đổi theo chứ không
được đóng băng tiếng Việt trong SQLite. Giao diện dựng chữ ở
`application/speakers.ts`.

### 3.3. Điều kiện cần — nói thẳng vì nó đi ngược mục tiêu "hoàn toàn cục bộ"

Mặc định **TẮT**, và đây là lý do:

1. `pyannote/speaker-diarization-community-1` là repo **gated**: phải đồng ý điều khoản
   trên huggingface.co và có access token thì mới tải được. Token chỉ dùng cho **lần
   tải đầu tiên**; sau đó model (~33 MB) nằm trên đĩa và chạy offline như mọi model
   khác — nhưng vẫn là một bước cần mạng và cần tài khoản.
2. `pyannote.audio` kéo theo torchaudio/lightning/optuna — vài trăm MB phụ thuộc cho
   một tính năng của một màn hình.

```bash
make setup-diarization
export LLVT_HF_TOKEN=hf_xxx          # chỉ cần cho lần tải đầu
export LLVT_DIARIZATION_ENABLED=true
make service
```

Bật rồi thì nút "Phân biệt người nói" ở màn Nhập tệp mới bấm được (bật/tắt cho từng
lượt nhập, vì khâu này tốn thêm một lượt quét cả tệp). Chưa bật thì nút giữ nguyên chỗ
nhưng vô hiệu kèm lý do — đúng nguyên tắc "không giả lập bằng dữ liệu bịa" của
[`08_week6-desktop.md`](08_week6-desktop.md).

### 3.4. Hỏng thì xuống nước, không kéo cả ứng dụng theo

Hai chỗ cố tình không ném lỗi ra ngoài:

- **Nạp model hỏng** (thiếu token, chưa cài `--extra diarization`): khâu `DIA` bị đánh
  dấu `failed` trên thanh tiến trình kèm lý do, còn bốn khâu của pipeline dịch vẫn nạp
  bình thường. Mất một tính năng phụ không phải lý do để cả ứng dụng dịch ngừng chạy.
- **Chạy hỏng giữa chừng** (hết VRAM…): bỏ nhãn người nói, giữ nguyên bản ghi. Bản ghi
  không có nhãn vẫn dùng được; không có bản ghi thì không.

---

## 4. Những thứ phải sửa kèm

| Chỗ                               | Thay đổi                                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `adapters/persistence/sqlite.py`  | Thêm cột `utterances.speaker` + cơ chế nâng cấp schema bằng `PRAGMA user_version` (v1 → v2). File lịch sử cũ của người dùng phải giữ nguyên dữ liệu — `create_all` bỏ qua bảng đã tồn tại nên không bơm được cột mới.                |
| `application/installed_models.py` | Quét thêm `mlx-whisper/` và `pyannote/` (cả hai dùng bố cục cache HuggingFace), và cho `DELETE /api/models` xoá đúng chúng.                                                                                                          |
| Contract REST                     | `GET /api/config` → `diarizationEnabled`; `POST /api/transcribe?diarize=`; `TranscriptSegment.speaker`, `TranscriptionResponse.speakerCount`; `TranscribeProgress.phase`; `UtteranceSchema.speaker`. Mirror TypeScript cập nhật kèm. |
| Thanh tiến trình nhập tệp         | Diarization chạy trên cả tệp **trước** khi nhận dạng chữ, nên `percent` đứng ở 0 suốt quãng đó. Thêm `phase` để giao diện ghi "Đang tách người nói…" thay vì trông như treo.                                                         |
| `Stage` (cả hai phía)             | Thêm `'DIA'` — khâu này chỉ xuất hiện trong `stages` khi diarization thật sự đang nạp.                                                                                                                                               |

---

## 5. Kiểm thử

43 test mới, không test nào cần tải model về:

| File                         | Số  | Kiểm gì                                                                        |
| ---------------------------- | --- | ------------------------------------------------------------------------------ |
| `test_speaker_labels.py`     | 10  | Quy tắc gán nhãn: đa số thời lượng, lượt chồng lấn, hoà nhau, ngưỡng tối thiểu |
| `test_asr_mlx.py`            | 14  | Ánh xạ tên model, vòng đời, tham số giải mã, quy đổi độ tin cậy                |
| `test_asr_backend_switch.py` | 8   | `LLVT_ASR_ADAPTER`, tra model theo runtime, mọi preset đều có cột MLX          |
| `test_diarization.py`        | 6   | Gắn nhãn end-to-end, xuống nước khi hỏng, đọc kết quả pyannote, `phase`        |
| `test_history_migration.py`  | 4   | Mở file SQLite schema v1 → bơm cột, giữ nguyên dữ liệu, mở lại nhiều lần       |
| `test_model_load_failure.py` | +1  | Khâu DIA hỏng vẫn nạp đủ bốn khâu dịch, và lý do vẫn hiện được                 |

Tổng: **184 passed, 4 skipped**.

Ngoài test, đã chạy thử service thật với `LLVT_DIARIZATION_ENABLED=true` mà **không** có
token: HuggingFace trả 401 cho repo gated, khâu `DIA` bị đánh dấu `failed` kèm nguyên
văn hướng dẫn của pyannote trong `error`, và `POST /api/models/load` vẫn trả **200** với
đủ bốn khâu VAD/ASR/MT/TTS đã nạp (thiết bị thật: Metal cho whisper.cpp, mps cho NLLB).
Đúng hành vi mong muốn ở mục 3.4.

## 6. Còn lại

- [ ] Chạy thử MLX với model thật trên máy Apple Silicon và **đo WER/RTF so với
      whisper.cpp** — đây mới là lý do thêm backend này. Bổ sung vào bảng của
      [`17_bo-danh-gia-fleurs.md`](17_bo-danh-gia-fleurs.md).
- [ ] Chạy thử diarization trên một bản ghi họp nhiều người thật, kiểm nhãn có khớp
      người nói không.
- [ ] `faster_whisper` vẫn là stub. Nếu cần chạy trên Windows + NVIDIA thì đây là backend
      thứ ba, đã có sẵn chỗ trong `ASR_REGISTRY` và `asr_alternatives`.
