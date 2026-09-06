# 23 — Chọn model không phải là nạp model

Ba lỗi ở màn **Quản lý model**, cùng một gốc: giao diện cho người dùng _chọn_, còn
service thì hiểu mỗi lần chọn là một mệnh lệnh _làm ngay_. Ghi lại ở đây vì cả ba đều
đổi hành vi mà người dùng nhìn thấy, và một trong ba đổi cả hợp đồng REST.

## 1. Bấm preset không còn tự nạp model

**Trước:** `PUT /api/config {"preset":"fast"}` gọi thẳng `ModelManager.load_preset()`.
Bấm thử một preset để xem nó gồm những model gì là đủ để service ngồi nạp 4 khâu —
đo thực tế 12,9 giây với model đã có sẵn trên đĩa, và hàng phút nếu chưa tải. Nút
"Khởi động model" ngay bên cạnh vì thế thành ra vô nghĩa: tới lúc bấm được nó thì
model đã nạp xong rồi.

**Sau:** đổi preset chỉ `unload()` rồi `select_preset()` — _ghi nhận lựa chọn_, không
nạp gì. Nạp là việc của đúng một chỗ: nút "Khởi động model" (`POST /api/models/load`).
Điều này khớp với thiết kế đã có từ trước (`docs/11`): model nạp theo yêu cầu, không
nạp lúc khởi động, và `stages: []` là tín hiệu "chưa có gì trong bộ nhớ".

Kiểm chứng: `PUT /api/config {"preset":"fast"}` giờ trả về trong 13 ms với
`stages: []`.

Hai test cũ khẳng định hành vi cũ (`test_config_stages_follow_preset_change`,
`test_unload_frees_models_but_keeps_preset_choice`) đã được viết lại theo hợp đồng
mới thay vì sửa cho qua — chúng đang kiểm đúng thứ mà ta vừa cố tình bỏ đi.

## 2. Danh sách model tự chọn phải tách theo runtime

**Trước:** `GET /api/config` trả về `custom.asrModelChoices` là **một** danh sách
phẳng gộp cả 33 model của ba runtime. Người dùng chọn được `mlx_whisper` +
`ggml-tiny-q5_1.bin`; MLX khi đó đi hỏi HuggingFace một repo tên đúng theo nghĩa đen
là `ggml-tiny-q5_1.bin` → 404 → HTTP 500. Nghĩa là "tự chọn model" trông thì chọn
được, nhưng phần lớn tổ hợp chọn ra là không tồn tại.

Ba runtime dùng ba định dạng khác hẳn nhau — GGML là _file_ trong
`ggerganov/whisper.cpp`, MLX và CTranslate2 là _repo_ đã chuyển đổi sẵn — nên **không
có model nào dùng chung được**. Gộp một danh sách là mời người dùng chọn sai.

**Sau:**

- `asrModelChoices` đổi thành `dict[str, list[str]]`, khoá là tên adapter
  (`whisper_cpp` 15 model, `mlx_whisper` 12, `faster_whisper` 6).
- Service từ chối tổ hợp chéo bằng **400** kèm lời giải thích, thay vì để nó chết ở
  lúc nạp.
- Đổi runtime mà không kèm model thì model đang lưu **tự xoá** nếu nó không thuộc
  runtime mới — không để lại một lựa chọn chết trong `~/.llvt/settings.json`.
- Giao diện lọc dropdown theo runtime đang chọn (`pickedAdapter`) và xoá bản nháp
  model khi runtime đổi.

Đây là lỗi do chính đợt trước tự tạo ra, kèm một comment giải thích _sai_; ghi lại để
đừng gộp lại lần nữa.

## 3. Tìm kiếm model tải được cả repo ngoài danh mục

**Trước:** ô tìm kiếm chỉ lọc trong danh mục dựng sẵn. Gõ một đường dẫn HuggingFace
bất kỳ thì ra danh sách rỗng, không có lối nào tải nó về — trong khi từ `docs/22`,
tên model **chính là** đường dẫn thật ở thượng nguồn, nên gõ đường dẫn để tải là việc
tự nhiên nhất người dùng sẽ thử.

**Sau:** `POST /api/models/download` nhận thêm `kind`
(`whisper_cpp` | `mlx` | `faster_whisper` | `nllb` | `pyannote`). Có `kind` thì tên
nằm ngoài danh mục cũng tải được: `kind` là thứ service không tự suy ra nổi —
`org/repo` nhìn từ ngoài thì repo nào cũng như repo nào, mà nó quyết định model nằm
vào thư mục nào và runtime nào sẽ chạy.

Giao diện: khi truy vấn không khớp danh mục nhưng _nhìn giống_ một đường dẫn model
(`org/repo` hoặc `ggml-*.bin`), hiện thêm một dòng "tải từ HuggingFace" kèm ô chọn
runtime — đoán sẵn từ dạng đường dẫn, người dùng đổi được.

Mã lỗi trả về, theo đúng loại hỏng:

| Tình huống                           | Mã  | Vì sao không phải 503                              |
| ------------------------------------ | --- | -------------------------------------------------- |
| Tên ngoài danh mục, không kèm `kind` | 400 | Thiếu thông tin trong yêu cầu                      |
| Đường dẫn không có trên HF (gõ nhầm) | 404 | Repo đó sẽ không bao giờ tồn tại                   |
| Repo _gated_, chưa được cấp quyền    | 403 | Phải xin quyền trên web, không phải sự cố tạm thời |
| Mất mạng, hết đĩa                    | 503 | Đúng nghĩa "thử lại sau"                           |

Thứ tự `except` có ràng buộc: `GatedRepoError` là **lớp con** của
`RepositoryNotFoundError`, đảo lại thì repo gated bị báo thành "gõ sai đường dẫn".
