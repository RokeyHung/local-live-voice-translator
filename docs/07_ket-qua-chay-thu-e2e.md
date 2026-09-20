# Kết quả chạy thử đầu-cuối trên máy thật

Bài chạy tự động trên **ứng dụng Electron đã đóng gói** + **AI service thật**, dùng
đúng preset **Tự chọn** đang lưu trong `~/.llvt/settings.json`. Không có bước nào làm
bằng tay, không có con số nào chép tay: mọi thứ trong tài liệu này do
`apps/desktop/e2e/report.e2e.ts` sinh ra và ghi vào `e2e-artifacts/report.json`.

Chạy lại:

```bash
make e2e                      # cả bộ, gồm bài chạy này
# hoặc chỉ bài lấy số liệu, trên thư mục model khác:
cd apps/desktop
LLVT_REAL_MODELS_DIR=/đường/dẫn npx playwright test report.e2e.ts
```

Kết quả: **6/6 đạt trong 1 phút 12 giây**, không dòng lỗi nào trong console renderer.

## 1. Điều kiện chạy

| Hạng mục          | Giá trị                                                                                |
| ----------------- | -------------------------------------------------------------------------------------- |
| Ngày chạy         | 06/09/2026                                                                             |
| Nền tảng          | macOS, Darwin arm64 (Apple Silicon), 10 lõi logic                                      |
| Phiên bản service | 0.1.0                                                                                  |
| Thư mục model     | `/Volumes/havi/project/models`                                                         |
| Preset            | **Tự chọn** (custom)                                                                   |
| ASR               | `mlx-community/whisper-large-v3-turbo-asr-fp16` — runtime **MLX**, chạy trên **Metal** |
| MT                | `facebook/nllb-200-distilled-600M` — transformers, chạy trên **MPS**                   |
| VAD               | Silero VAD (CPU)                                                                       |
| TTS               | sherpa-onnx (vi/en/zh) + Kokoro (ja), CPU                                              |

RAM báo về là 8 GB nhưng đó là **trần Chromium áp cho `navigator.deviceMemory`**,
không phải RAM thật của máy — đừng trích con số này vào báo cáo.

## 2. Nạp model

Bấm một preset **không** nạp model; nạp chỉ xảy ra khi bấm "Khởi động model". Đo từ
lúc bấm nút tới lúc cả bốn khâu báo đã nạp, với model đã nằm sẵn trên đĩa:

**13,2 giây** cho cả bốn khâu.

| Khâu | Adapter                 | Model                                         | Thiết bị |
| ---- | ----------------------- | --------------------------------------------- | -------- |
| VAD  | silero                  | silero-vad                                    | CPU      |
| ASR  | mlx_whisper             | mlx-community/whisper-large-v3-turbo-asr-fp16 | Metal    |
| MT   | nllb                    | facebook/nllb-200-distilled-600M              | MPS      |
| TTS  | sherpa_onnx + kokoro_ja | nạp lười theo ngôn ngữ                        | CPU      |

TTS báo "chưa nạp voice nào" là **đúng thiết kế**, không phải lỗi: voice chỉ được nạp
khi có câu đầu tiên cần đọc ra ngôn ngữ đó, nên một phiên vi→en không phải tốn bộ nhớ
cho giọng Nhật.

Model trên đĩa lúc chạy: 8 model, **tất cả đều `complete: true`** (không có bản tải dở).
Tổng khoảng 10,6 GB, trong đó NLLB-600M 4,94 GB và Whisper large-v3-turbo fp16 1,62 GB.

Riêng lượt tải model ASR nói trên: **1,62 GB trong 3 phút 09 giây**.

## 3. Độ trễ từng khâu — đủ sáu chiều

Đo bằng `POST /api/benchmark` với một câu mẫu 3 giây, chạy sau khi model đã được làm
nóng. Đo **cả sáu chiều** chứ không suy từ một chiều: Whisper và NLLB không đối xứng,
chiều này nhanh không có nghĩa chiều kia cũng vậy.

| Chiều | VAD | ASR | MT  | TTS | **Tổng**  |
| ----- | --- | --- | --- | --- | --------- |
| vi→en | 46  | 897 | 521 | 127 | **1.592** |
| en→vi | 46  | 780 | 542 | 134 | **1.503** |
| vi→ja | 50  | 897 | 425 | 767 | **2.141** |
| ja→vi | 46  | 787 | 541 | 153 | **1.528** |
| vi→zh | 47  | 895 | 559 | 862 | **2.364** |
| zh→vi | 48  | 843 | 610 | 172 | **1.674** |

_(đơn vị: mili-giây)_

Đối chiếu mốc SPEC 14.1:

| Mốc SPEC                        | Yêu cầu    | Đo được       | Kết luận |
| ------------------------------- | ---------- | ------------- | -------- |
| ASR một câu ngắn                | < 1.500 ms | 780 – 897 ms  | ✅ đạt   |
| Dịch văn bản                    | < 1.000 ms | 425 – 610 ms  | ✅ đạt   |
| TTS                             | < 1.500 ms | 127 – 862 ms  | ✅ đạt   |
| Tổng độ trễ outgoing (trung vị) | < 4 s      | 1,59 – 2,36 s | ✅ đạt   |

Hai chiều **vi→ja** và **vi→zh** tốn thêm ~700 ms, toàn bộ nằm ở khâu TTS: tiếng Nhật
đi qua Kokoro + G2P OpenJTalk, tiếng Trung qua `sherpa-onnx-vits-zh-ll` kèm từ điển
jieba — cả hai đều nặng hơn Piper của vi/en. Chiều ngược lại (ja→vi, zh→vi) đọc ra
tiếng Việt nên trở về mức ~150 ms.

Con số này **chưa gồm** thời gian VAD chờ hết câu (SPEC cho < 700 ms) và độ trễ thu/phát
âm thanh của hệ điều hành, vì `POST /api/benchmark` đo từ mẫu âm thanh có sẵn.

## 4. Chất lượng — WER/CER + chrF, đủ sáu chiều

Chạy qua đúng nút "Chạy đánh giá" trên màn Đánh giá, bộ mẫu 22 câu đi kèm ứng dụng.

**Tổng hợp:** tỷ lệ lỗi nhận dạng **6,7 %** · chrF **43,9 %** · ASR p50 **819 ms** /
p90 **856 ms** · dịch p90 **396 ms** · tổng p90 **1.227 ms** · **RTF p90 0,818**
(< 1 nghĩa là xử lý nhanh hơn thời gian thực).

> **RTF ở đây tính trên phạm vi hẹp: chỉ ASR + MT**, không gồm VAD và TTS — vì màn Đánh
> giá chấm chất lượng dịch nên không chạy TTS. Hai con số không thay thế được nhau; báo
> cáo phải ghi rõ phạm vi. Xem [báo cáo GVHD mục 7](gvhd/bao-cao-danh-gia.md).
>
> **Cập nhật 07/09 — dự đoán ở đây sai.** Chỗ này từng viết rằng RTF của
> `make eval-latency` (cả chuỗi VAD→ASR→MT→TTS) sẽ **cao hơn** 0,818 vì nó gồm nhiều
> khâu hơn. Đo thật thì ngược lại: RTF p90 nằm trong **0,395–0,786**, tức thấp hơn
> ([`05` mục 8c](05_bo-danh-gia-fleurs.md)). Lý do là hai lượt chạy khác nhau **cả model
> lẫn dữ liệu** — lượt kia dùng `whisper-large-v3-turbo-fp16` trên 22 câu tự dựng, lượt
> này dùng `whisper-large-v3-asr-8bit` trên FLEURS. Bài học đúng vẫn là bài học cũ, chỉ
> mạnh hơn: **RTF chỉ so được khi cùng phạm vi, cùng model và cùng dữ liệu** — thêm một
> khâu vào chuỗi không đủ để đoán chiều thay đổi của con số.

| Chiều | Số câu | Thang đo | Tỷ lệ lỗi | chrF   |
| ----- | ------ | -------- | --------- | ------ |
| vi→en | 5      | WER      | 9,7 %     | 54,3 % |
| en→vi | 5      | WER      | 5,7 %     | 52,4 % |
| vi→ja | 3      | WER      | 9,5 %     | 27,4 % |
| ja→vi | 3      | CER      | 0,0 %     | 49,4 % |
| vi→zh | 3      | WER      | 9,5 %     | 38,7 % |
| zh→vi | 3      | CER      | 4,8 %     | 28,8 % |

Thang đo đổi theo **ngôn ngữ nguồn**: vi/en chấm bằng WER (theo từ), ja/zh bằng CER
(theo ký tự) — tiếng Nhật và tiếng Trung không tách từ bằng dấu cách nên WER vô nghĩa.

Vài lỗi cụ thể quan sát được, để thầy thấy dạng lỗi chứ không chỉ con số:

- `vi-01` — "triển khai **API**" bị nghe thành "triển khai **AK**" (WER 12,5 %).
- `vi-05` — "**Độ** trễ hiện tại" thành "**Vụ** trễ hiện tại" (WER 25 %).

Cả hai đều là lỗi trên từ ngắn/từ mượn, đúng dạng lỗi đặc trưng của Whisper với tiếng
Việt.

## 5. Những giới hạn phải nói rõ khi trình bày

Đây là phần quan trọng nhất của tài liệu này. Các con số ở mục 4 **chưa dùng được làm
số liệu chính thức về độ chính xác ASR**, vì:

1. **Toàn bộ 22 câu chạy bằng giọng tổng hợp** (`audioSource: tts-roundtrip`): máy tự
   đọc câu tham chiếu rồi tự nghe lại. Giọng tổng hợp sạch, đều, không nhiễu, không
   giọng vùng miền — nên WER thực tế trên giọng người sẽ **cao hơn**. Chính giao diện
   cũng hiện dải cảnh báo cam về việc này, và cờ `hasSyntheticAudio` đi kèm mọi kết quả.
2. **Đã có sẵn 20 đoạn ghi âm giọng người thật** (81 giây, `scripts/audio/vlog-*.wav`,
   cắt từ một vlog bằng chính Silero VAD của dự án) nhưng **chưa ai nghe và điền bản
   chép + bản dịch tham chiếu**. Đây là việc của con người, không thể nhờ máy: dùng
   chính Whisper để sinh bản tham chiếu rồi chấm Whisper bằng nó thì WER sẽ ra gần 0 và
   hoàn toàn vô nghĩa. Điền xong 20 câu này là có ngay bộ số liệu trên giọng thật.
3. **Câu ja/zh và bản dịch tham chiếu của chúng do trợ lý AI soạn**, chưa qua người bản
   ngữ rà lại. chrF của hai cặp này chỉ nên dùng để **so sánh giữa các cấu hình**, không
   phải con số chất lượng dịch tuyệt đối. Điều này đã ghi vào `_note` của bộ mẫu.
4. **chrF ở đây là bản cài đặt thuần Python trong ứng dụng**, không phải sacrebleu.
   Bảng đưa vào báo cáo chính thức nên lấy từ `make eval-asr` / `make eval-mt` (jiwer +
   spBLEU) để so được với số công bố của NLLB-200 — xem docs/05.
5. Bộ mẫu chỉ **22 câu**, và là câu hội thoại họp ngắn. Đủ để so cấu hình với nhau,
   chưa đủ để kết luận về chất lượng hệ thống.

## 6. Ảnh chụp làm bằng chứng

Sinh ra trong `apps/desktop/e2e-artifacts/` (không commit — là kết quả chạy, không phải
mã nguồn):

| Tệp                                | Nội dung                                                |
| ---------------------------------- | ------------------------------------------------------- |
| `bao-cao-01-chan-doan.png`         | Cấu hình máy, tài nguyên tiến trình service             |
| `bao-cao-02-preset-tu-chon.png`    | Preset Tự chọn với runtime + model đã chọn, chưa nạp gì |
| `bao-cao-03-da-nap-model.png`      | Bốn khâu đã nạp, nhãn METAL/MPS, "Sẵn sàng Offline"     |
| `bao-cao-04-do-tre.png`            | Màn Chẩn đoán sau khi đo độ trễ                         |
| `bao-cao-05b-ket-qua-danh-gia.png` | Bảng WER/chrF/p50/p90 kèm dải cảnh báo giọng tổng hợp   |

## 7. Việc còn lại của khối thực nghiệm

- Điền bản chép + bản dịch cho 20 đoạn ghi âm giọng người thật → chạy lại mục 4.
- Chạy `make eval-asr` / `make eval-mt` trên FLEURS để có bảng số so sánh được với
  công bố của NLLB-200 (docs/05).
- Lặp lại toàn bộ tài liệu này trên **Windows 11 + NVIDIA** với runtime faster-whisper;
  `report.e2e.ts` chạy nguyên xi, chỉ cần đổi `LLVT_REAL_MODELS_DIR`.
- Một phiên soak 60 phút (docs/08). _(Hạng mục "chạy thật trên Google Meet" đã bỏ khỏi
  phạm vi ngày 10/09 — xem [`11`](11_pham-vi-da-bo-google-meet.md).)_
