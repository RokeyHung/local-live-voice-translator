# Đặt tên model theo đường dẫn thật ở thượng nguồn

**Giai đoạn:** ngoài lịch tuần · **Hiện thực:** 06/09/2026

> Bỏ hẳn lớp tên tự đặt (`whisper-small-q5`, `mlx-whisper-large-v3`, `fw-whisper-small`).
> Một model có **đúng một chuỗi** định danh, và chuỗi đó là đường dẫn thật.

---

## 1. Vấn đề

Danh mục model trước đây có hai hệ tên chồng nhau, và không nhất quán:

| Khâu               | Danh mục hiện                              | Thật ra là                                               |
| ------------------ | ------------------------------------------ | -------------------------------------------------------- |
| ASR whisper.cpp    | `whisper-small-q5`                         | file `ggml-small-q5_1.bin` trong `ggerganov/whisper.cpp` |
| ASR MLX            | `mlx-whisper-large-v3`                     | repo `mlx-community/whisper-large-v3-asr-fp16`           |
| ASR faster-whisper | `fw-whisper-small`                         | repo `Systran/faster-whisper-small`                      |
| MT                 | `nllb-200-distilled-600M`                  | repo `facebook/nllb-200-distilled-600M`                  |
| DIA                | `pyannote/speaker-diarization-community-1` | **chính nó**                                             |

Mục DIA đã dùng đường dẫn thật, mọi mục khác thì không. Hậu quả đo được:

- **Không tải được bằng đường dẫn thật.** `POST /api/models/download` với
  `mlx-community/whisper-large-v3-asr-fp16` trả lỗi "không biết model", trong khi đó
  chính là chuỗi người dùng đọc được trên HuggingFace.
- **Nhãn "đã tải" của mọi mục whisper.cpp không bao giờ sáng.** Trên đĩa là
  `ggml-large-v3-turbo-q5_0`, danh mục ghi `whisper-large-v3-turbo-q5` — so bằng
  `===` thì không đời nào khớp. Model có sẵn vẫn hiện như chưa tải.
- Người đọc phải tự dịch qua lại giữa hai hệ tên mỗi lần đối chiếu với HuggingFace.

## 2. Cách sửa

Khoá của mọi `MODEL_MAP` giờ là **đường dẫn thật**:

- HF repo id với MLX / faster-whisper / NLLB / pyannote.
- Tên file trong repo với GGML (`ggml-small-q5_1.bin`) — whisper.cpp phân phối theo
  file chứ không theo repo con.

Giá trị của bảng vẫn là thứ runtime cần: pywhispercpp muốn id rút gọn
(`small-q5_1`) nên bảng GGML vẫn là một phép ánh xạ thật; ba bảng còn lại thành ánh
xạ đồng nhất, tức chúng chỉ còn đóng vai **danh sách model app biết** — dùng để kiểm
tra tên và dựng ô chọn. Tên ngoài danh sách vẫn truyền thẳng xuống adapter, nên mọi
repo tương thích khác vẫn nạp được.

Một chuỗi ấy giờ dùng ở **mọi chỗ**: danh mục hiển thị, ô "Tự chọn", `preset.asr_model`
và `asr_alternatives`, `POST /api/models/download`, `EXPECTED_BYTES`, và (bỏ đuôi
`.bin`) chính là tên `GET /api/models` báo về trên đĩa.

## 3. Hai thứ bỏ đi

**`nllb-200-distilled-600M-int8`.** Mục này trỏ về **đúng repo gốc** — preset Fast
quảng cáo "int8" nhưng nạp y hệt Balanced. Đó là một cái tên, không phải một model.
Bỏ hẳn; tới lúc thật sự có bản lượng tử hoá thì thêm một repo thật.

**Nhãn "đã tải" so sai.** Giờ so trực tiếp tên danh mục với tên trên đĩa, chỉ chuẩn
hoá đúng một chỗ: bỏ đuôi `.bin` của GGML.

## 4. Thêm vào

`facebook/nllb-200-1.3B` — vốn đã nằm trong danh mục của giao diện nhưng **thiếu ở
`MODEL_MAP`**, nên chọn hay tải đều không được. Giờ dùng thật được (~5,5 GB, chất
lượng cao hơn 600M, đổi lại chậm hơn hẳn).

## 5. Kiểm chứng

Sau khi đổi, chạy service thật:

- `POST /api/models/download` với `ggml-tiny-q5_1.bin` → tải về đúng
  `models_dir/whisper-cpp/ggml-tiny-q5_1.bin`.
- `resolve()` nhận cả sáu dạng đường dẫn thật (GGML, mlx-community, Systran, facebook,
  vits-piper, pyannote).
- Ô "Tự chọn" nhận `mlx-community/whisper-large-v3-asr-fp16` và lưu lại đúng chuỗi đó.
- 280 test pass, ruff sạch, `tsc` sạch.

## 6. Ảnh hưởng tới người đang dùng

Ai đã lưu bộ "Tự chọn" bằng tên cũ trong `~/.llvt/settings.json` thì lần chạy tới,
tên đó rơi vào nhánh "truyền thẳng" và adapter sẽ báo lỗi không tìm thấy model. Chọn
lại một mục trong ô "Tự chọn" là xong — danh sách giờ toàn đường dẫn thật.
