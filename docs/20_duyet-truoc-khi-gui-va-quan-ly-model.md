# Duyệt trước khi gửi + bốn nút quản lý model từng bị vô hiệu

**Giai đoạn:** ngoài lịch tuần · **Hiện thực:** 05/09/2026
**Nguồn yêu cầu:** SPEC 7.10 / 7.8 và bản thiết kế giao diện (docs/08).

> Đợt này đóng nốt nhóm tính năng **đã có chỗ trong giao diện hoặc trong contract
> nhưng chưa có backend**. Rà lại toàn bộ `DisabledButton`, `notSupported` và các
> giá trị enum không ai phát ra thì còn đúng năm chỗ — tất cả nằm ở đây.

---

## 1. Chỉnh sửa trước khi gửi (SPEC 7.10)

Đây là chỗ đáng chú ý nhất vì nó là một **yêu cầu chức năng có số hiệu** trong SPEC,
không phải một nút phụ: `WaitingForConfirmation` đã nằm trong `PipelineState` của cả
hai phía từ tuần 6, nhưng **không chỗ nào phát ra nó** — pipeline đi thẳng
recognizing → translating → synthesizing → completed.

### 1.1. Dừng ở đâu, và vì sao chỉ một chiều

`TranslationPipeline` giờ tách bước tổng hợp giọng ra thành `_speak()`. Bật `review`
thì luồng dừng **sau khâu MT**, treo câu lại và báo `WaitingForConfirmation`; TTS chỉ
chạy khi client gửi `control.confirm`. Cái phát ra micro ảo vì thế đúng là cái người
dùng đã duyệt.

Chỉ áp cho chiều **outgoing**: câu của phía bên kia không phải của mình mà sửa, và
chiều incoming vốn không tổng hợp giọng nên chẳng có gì để duyệt. `review and
synthesize` trong hàm dựng nói thẳng điều đó, không để người gọi tự nhớ.

### 1.2. Ba quyết định về dữ liệu

**Ghi lịch sử ngay lúc treo, không đợi bấm gửi.** App tắt giữa lúc đang treo thì câu
đã dịch vẫn còn, chỉ mất việc chưa đọc ra. Bấm gửi sẽ ghi đè (upsert) kèm `tts_ms`.

**Bản đã sửa ghi đè bản dịch máy trong lịch sử.** Cái được gửi đi mới là cái đáng lưu;
giữ bản máy dịch rồi vứt bản người sửa là ghi sai sự thật.

**Bỏ một câu vẫn giữ nó trong lịch sử.** Người dùng quyết định không gửi cũng là một
sự việc có thật của cuộc họp. Dấu hiệu nhận biết là `ttsMs` rỗng. (Cân nhắc thêm một
giá trị `UtteranceStatus` riêng nhưng không làm: nó lan ra contract + DB + giao diện
cho một thông tin đã suy ra được.)

### 1.3. Đếm ngược (SPEC 7.8) đặt ở client

SPEC yêu cầu "có thời gian đếm ngược ngắn trước khi gửi, nếu chức năng xác nhận được
bật". Đồng hồ nằm ở `ReviewPanel` chứ không ở service, vì đó là thứ người dùng đang
nhìn — service giữ timer thì nó phải đoán khi nào giao diện sẵn sàng.

**Gõ vào ô sửa sẽ huỷ đếm ngược.** Đang sửa dở mà câu tự bay đi là hỏng việc, mà đó
lại đúng lúc người dùng cần nó nhất. Đặt được 0/3/5/10 giây ở màn Cài đặt; 0 là chờ
mãi.

### 1.4. Chặn trên số câu treo

`MAX_PENDING = 32`. Người dùng bỏ đi giữa chừng ở chế độ tự động thì hàng đợi phình
mãi. Bỏ câu **cũ nhất** chứ không từ chối câu mới: trong hội thoại, câu vừa nói mới là
câu người ta còn muốn gửi.

---

## 2. Bốn nút quản lý model

| Nút                    | Trước đây                                | Giờ                                                   |
| ---------------------- | ---------------------------------------- | ----------------------------------------------------- |
| Huỷ khi đang nạp model | vô hiệu — `POST /api/models/load` chặn   | `POST /api/models/load/cancel`, dừng ở ranh giới khâu |
| Ô "Tự chọn"            | vô hiệu — "cần API model bên AI service" | preset `custom` + bảng chọn model từng khâu           |
| Tải model từ danh mục  | vô hiệu — "tải model vẫn làm thủ công"   | `POST /api/models/download`                           |
| Xoá lẻ một model       | vô hiệu — service chỉ xoá được tất cả    | `DELETE /api/models/one?path=`                        |

### 2.1. Huỷ nạp: nói thẳng cái nó KHÔNG làm được

Dừng ở **ranh giới khâu kế tiếp**, không dừng được một lượt tải đang chạy —
`huggingface_hub` và pywhispercpp tải trong worker thread, mà thread thì không giết
ngang được. Vẫn đáng bấm: chỗ tốn nhất thường là khâu SAU (bấm huỷ trước khi tới NLLB
là tiết kiệm ~2,4 GB). Cùng cách làm với huỷ nhập tệp (docs/16), nên hành vi nhất
quán.

Những khâu đã nạp xong được **giải phóng** khi huỷ: nạp nửa vời còn tệ hơn không nạp.
Trạng thái khâu là `cancelled` chứ không phải `failed`, và REST trả **409** chứ không
phải 503 — dừng theo yêu cầu không phải lỗi, giao diện không được hiện báo đỏ.

### 2.2. Preset `custom`

Thêm một giá trị vào enum `Preset` thay vì một cờ riêng: `preset` vẫn là bộ chọn duy
nhất trong contract. Lựa chọn cụ thể nằm ở `~/.llvt/settings.json`, nên `custom` không
phải một bộ model cố định mà đọc lại mỗi lần dựng.

Khâu nào chưa chọn thì lấy theo **Balanced** — mở ô "Tự chọn" lần đầu ra một cấu hình
chạy được chứ không phải biểu mẫu trống. Đổi mỗi runtime ASR mà không chọn model thì
tra sang `asr_alternatives` để lấy model MLX **tương đương** của Balanced, chứ không
giữ tên GGML mà MLX không hiểu.

Danh sách lựa chọn do service cấp (`custom.asrAdapterChoices`…), lấy thẳng từ
`ASR_REGISTRY` và các `MODEL_MAP` — thêm một adapter là ô chọn tự có thêm mục, không
phải sửa hai nơi. `faster_whisper` bị loại khỏi danh sách vì còn là stub: mời người
dùng chọn một thứ chắc chắn hỏng thì thà đừng mời.

Chỉ đổi được **ASR và MT**. VAD và TTS theo Balanced: VAD là ngưỡng endpointing chứ
không phải lựa chọn model, còn TTS đã tự định tuyến theo ngôn ngữ đích
(`LanguageRoutedTts`) nên không có gì để chọn.

### 2.3. Tải một model

`application/model_download.py` **định tuyến theo tên** rồi gọi lại đúng hàm tải đã có
trong adapter tương ứng (pywhispercpp `download_model`, `snapshot_download`,
`_download_voice` của sherpa, `_download_model` của Kokoro). Cố ý không viết lại logic
tải: hai đường tải cho cùng một model là hai chỗ để lệch nhau.

Tên lạ bị từ chối **trước khi** gọi mạng (400). Tải hỏng trả 503 — mất mạng là lỗi môi
trường, không phải lỗi của request.

### 2.4. Xoá một model — chỗ duy nhất phải cẩn thận

Nhận đường dẫn từ REST rồi `rmtree` là cách nhanh nhất để xoá nhầm thư mục người dùng.
`remove_one()` bắt buộc **cả hai** điều kiện: nằm trong một `MANAGED_DIRS` (và không
phải chính thư mục gốc đó), **và** là thứ `scan()` thật sự liệt kê. Đường dẫn tuỳ ý,
traversal `..`, hay một file lạ nằm đúng thư mục — đều bị từ chối bằng 400. Có sáu test
riêng cho phần này.

---

## 3. Kiểm thử

27 test mới (**243 passed, 4 skipped**):

| File                        | Số  | Kiểm gì                                                                         |
| --------------------------- | --- | ------------------------------------------------------------------------------- |
| `test_review.py`            | 14  | Không phát giọng khi chưa duyệt, gửi bản đã sửa, bỏ, bấm hai lần, trần hàng đợi |
| `test_model_catalog_api.py` | 16  | Cờ huỷ, đánh dấu `cancelled`, định tuyến tải, và sáu test chặn xoá nhầm         |
| `test_custom_preset.py`     | 11  | Rơi về Balanced, tra model theo runtime, kiểm tên với registry                  |

Đã chạy thật đầu-cuối trên service: tải `whisper-tiny-q5` (32 MB) về đúng
`models_dir/whisper-cpp/`, `GET /api/models` thấy nó với dung lượng thật, xoá đúng nó
rồi danh sách rỗng lại. Tên lạ → 400, `/etc/passwd` → 400, huỷ lúc rảnh → 204.

## 4. Còn lại

- [ ] Chạy thử "duyệt trước khi gửi" trong một cuộc họp thật: đếm ngược 5 giây có đủ
      để đọc và sửa không, hay phải dài hơn.
- [ ] Nút Huỷ nạp mới chỉ thử được ở mức "không có gì đang chạy thì trả 204". Muốn thử
      đúng đường dừng-giữa-chừng thì phải xoá model đi rồi bấm nạp lại.
