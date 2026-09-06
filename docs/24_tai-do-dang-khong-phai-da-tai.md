# 24 — Tải dở dang không phải là "đã tải"

Tải một model hàng GB bị ngắt giữa chừng (đóng app, rớt mạng, hết pin) vẫn để lại
thứ gì đó trên đĩa, và bảng "Model đã tải" đếm luôn nó. Người dùng thấy model có
sẵn, chỉ nhỏ hơn bình thường; bấm nạp thì nhận một lỗi runtime chẳng nhắc gì tới
việc tải. Tệ hơn: **mọi** đường tải trong dự án đều bỏ qua model "đã có", nên bản
hỏng đó nằm lại vĩnh viễn — không có thao tác nào trong app sửa được nó.

Ba việc phải làm, không thay thế được cho nhau: đừng để lại bản dở nữa (1), nhận
ra bản dở đã lỡ có (2), và cho một lối thoát khi không nhận ra được (3).

## 1. Tải xong mới đặt vào chỗ thật

`whisper.cpp` là chỗ hỏng nặng nhất. `pywhispercpp.utils.download_model` ghi thẳng
vào đường dẫn cuối cùng và chỉ dọn dẹp khi _bắt được_ exception — bị kill thì không
có exception nào để bắt, nên nó để lại một `.bin` cụt đúng chỗ file thật. Lần sau
chính nó thấy `file_path.exists()` là bỏ qua. Model hỏng vĩnh viễn mà nhìn vẫn như
đã tải.

`download_ggml()` (trong adapter, cạnh chỗ đã biết cách tải) tải vào
`whisper-cpp/.incomplete/` rồi `os.replace()` sang chỗ thật. `os.replace` trong
cùng một phân vùng là nguyên tử: file hoặc chưa có, hoặc đã đủ. `_default_loader`
cũng gọi nó trước khi dựng `Model()`, nếu không thì đường _nạp_ vẫn để lại file cụt
như cũ.

sherpa-onnx giải nén thẳng vào `sherpa-tts/`, nên đứt giữa lúc giải nén để lại thư
mục voice thiếu file. Đổi thành giải nén vào `.incomplete-<voice>/` rồi đổi tên.

Cache HuggingFace (MLX, faster-whisper, NLLB, pyannote) vốn đã làm đúng: tải vào
`blobs/<sha>.incomplete` rồi mới đổi tên. Không đụng vào.

## 2. Nhận ra bản dở đã lỡ nằm trên đĩa

`InstalledModel` mang thêm cờ `complete`, `GET /api/models` trả nó ra. Model dở
**vẫn được liệt kê** — giấu đi thì người dùng thấy đĩa đầy mà không có cách nào xoá
— nhưng không được tính là đã tải ở bất cứ đâu.

Với cache HuggingFace, ba dấu vết theo đúng thứ tự nó có thể chết:

1. còn `.incomplete` mà **blob đích chưa có** — chết giữa lúc tải một file;
2. không revision nào trong `snapshots/` khớp `refs/` — chết trước khi xong file đầu;
3. symlink trong snapshot trỏ vào blob không tồn tại — cache bị xoá tay một nửa.

Điều kiện (1) ban đầu tôi viết là "có bất kỳ `.incomplete` nào". Thư mục model thật
trên máy dev bác bỏ ngay: `models--facebook--nllb-200-distilled-600M` có hai file
`sha.<mã>.incomplete` 0 byte nằm cạnh blob 2,4 GB **đã tải xong**. File tạm của một
lượt chết nằm lại vĩnh viễn, kể cả sau khi lượt sau thành công — đếm cả rác cũ là
bắt người dùng tải lại 2,5 GB vô ích. Phải xem blob đích đã có chưa.

Điều kiện (2) cũng vậy: cache đó giữ thêm một revision mới hơn chỉ mới tải được mỗi
`model.safetensors`. Nó không phải model hỏng — `refs/main` trỏ sang revision đủ, và
đó mới là cái lúc nạp sẽ đọc. Chỉ revision được `refs/` trỏ tới mới quyết định.

sherpa-onnx và Kokoro tải ra `<tên>.tmp` rồi mới đổi tên, nên còn `.tmp` là còn dở.

**Chỗ không bắt được**, nói rõ ra chứ không giấu: chết đúng khe giữa hai file, khi
file trước xong hẳn và file sau chưa kịp tạo `.incomplete`. Repo thiếu hẳn một file
mà trên đĩa không để lại dấu vết nào; biết được nó thiếu thì phải hỏi HuggingFace,
tức là phải có mạng, trong khi hàm này chạy cả lúc offline. Tương tự, một `.bin` bị
cắt cụt _từ trước_ khi có staging thì không có cách nào nhận ra. Đó là lý do phải có
mục 3.

## 3. Nút "Tải lại"

`POST /api/models/download` nhận thêm `force: true` — xoá bản đang có rồi tải lại từ
đầu. Không có nó thì một bản hỏng mà máy không nhận ra được là ngõ cụt hoàn toàn.

Giao diện: model dở hiện nhãn cam **"Tải chưa xong"** kèm nút **"Tải lại"** ngay
cạnh, thay cho nhãn "Đã nạp / Chưa nạp". Nút xoá vẫn ở đó — hai lối thoát, người
dùng chọn. Danh mục bên phải cũng thôi gắn nhãn xanh "Đã tải" cho bản dở, nên nút
Tải của nó hiện lại đúng lúc cần nhất.

`GET /api/models` trả tên GGML **không** có `.bin` (nó là `Path.stem`), nên nút Tải
lại gửi lên đúng chuỗi đó. `resolve()` nhận cả hai dạng thay vì bắt giao diện tự
chắp lại đuôi file — cùng một model thì không nên có hai cái tên tuỳ theo nó đến từ
danh mục hay từ danh sách trên đĩa.

## Kiểm chứng

Trên service thật, thư mục model tạm:

| Việc                                            | Kết quả                                               |
| ----------------------------------------------- | ----------------------------------------------------- |
| Tải `ggml-tiny-q5_1.bin`                        | 200, 32,2 MB, `.incomplete/` không còn sót lại        |
| Giả lập kill giữa chừng (unit test)             | không có `.bin` nào ở thư mục thật, `scan()` trả rỗng |
| Cắt file còn 5 MB rồi tải lại **không** `force` | 200 nhưng vẫn 5,0 MB — đúng cái bug cũ                |
| Cắt file còn 5 MB rồi tải lại **có** `force`    | 32,2 MB                                               |
| Quét thư mục model thật (6 model)               | không có báo nhầm nào                                 |
