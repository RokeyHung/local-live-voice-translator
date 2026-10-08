# Biên bản báo cáo thử với GVHD

**Đề tài:** Hệ thống dịch giọng nói đa ngôn ngữ gần thời gian thực bằng mô hình AI chạy cục bộ
**Sinh viên:** Ngô Mạnh Hùng, 24410300
**GVHD:** ThS. Nguyễn Thành Luân
**Ngày:** 06/10/2026, buổi tối, trực tuyến (khoảng 8 phút góp ý sau phần trình bày)
**Nội dung:** Sinh viên trình bày thử slide bảo vệ, thầy góp ý về slide, demo, câu hỏi dự phòng và thủ tục bảo vệ

> Ghi lại từ bản ghi âm tự động (`2026-10-06 21-47-52.srt`). Bản ghi chỉ có phần góp ý,
> không có phần sinh viên trình bày. Phần nhận dạng giọng nói sai nhiều chỗ ("Powerline" là
> _pipeline_, "flows" là _FLEURS_, "mở động" là _mở rộng_, "phản ứng viện" là _phản biện_);
> biên bản viết theo ý đã hiểu, không chép nguyên văn.

---

## 1. Góp ý về slide

### 1.1. Rút ngắn phần phân tích

Phần phân tích đang quá dài. Rút lại thành các ý chính và **gom vào một slide**. Thầy lưu ý
lúc báo cáo thật dễ bị run, nói dài hơn lúc tập và lố thời gian.

### 1.2. Mỗi slide phải có một câu chốt

Mỗi slide cần truyền tải một "câu chuyện", và kết thúc bằng **một ý chốt lại vấn đề**, để
hội đồng không có cảm giác chỉ lướt qua slide mà không đọng lại gì.

- Với những slide quan trọng, đặt câu chốt ngay trên slide, đánh dấu bằng **mũi tên màu đỏ**
  (dạng "cái này → kết luận kia") để hội đồng nhìn lên là nắm được ngay.
- Lý do: hội đồng không có nhiều thời gian đọc slide.
- Slide nào không ghi câu chốt thì phải tự nói ra. Phần này sinh viên tự chuẩn bị.

### 1.3. Slide dự phòng cho thuật ngữ và lý thuyết

Rà lại toàn bộ deck. Chỗ nào có nội dung lý thuyết hoặc thuật ngữ kỹ thuật thì làm **slide
dự phòng** đặt ở phía sau.

- Ví dụ thầy nêu: slide 7 (pipeline) có các thuật ngữ VAD, ASR, MT. Mỗi thuật ngữ nên có một
  slide dự phòng giải thích nó là gì.
- **Các độ đo** cũng cần slide dự phòng: được tính như thế nào.
- Không trình bày các slide này. Hội đồng hỏi thì mở đúng slide đó ra giải thích. Thầy nhận
  xét có sẵn tư liệu để giải thích thì **được điểm ở chỗ này**, và hôm đó sẽ không nhớ hết
  được nên phải có thứ để nhìn vào mà trả lời.

### 1.4. Kiểm lại phần đánh giá kết quả

- Kiểm kỹ đã đánh giá trên **bao nhiêu sample**, và **các sample đó có gì**.
- Tự mở bộ dữ liệu ra xem qua các sample. Thầy nói nhiều người trong hội đồng sẽ hỏi: "đánh
  giá trên bộ đó thì biết rồi, nhưng bộ đó có những gì?", nên phải trả lời được.
- Làm **một slide mô tả bộ dữ liệu FLEURS** (tập test, các cặp câu dùng để đánh giá dịch).

## 2. Góp ý về demo

- Chuẩn bị kỹ phần demo. **Tự chạy demo trước và quay video lại**, để nếu hôm đó demo trực
  tiếp không được thì vẫn có video mở lên.
- Thầy hỏi lại: app có chạy với video phát trên máy không, tức là nghe âm thanh đang phát
  trên máy? Sinh viên xác nhận có. Thầy dặn **lưu sẵn video nguồn trên máy**, phòng khi hôm
  đó mạng không tải được video.
- Chuẩn bị kỹ vấn đề mạng.
- **Trước khi báo cáo, mở app chạy thử một lần cuối** để tránh trường hợp app không lên.

## 3. Câu hỏi dự phòng thầy dự đoán

Thầy dặn chuẩn bị sẵn câu trả lời, theo cách "tưởng tượng mình là người ngồi nghe buổi báo
cáo hôm nay".

### 3.1. Mở rộng sang ngôn ngữ khác

> Ngoài bốn ngôn ngữ hiện tại, muốn mở rộng hệ thống cho ngôn ngữ khác thì có phải thay đổi
> hệ thống nhiều không? Thay đổi như thế nào? Có ảnh hưởng tới chất lượng không?

Câu này **chưa có** trong [`12` mục 4](../12_chuan-bi-bao-ve.md); cần soạn mới.

### 3.2. Dùng mô hình ngôn ngữ lớn hoặc mô hình end-to-end

> Pipeline hiện tại gồm nhiều bước. Đã có những mô hình chỉ cần một bước, đưa input vào là
> ra output. Có thể đưa LLM hoặc mô hình end-to-end vào hệ thống không?

Hướng trả lời thầy gợi ý: hệ thống chạy trên thiết bị cá nhân nên cần các mô hình không quá
lớn, còn để làm trọn chuỗi end-to-end bằng một mô hình thì cần mô hình lớn, nên không khả thi
khi đưa xuống máy như của mình. **Giới hạn phần cứng đó cũng chính là động lực (motivation)
của đề tài.**

Câu trả lời hiện có ở [`12` mục 4, câu 5](../12_chuan-bi-bao-ve.md) lập luận theo hướng thiết
kế (đo và thay được từng khâu). Nên ghép thêm lập luận phần cứng của thầy vào.

## 4. Thủ tục bảo vệ

### 4.1. Phòng và lịch

Sinh viên hỏi: phòng đào tạo chưa thông báo phòng thi, khi nào có? Thầy nghĩ gần ngày hội
đồng mới thông báo, chắc 1–2 ngày trước, thầy cũng không chắc. Thầy hỏi sinh viên có ở gần
trường không; sinh viên ở Thủ Đức, thầy nhận xét vậy thì không lo đi lại.

### 4.2. Thành phần hội đồng và cách tính điểm

Sinh viên hỏi những ai tham gia bảo vệ. Thầy trả lời: hội đồng có 3 người (chủ tịch, ủy viên,
thư ký); người tham gia vào điểm số gồm 3 người trong hội đồng và giảng viên hướng dẫn.

Thầy có nói ủy viên kiêm phản biện, hệ số 2, chủ tịch hệ số 1, nhưng **thầy nói không nhớ
rõ**. Phần này lệch với quy định đã tra ở [`12` mục 1.1](../12_chuan-bi-bao-ve.md): theo
QĐ 1012/QĐ-ĐHCNTT, ĐATN **không có** phản biện, và người có hệ số 2 là **CBHD**:
(Chủ tịch + Thư ký + Ủy viên + CBHD × 2) / 5. Nên hỏi lại thầy cho chắc (mục 6).

### 4.3. In báo cáo

**In 3 cuốn báo cáo** cho hội đồng, khoảng **ngày 09/10/2026**, nhưng chỉ in sau khi thầy đã
kiểm tra file báo cáo lần cuối (mục 5).

## 5. Việc cần làm

| #   | Việc                                                                               | Hạn                    |
| --- | ---------------------------------------------------------------------------------- | ---------------------- |
| 1   | Rút gọn phần phân tích vào một slide                                               | trước khi gửi slide    |
| 2   | Thêm câu chốt cho từng slide; slide quan trọng có mũi tên đỏ                       | trước khi gửi slide    |
| 3   | Làm slide dự phòng: VAD, ASR, MT và các thuật ngữ khác trong deck                  | trước khi gửi slide    |
| 4   | Làm slide dự phòng cách tính các độ đo (WER/CER, BLEU, COMET, RTF)                 | trước khi gửi slide    |
| 5   | Làm slide mô tả bộ FLEURS; tự mở dataset xem các sample                            | trước khi gửi slide    |
| 6   | Soạn câu trả lời: mở rộng ngôn ngữ (3.1), LLM/end-to-end (3.2)                     | trước buổi bảo vệ      |
| 7   | **Gửi thầy slide đã sửa và file báo cáo** để kiểm tra lần cuối                     | 07/10 hoặc 08/10/2026  |
| 8   | Gửi thầy danh sách câu hỏi còn thắc mắc về buổi bảo vệ (mục 6), thầy trả lời sau   | cùng lúc với việc 7    |
| 9   | In 3 cuốn báo cáo, sau khi thầy duyệt                                              | khoảng 09/10/2026      |
| 10  | Quay video demo dự phòng; lưu sẵn video nguồn cho chiều âm thanh hệ thống trên máy | trước buổi bảo vệ      |
| 11  | Mở app chạy thử lần cuối                                                           | ngay trước khi báo cáo |

> **Trạng thái ngày 08/10/2026.** Việc 1–6 đã làm trong
> [`slides/24410300_NgoManhHung_SlideBaoVe.pptx`](../slides/24410300_NgoManhHung_SlideBaoVe.pptx):
> mọi slide nội dung có dải câu chốt màu đỏ có mũi tên; slide 27–39 là slide dự phòng mới
> (mục lục, VAD, ASR, MT, TTS, thuật ngữ khác, FLEURS, WER/CER, spBLEU/chrF++, COMET, RTF, hai
> câu hỏi ở mục 3). Việc 1 làm khác góp ý: bài toán (slide 4) và bảng so sánh đã tra lại từ
> nguồn (slide 5) vẫn để hai slide, vì bảng cần đủ chỗ để đọc. Câu trả lời cho mục 3
> nằm ở [`12` mục 4](../12_chuan-bi-bao-ve.md), câu 5 và câu 11; lời nói cho từng slide ở
> [`13`](../13_kich-ban-thuyet-trinh.md). Việc 7–11 còn mở.

Tài liệu đã có để dựng slide dự phòng: thuật ngữ ở [`14`](../14_tu-viet-tat.md), công thức
và ví dụ tính độ đo ở [`06`](../06_bon-do-do-wer-bleu-comet-rtf.md), mô tả FLEURS và số
sample ở [`05`](../05_bo-danh-gia-fleurs.md). Danh sách chuẩn bị demo ở
[`12` mục 3](../12_chuan-bi-bao-ve.md) đã gồm việc 10 và 11.

## 6. Câu hỏi còn gửi thầy

Lấy từ danh sách cần chốt ở [`12` mục 6](../12_chuan-bi-bao-ve.md), trừ những gì buổi này
đã trả lời:

1. Cách tính điểm: theo QĐ 1012 thì CBHD hệ số 2 và ĐATN không có phản biện, đúng không ạ?
2. Thời lượng trình bày bao nhiêu phút? Demo có tính vào thời gian trình bày không?
3. Phòng bảo vệ có máy chiếu cổng gì, có loa nối được với laptop không?
4. Hội đồng gồm những thầy cô nào, chuyên môn gì?
