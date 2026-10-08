# Kịch bản thuyết trình bảo vệ đồ án

Lời nói cho bộ slide [`slides/24410300_NgoManhHung_SlideBaoVe.pptx`](slides/24410300_NgoManhHung_SlideBaoVe.pptx) (bản PDF cùng tên), bản sửa ngày 08/10/2026 theo góp ý buổi báo cáo thử ([biên bản](meetings/bien-ban-bao-cao-thu-GVHD-2026-10-06.md)). Phần lời nói ở đây trùng với note trong file pptx; sửa chỗ nào thì sửa cả hai.

Deck có 45 slide: 26 slide trình bày (kết thúc bằng Demo, Hỏi đáp, Cảm ơn), 19 slide dự phòng đặt sau slide Cảm ơn. Mục tiêu nói khoảng 12 phút, demo tối đa 2 phút, trong khung 15 phút ở [`12_chuan-bi-bao-ve.md`](12_chuan-bi-bao-ve.md). Thời lượng dưới đây là ước lượng, chưa phải kết quả bấm giờ; tập một lượt có bấm giờ rồi sửa lại.

Lời nói viết để đọc to: câu ngắn, có từ nối, tránh kiểu câu văn viết. Mỗi slide nội dung kết thúc bằng một câu **Tóm lại**, cùng ý với dải đỏ có mũi tên ở cuối slide. Thầy dặn không lướt qua slide mà không chốt lại điều gì, nên câu này không được bỏ khi thiếu giờ.

## Phân bổ thời gian

| Phần                   | Slide |                 Thời lượng |
| ---------------------- | ----- | -------------------------: |
| Mở đầu                 | 1–3   |                    35 giây |
| I. Tổng quan           | 4–6   |             1 phút 45 giây |
| II. Phương pháp        | 7–14  |             4 phút 10 giây |
| III. Kết quả           | 15–21 |             3 phút 45 giây |
| IV. Kết luận           | 22–23 |             1 phút 10 giây |
| Demo                   | 24    |              tối đa 2 phút |
| Hỏi đáp, cảm ơn        | 25–26 | 15 giây, chưa tính hỏi đáp |
| Chuyển slide, nhịp nói |       |             khoảng 20 giây |
| **Tổng**               |       |         **khoảng 14 phút** |

## Mở đầu

### Slide 1. Trang bìa của trung tâm

Trang bìa theo mẫu của trung tâm, không có lời nói. Để slide này trong lúc chờ hội đồng, bắt đầu nói thì chuyển sang slide 2.

### Slide 2. Trang bìa đề tài (20 giây)

Em kính chào thầy Chủ tịch hội đồng và quý thầy cô. Em là Ngô Mạnh Hùng, mã số sinh viên 24410300. Hôm nay em xin trình bày đồ án tốt nghiệp “Hệ thống dịch giọng nói đa ngôn ngữ gần thời gian thực sử dụng mô hình AI chạy cục bộ”, dưới sự hướng dẫn của thầy Nguyễn Thành Luân.

**Lưu ý:** nhìn hội đồng, đọc rõ tên đề tài và GVHD; không đọc lại toàn bộ thông tin trên bìa.

### Slide 3. Nội dung (15 giây)

Bài trình bày gồm bốn phần: tổng quan bài toán, phương pháp xây dựng, kết quả thực nghiệm, và kết luận cùng hướng phát triển. Cuối phần trình bày, em xin demo ngắn ứng dụng. Sau đó em xin lắng nghe câu hỏi và góp ý của hội đồng.

**Chuyển ý:** Trước hết, em xin giới thiệu bài toán và phạm vi em chọn giải quyết.

## I. Tổng quan

### Slide 4. Bài toán (35 giây)

Hiện nay việc họp hay học trực tuyến với người nước ngoài khá phổ biến, và lúc đó mình cần hiểu người kia nói gì gần như ngay lập tức. Các công cụ dịch giọng nói hiện có gần như đều chạy trên đám mây. Điều này kéo theo ba vấn đề. Mạng yếu là bản dịch chậm hoặc mất. Phải trả phí theo thời gian dùng. Và toàn bộ âm thanh cuộc họp bị gửi ra máy chủ bên ngoài.

Trong khi đó, các mô hình mã nguồn mở như Whisper, NLLB hay sherpa-onnx đã đủ nhỏ để chạy trên máy cá nhân. Em không tạo ra mô hình AI mới. Việc của đề tài là ghép các mô hình này lại và đo xem chúng chạy trên máy thật được tới đâu.

**Tóm lại,** câu hỏi em đặt ra là một chiếc laptop cá nhân có tự chạy trọn chuỗi dịch giọng nói và theo kịp người nói hay không.

### Slide 5. Các giải pháp liên quan (40 giây)

Em có so sánh với bốn giải pháp gần nhất. Các ô trong bảng em lấy từ trang trợ giúp của Google và README của từng dự án.

Google Meet có phụ đề dịch sang tiếng Việt, nhưng chạy trên đám mây và phải dùng gói trả phí. Phần dịch bằng giọng nói của Meet hiện chỉ có tiếng Anh với sáu thứ tiếng, chưa có tiếng Việt. SeamlessM4T của Meta chạy được trên máy, nghe và đọc được tiếng Việt, nhưng nó là một mô hình chạy bằng dòng lệnh, không thu được âm thanh trên máy. TranscriptionSuite là ứng dụng chép lời chạy trên máy, thu được cả micro lẫn âm thanh hệ thống, nhưng chỉ dịch được sang tiếng Anh và không đọc. LocalVocal là plugin của OBS, dịch được tiếng Việt ngay trên máy, còn dùng cùng mô hình NLLB với em, nhưng không đọc bản dịch và phải chạy trong OBS.

**Tóm lại,** chưa công cụ nào có đủ các hàng trong bảng. SeamlessM4T gần đề tài nhất về mô hình, còn LocalVocal gần nhất về ứng dụng.

**Nếu bị hỏi đề tài khác LocalVocal ở đâu:** đề tài đọc bản dịch thành tiếng, chạy hai chiều cùng lúc trong một ứng dụng riêng có chống vòng lặp, và có bộ đo cho từng khâu.

### Slide 6. Mục tiêu và phạm vi (30 giây)

Về mục tiêu, ứng dụng nhận âm thanh từ hai nguồn. Một là giọng của chính người dùng qua micro. Hai là âm thanh đang phát trên máy, ví dụ giọng người bên kia cuộc gọi hoặc một video.

Khi người dùng nói, ứng dụng hiện phụ đề song ngữ và đọc bản dịch ra loa để người đối diện nghe. Còn với âm thanh trên máy thì ứng dụng chỉ hiện phụ đề, không đọc, để ứng dụng không tự thu lại giọng đọc của chính nó.

Hệ thống dịch được sáu chiều giữa tiếng Việt với tiếng Anh, Nhật và Trung, chạy trên Windows 11 và macOS. Mô hình chỉ cần tải về một lần, sau đó dịch hoàn toàn không cần Internet.

Phạm vi em giới hạn như trong khung màu đỏ. Em không làm mô hình mới. Em dịch từng câu sau khi người nói ngừng, không dịch đồng thời từng từ. Và bản dịch không được đưa ngược vào phần mềm họp.

**Tóm lại,** mục tiêu là dịch sáu chiều ngay trên laptop, mỗi lần một câu, và âm thanh không rời khỏi máy.

## II. Phương pháp

### Slide 7. Mục lục phần II (5 giây)

Sang phần phương pháp. Em sẽ trình bày bốn ý: chuỗi xử lý, kiến trúc hệ thống, một số kỹ thuật chính, và cuối cùng là ứng dụng, đóng gói, kiểm thử.

### Slide 8. Chuỗi xử lý (40 giây)

Đây là chuỗi xử lý của hệ thống. Âm thanh từ micro hoặc từ máy được đưa về cùng một định dạng, rồi đi qua bốn khâu.

Khâu đầu là VAD, dùng mô hình Silero, có nhiệm vụ cắt dòng âm thanh thành từng câu. Tiếp theo là ASR, dùng Whisper, chuyển giọng nói thành chữ. Sau đó là MT, dùng NLLB-200, dịch đoạn chữ đó sang ngôn ngữ kia. Cuối cùng là TTS, đọc bản dịch ra loa. Khâu này chỉ chạy khi người dùng nói qua micro. Câu gốc và bản dịch hiện ngay lên màn hình thành phụ đề.

Em chọn cách ghép từng khâu như vậy vì hai lý do. Thứ nhất, khi kết quả sai thì em biết sai ở khâu nghe hay khâu dịch. Thứ hai, em thay được từng mô hình cho hợp với phần cứng mà không ảnh hưởng khâu khác. Cái giá là lỗi và độ trễ cộng dồn qua các khâu. Ví dụ Whisper nghe nhầm một từ thì NLLB cũng dịch luôn từ sai đó. Vì vậy ở phần kết quả, em đo riêng từng khâu và đo cả chuỗi.

**Tóm lại,** tách thành bốn khâu giúp em đo và thay được từng khâu, đổi lại lỗi và độ trễ cộng dồn, và em đã đo cả hai.

**Khi chỉ sơ đồ:** đi từ nguồn âm thanh, qua bốn khâu, tới loa và phụ đề. Nếu hội đồng hỏi VAD, ASR, MT, TTS là gì thì mở slide dự phòng 28 đến 31.

### Slide 9. Kiến trúc hai tiến trình (30 giây)

Về kiến trúc, ứng dụng gồm hai chương trình chạy song song trên cùng một máy. Bên trái là ứng dụng desktop, viết bằng Electron, React và TypeScript. Phần này lo giao diện, thu âm thanh và phát giọng đọc. Bên phải là dịch vụ AI viết bằng Python, chạy bốn mô hình, quản lý mô hình và lưu lịch sử.

Hai bên trao đổi qua REST và WebSocket, nhưng chỉ trong nội bộ máy, tức địa chỉ 127.0.0.1. Nên dịch vụ không mở ra mạng bên ngoài.

Em tách làm hai vì các thư viện mô hình đều nằm bên Python, còn việc thu âm thanh hệ thống thì Electron đã làm sẵn. Ngoài ra mô hình chiếm khoảng 2 GB RAM và mỗi lần chạy có thể giữ CPU vài giây. Nếu để chung một chương trình thì cứ mỗi câu giao diện lại bị đơ.

**Tóm lại,** em tách hai tiến trình để mô hình nặng không làm đơ giao diện, và hai bên chỉ trao đổi bên trong máy.

### Slide 10. Kiến trúc lục giác (30 giây)

Bên trong dịch vụ AI, em tổ chức code theo kiến trúc Ports and Adapters, còn gọi là kiến trúc lục giác. Ý chính chỉ có một: phụ thuộc luôn hướng vào trong. Chuỗi xử lý ở giữa chỉ làm việc với các giao diện trừu tượng, gọi là port. Nó không biết phía sau là Whisper hay mô hình nào khác.

Thiết kế này đã giúp em ở ba chỗ. Khi thêm hai runtime nhận dạng là MLX và faster-whisper, mỗi runtime em chỉ viết một adapter, thêm một dòng đăng ký và một dòng cấu hình. Khi phát hiện sherpa-onnx không đọc được tiếng Nhật, em thêm Kokoro và một lớp chọn engine theo ngôn ngữ, chuỗi xử lý vẫn chỉ thấy một TTS. Còn khi kiểm thử, em thay mô hình thật bằng mô hình giả, nên 327 bài kiểm thử chạy xong trong vài giây.

**Tóm lại,** vì chuỗi xử lý chỉ biết port, em thêm được hai runtime nhận dạng và một engine đọc mà không sửa dòng nào của chuỗi xử lý.

### Slide 11. Bộ tách câu (40 giây)

Đây là phần em phải tự làm, đó là bộ tách câu. Khi nói thì không có dấu chấm câu, nên hệ thống phải tự đoán lúc nào một câu kết thúc để gửi đi dịch. Bản đầu tiên của em chờ im lặng 300 mili giây và cho câu dài tới 20 giây. Kết quả là nếu người nói nói liền một mạch thì phải chờ tới 20 giây mới có bản dịch. Đây cũng là chỗ thầy hướng dẫn góp ý hồi tháng 8.

Bộ tách câu hiện tại đổi ngưỡng theo độ dài câu. Khi câu còn ngắn, hệ thống chờ im lặng 320 mili giây, để người nói chậm hay ngập ngừng không bị cắt vụn câu. Khi câu đã dài hơn 3,5 giây thì chỉ cần một chỗ ngừng ngắn 140 mili giây là chốt câu. Nếu câu chạm 6 giây thì hệ thống cắt luôn, nhưng lùi lại tối đa 400 mili giây để cắt ở chỗ yên nhất.

Đổi lại, có một số câu bị cắt giữa chừng: 30% số đoạn ở bản tin, 10% ở phỏng vấn, và không có đoạn nào ở bài nói TEDx.

**Tóm lại,** câu dài nhất giờ chỉ còn 6 giây thay vì 20 giây, và với bản tin đọc liền mạch thì 90% số câu ngắn hơn 5,9 giây.

### Slide 12. Hai chiều dịch và chống vòng lặp (35 giây)

Ứng dụng chạy hai chiều cùng lúc. Chiều đi là khi người dùng giữ phím để nói. Câu nói được nhận dạng, dịch, rồi đọc ra loa. Chiều về là âm thanh đang phát trên máy, ví dụ người bên kia cuộc gọi. Phần này được thu liên tục và chỉ hiện phụ đề.

Chạy hai chiều cùng lúc thì có một vấn đề. Giọng đọc bản dịch phát ra cũng là âm thanh của máy. Nếu không chặn thì chiều về sẽ thu lại giọng đọc đó rồi dịch tiếp, thành một vòng lặp. Em xử lý bằng cách trong lúc đang đọc bản dịch, ứng dụng bỏ qua âm thanh hệ thống và hiện chữ "Tạm ngưng thu".

Một chi tiết nữa là khi người dùng nhả phím thì ứng dụng ngừng gửi âm thanh. Lúc đó VAD không nhận được khoảng lặng nào nên không biết câu đã hết. Em thêm hàm flush vào VAD để chốt câu ngay lúc nhả phím. Ngoài ra, dịch vụ cũng tự bỏ âm thanh micro gửi đến ngoài lúc giữ phím, để nếu một phía có lỗi thì phía kia vẫn chặn được.

**Tóm lại,** hai chiều chạy cùng lúc mà bản dịch đang đọc không bị thu lại rồi dịch tiếp.

### Slide 13. Ứng dụng desktop (35 giây)

Đây là ứng dụng desktop, gồm tám màn hình. Ngoài màn phiên dịch trực tiếp, người dùng còn nhập được tệp âm thanh hoặc video để dịch cả tệp, xem lại lịch sử có tìm kiếm, xem và sửa bản dịch trước khi đọc, chấm điểm ngay trong ứng dụng, và quản lý mô hình. Ảnh bên trái là màn lịch sử với bản gốc và bản dịch của cả hai chiều. Bên phải là màn thiết bị, cho thấy GPU mà dịch vụ nhìn thấy, và màn quản lý mô hình với tiến độ nạp từng khâu.

Nhập tệp, chấm điểm và tách người nói là phần em làm thêm ngoài đề cương. Riêng tách người nói thì em chưa đánh giá độ chính xác trên cuộc họp nhiều người.

**Tóm lại,** ngoài phiên dịch trực tiếp, ứng dụng còn nhập tệp, lưu lịch sử, chấm điểm và quản lý mô hình.

### Slide 14. Đóng gói và kiểm thử (35 giây)

Về đóng gói, bộ cài mang theo sẵn một bản Python riêng, nên người dùng không phải cài Python hay Node. Bộ cài Windows nặng 371 MB, bản macOS 592 MB. Em kiểm tra bộ cài Windows qua bốn bước trong bảng, từ bản Python đóng gói tới tốc độ chạy thật sau khi cài.

Về kiểm thử, em có ba lớp chạy tự động. 327 bài pytest cho dịch vụ, 69 bài vitest cho giao diện chạy trên dịch vụ giả, và 11 kịch bản Playwright chạy ứng dụng thật với dịch vụ thật và mô hình thật. Hai lớp đầu dùng mô hình giả nên chạy xong trong vài giây.

**Tóm lại,** người dùng chỉ cần một bộ cài là chạy được, và hệ thống có 407 bài kiểm thử tự động ở ba lớp.

## III. Kết quả

### Slide 15. Mục lục phần III (10 giây)

Sang phần kết quả. Em muốn trả lời bốn câu hỏi. Từng khâu chính xác tới đâu. Cả chuỗi có theo kịp người nói không. Có chạy ổn định lâu dài không. Và con số đo trên dữ liệu chuẩn có lạc quan hơn thực tế không. Đầu tiên là môi trường và dữ liệu đo.

### Slide 16. Môi trường và dữ liệu (30 giây)

Trước khi vào kết quả, em nói qua về môi trường đo. Em đo trên hai máy: một máy Mac M4 và một laptop Windows 11 có card RTX 4060. Dữ liệu chính là bộ FLEURS: 3.099 bản thu cho nhận dạng, 2.022 cặp câu cho dịch, và 50 câu mỗi chiều cho độ trễ. Ngoài ra em có bài chạy liên tục 60 phút, ba bản ghi YouTube để thử bộ tách câu, và 25 đoạn phỏng vấn thật.

Khâu dịch em đo trên câu văn bản chuẩn để lỗi nhận dạng không bị tính vào. Mọi phép đo chạy sau khi đã nạp xong mô hình, chạy lại ra đúng số cũ, và tệp kết quả gốc em đều lưu lại.

**Tóm lại,** em đo trên hai máy với FLEURS là dữ liệu chính, và mọi số liệu đều chạy lại được từ tệp kết quả gốc.

**Nếu hỏi FLEURS có gì:** mở slide dự phòng 33.

### Slide 17. Nhận dạng trên FLEURS (35 giây)

Đầu tiên là khâu nhận dạng giọng nói, đo trên 3.099 bản thu của bộ FLEURS. Chỉ số ở đây là WER, tức tỉ lệ từ bị nhận sai, càng thấp càng tốt.

Tiếng Việt có WER từ 8,8 đến 10,4%, tiếng Anh khoảng 5%, nghĩa là tiếng Việt sai nhiều gần gấp đôi tiếng Anh. Tiếng Trung và tiếng Nhật viết liền, không có khoảng trắng giữa các từ, nên em dùng CER, tức tỉ lệ ký tự sai, giống bài báo gốc của FLEURS.

Cần lưu ý FLEURS là giọng đọc rõ ràng, nên đây là mức lỗi thấp nhất mình có thể kỳ vọng. Phần sau em sẽ cho thấy giọng nói tự nhiên sai nhiều hơn bao nhiêu. Ba cột màu là ba cấu hình khác nhau, vì mỗi runtime dùng một tệp mô hình riêng.

**Tóm lại,** trên giọng đọc, tiếng Việt sai khoảng một từ trong mười từ, gấp đôi tiếng Anh.

**Nếu hỏi về lượng tử hóa:** cùng mô hình large-v3-turbo, bản nén 5 bit sai nhiều hơn bản đầy đủ khoảng 1,2 điểm WER tiếng Việt, nhưng chạy nhanh gấp đôi. Nếu hỏi WER, CER tính thế nào hay FLEURS có gì thì mở slide 33 và 34.

### Slide 18. Dịch máy trên FLEURS (35 giây)

Tiếp theo là khâu dịch. Em dùng NLLB-200 bản 600 triệu tham số và chấm trên 2.022 cặp câu của FLEURS, đủ sáu chiều. Ở đây em dịch câu văn bản chuẩn có sẵn, không dịch kết quả của khâu nhận dạng, để lỗi nghe không bị tính vào điểm dịch.

Em dùng hai độ đo. spBLEU đếm xem bản dịch máy trùng bao nhiêu chữ với bản dịch mẫu của người. COMET là một mô hình được huấn luyện để chấm bản dịch theo nghĩa, cho điểm từ 0 đến 1.

Hai độ đo này xếp hạng các chiều khác nhau. Theo spBLEU thì Việt sang Nhật thấp nhất. Theo COMET thì Việt sang Trung thấp nhất, còn Việt sang Nhật lại ở mức khá. Lý do là spBLEU chỉ đếm chữ trùng, nên một câu tiếng Nhật đúng nghĩa nhưng diễn đạt khác bản mẫu vẫn bị điểm thấp. Vì vậy em báo cáo cả hai, và không lấy trung bình sáu chiều.

**Tóm lại,** điểm COMET từ 0,77 đến 0,85 ở cả sáu chiều, và chiều yếu nhất là Việt sang Trung, thấp ở cả hai độ đo.

### Slide 19. Độ trễ cả chuỗi (40 giây)

Về tốc độ, em đo cả chuỗi bốn khâu trên 50 câu mỗi chiều. Chỉ số là RTF, bằng thời gian xử lý chia cho độ dài câu nói. Ví dụ câu dài 4 giây mà xử lý mất 2 giây thì RTF là 0,5. RTF dưới 1 nghĩa là máy xử lý xong nhanh hơn thời gian người ta nói câu đó. Em lấy p90, tức 9 trên 10 câu nhanh hơn mức này, để con số trung bình không che mất những câu chậm.

Trên laptop Windows có card RTX 4060, cả sáu chiều đều dưới 0,5, chậm nhất là Việt sang Nhật với 0,383. Trên máy Mac M4, cả sáu chiều đều dưới 1, nhưng chỉ hai chiều xuống được dưới 0,5. Mức 0,5 là em tự đề xuất, vì khi hai bên cùng nói thì hai chiều dùng chung một bộ mô hình, mỗi chiều chỉ còn khoảng một nửa sức máy.

**Tóm lại,** cả sáu chiều đều theo kịp người nói trên cả hai máy, và máy có card rời đạt luôn mục tiêu 0,5.

### Slide 20. Hội thoại tự phát (45 giây)

Như em nói ở trên, FLEURS là giọng đọc nên có thể lạc quan hơn thực tế. Vì vậy em đo thêm trên 25 đoạn của một buổi phỏng vấn thật. Cùng mô hình, cùng máy, WER tiếng Việt tăng từ 10,4% lên 24,6%, tức gấp 2,4 lần.

Lỗi chủ yếu nằm ở các thuật ngữ tiếng Anh chen vào câu tiếng Việt. Ví dụ từ "string" xuất hiện 18 lần thì Whisper chỉ nghe đúng 1 lần, còn lại nghe thành "stream", "trên" hay "chuyên". Phụ đề tự động của YouTube cũng sai y như vậy.

Bộ dữ liệu này còn làm lộ ra hai lỗi của khâu dịch. Một là có 2 trên 75 lượt dịch sang tiếng Nhật bị lặp một cụm từ hơn 50 lần. Hai là từ "spring" bị dịch thành mùa xuân.

Bộ này chỉ có một bản ghi, nên em dùng nó để thấy khoảng cách lớn cỡ nào, còn số liệu chính vẫn là FLEURS.

**Tóm lại,** giọng nói tự nhiên có WER gấp 2,4 lần giọng đọc, và lỗi chính là thuật ngữ tiếng Anh.

### Slide 21. Yêu cầu phi chức năng (30 giây)

Slide này em đối chiếu kết quả với các yêu cầu đặt ra từ đầu. Ví dụ với một câu 3 giây, cả chuỗi từ nhận dạng tới đọc mất khoảng 1,8 đến 2,6 giây, dưới mục tiêu 4 giây. Chạy liên tục 60 phút được 877 câu, không có lỗi nào, bộ nhớ chỉ tăng 12 MB. Lịch sử chỉ lưu chữ, không lưu âm thanh.

Có một điểm em muốn nói rõ. Yêu cầu chạy không cần mạng hiện mới đạt theo thiết kế, tức trên đường dịch không có lời gọi mạng nào, nhưng em chưa có bài kiểm thử tự động ngắt mạng. Lát nữa trong phần demo em sẽ tắt Wi-Fi để thầy cô thấy.

**Tóm lại,** ứng dụng đạt cả mười yêu cầu, riêng phần chạy offline mới đạt theo thiết kế.

## IV. Kết luận

### Slide 22. Kết quả đạt được (35 giây)

Về kết quả, em đã làm được một ứng dụng desktop chạy trọn bốn khâu tách câu, nhận dạng, dịch và đọc ngay trên máy. Ứng dụng dịch sáu chiều, thu được cả micro lẫn âm thanh trên máy mà không bị vòng lặp, và có bộ cài cho cả Windows lẫn macOS.

Vì các mô hình đều có sẵn, em xem đóng góp của mình nằm ở ba chỗ. Thứ nhất là kiến trúc cho phép thay và đo từng khâu. Thứ hai là bộ đánh giá trên FLEURS, chạy lại được và có đủ tệp kết quả gốc. Thứ ba là những vấn đề chỉ lộ ra khi chạy trên máy thật, ví dụ whisper.cpp chọn nhầm card đồ họa tích hợp, hay khi có GPU thì khâu đọc lại thành khâu chậm nhất.

**Tóm lại,** đây là một ứng dụng dịch hai chiều chạy trọn trên laptop, có số đo từng khâu trên cả FLEURS lẫn giọng thật.

### Slide 23. Hạn chế và hướng phát triển (35 giây)

Về hạn chế, em ghép mỗi hạn chế với một hướng phát triển. Hạn chế lớn nhất là thuật ngữ tiếng Anh nằm trong câu tiếng Việt, vì người dùng em hướng tới thường làm trong ngành phần mềm và nói chuyện với đối tác nước ngoài. Hướng sửa là cho Whisper một danh sách thuật ngữ để gợi ý khi nhận dạng, và giữ nguyên các từ đó khi dịch.

Ngoài ra, NLLB đôi khi bị lặp từ và dịch nghĩa đen thuật ngữ. Khâu đọc tiếng Nhật và tiếng Trung còn chạy CPU nên chậm. Bộ giọng thật mới có 25 đoạn, và em chưa thử trên máy không có card đồ họa. Cuối cùng, NLLB-200 có giấy phép phi thương mại, nên nếu muốn bán ứng dụng thì phải đổi mô hình dịch.

**Tóm lại,** hạn chế lớn nhất là thuật ngữ tiếng Anh trong câu tiếng Việt, và bước tiếp theo là danh sách thuật ngữ.

## Demo và hỏi đáp

### Slide 24. Demo (tối đa 2 phút)

Kịch bản demo, tối đa 2 phút, trên máy Windows, cấu hình Cân bằng. Trước khi vào phòng: mở app chạy thử một lần, bấm "Khởi động model" và đợi nạp xong.

1. Tắt Wi-Fi: "Em xin tắt mạng để thầy cô thấy phần dịch chạy hoàn toàn trên máy."
2. Giữ phím Space, nói câu đã tập ("Chúng ta sẽ họp lại vào thứ Hai tuần sau"), rồi nhả phím: "Đây là câu em vừa nói, đây là bản dịch, và ứng dụng đang đọc bản dịch ra loa."
3. Mở video tiếng Anh đã lưu sẵn trên máy, cho chạy 10 đến 15 giây: "Đây là âm thanh đang phát trên máy. Ứng dụng hiện phụ đề tiếng Việt, chiều này không đọc thành tiếng."
4. Còn thời gian thì mở màn Lịch sử: "Lịch sử chỉ lưu chữ, không lưu âm thanh."

**Nếu demo lỗi:** dừng lại, mở video demo đã quay sẵn. Không tải lại mô hình hay sửa cấu hình trước hội đồng.

### Slide 25. Hỏi đáp

Phần trình bày và demo của em đến đây là hết. Em xin cảm ơn thầy cô đã lắng nghe, và em mong nhận được câu hỏi và góp ý của hội đồng.

Giữ slide này trong lúc hội đồng hỏi. Slide dự phòng nằm sau slide Cảm ơn. Slide 27 là mục lục, gõ số trang rồi Enter để nhảy tới, xong gõ 25 rồi Enter để quay lại đây.

Nghe hết câu hỏi và ghi lại. Mỗi câu trả lời khoảng 30 đến 60 giây, có con số, mở đúng slide. Câu nào chưa tìm hiểu thì nói thẳng là em chưa tìm hiểu và sẽ kiểm tra lại.

### Slide 26. Cảm ơn (10 giây)

Dạ, em xin cảm ơn thầy Chủ tịch và quý thầy cô đã lắng nghe và góp ý. Em xin tiếp thu các góp ý để hoàn thiện đồ án.

## Slide dự phòng

Không trình bày. Mở khi hội đồng hỏi: trong chế độ trình chiếu, gõ số trang rồi Enter, xong gõ 25 rồi Enter để về slide Hỏi đáp. Slide 27 là mục lục ghi số trang của từng slide dự phòng. Thầy dặn chuẩn bị phần này vì hôm bảo vệ sẽ không nhớ hết, và có sẵn tư liệu để giải thích thì được điểm.

### Slide 27. Mục lục slide dự phòng

Mục lục slide dự phòng. Trong lúc trình chiếu, gõ số trang rồi Enter để nhảy thẳng tới slide đó.

### Slide 28. VAD

**Nếu thầy cô hỏi VAD là gì:** VAD là phát hiện giọng nói. Nó không hiểu nội dung, chỉ cho biết trong từng đoạn âm thanh 32 mili giây có người đang nói hay không. Em dùng mô hình Silero, chạy trên CPU. Bộ tách câu gom những đoạn có giọng lại thành một câu, chờ tới khi người nói ngừng hoặc câu dài tới 6 giây thì mới gửi cho Whisper. Nhờ vậy Whisper không phải nghe những đoạn im lặng, vì đó chính là lúc nó hay tự bịa ra câu.

### Slide 29. ASR

**Nếu thầy cô hỏi ASR là gì:** ASR là nhận dạng giọng nói, tức chuyển lời nói thành chữ. Em dùng Whisper của OpenAI. Âm thanh được đổi thành phổ tần số, phần encoder đọc cả câu, rồi phần decoder viết ra chữ từng chút một. Cấu hình Cân bằng dùng bản large-v3-turbo. Bản turbo giữ nguyên phần encoder nhưng giảm phần decoder từ 32 lớp xuống 4 lớp, nên chạy nhanh hơn nhiều. Em còn dùng bản nén 5 bit để mô hình nhỏ lại.

### Slide 30. MT

**Nếu thầy cô hỏi MT là gì:** MT là dịch máy, ở đây là dịch văn bản. Em dùng NLLB-200 của Meta, một mô hình dịch được 200 ngôn ngữ. Bản em dùng có 600 triệu tham số, được thu nhỏ từ một mô hình lớn hơn nhiều để chạy được trên laptop. Mỗi câu đầu vào được gắn mã ngôn ngữ, ví dụ vie_Latn là tiếng Việt, và đầu ra được ép bắt đầu bằng mã ngôn ngữ đích, ví dụ jpn_Jpan là tiếng Nhật. Nhờ vậy câu tiếng Việt được dịch thẳng sang tiếng Nhật, không phải đi vòng qua tiếng Anh.

### Slide 31. TTS

**Nếu thầy cô hỏi TTS là gì:** TTS là tổng hợp giọng nói, tức đọc chữ thành tiếng. Chữ được chuẩn hóa, ví dụ số được đổi thành chữ, rồi chuyển thành âm, sau đó mô hình giọng tạo ra âm thanh. Với tiếng Việt, Anh và Trung, em dùng sherpa-onnx. Thư viện này không xử lý được chữ tiếng Nhật, nên tiếng Nhật em dùng thêm mô hình Kokoro. Khâu này chỉ chạy khi người dùng nói qua micro. Hiện nó chạy trên CPU, nên là khâu chậm nhất khi dịch sang tiếng Trung hoặc tiếng Nhật.

### Slide 32. Thuật ngữ kỹ thuật khác

Mở slide này khi hội đồng hỏi về một thuật ngữ kỹ thuật trong bài. Chỉ cần giải thích đúng dòng được hỏi.

### Slide 33. Bộ dữ liệu FLEURS

**Nếu thầy cô hỏi bộ FLEURS có gì:** FLEURS là bộ dữ liệu giọng đọc của Google, có 102 ngôn ngữ. Câu gốc là câu tiếng Anh lấy từ Wikinews, Wikijunior và Wikivoyage, được dịch chuyên nghiệp sang từng ngôn ngữ rồi nhờ người bản ngữ đọc to. Cùng một câu thì có chung một mã ở mọi ngôn ngữ, nên em ghép theo mã là có ngay cặp câu để đánh giá dịch.

Em chỉ dùng phần test. Cụ thể là 3.099 bản thu, khoảng 10 giờ âm thanh, để đánh giá nhận dạng. 2.022 cặp câu để đánh giá dịch. Và 50 bản thu mỗi chiều để đo tốc độ. Mỗi câu tiếng Việt dài trung bình khoảng 31 từ, chủ đề là tin tức, du lịch và khoa học phổ thông.

Ví dụ bên phải là cùng một câu ở bốn ngôn ngữ. Bản tiếng Nhật ghi là nhà máy điện hạt nhân, vì cả bốn bản đều được dịch từ câu tiếng Anh, không dịch qua lại với nhau.

### Slide 34. WER và CER

**Nếu thầy cô hỏi WER tính thế nào:** WER bằng tổng số từ bị nghe nhầm, bị bỏ sót và bị thêm thừa, chia cho số từ của câu đúng. Ví dụ câu "độ trễ hiện tại là hai giây" bị nghe thành "vụ trễ hiện tại hai giây". Ở đây có một từ nghe nhầm và một từ bị bỏ. Câu đúng có bảy từ, nên WER là 2 chia 7, khoảng 28,6%. Khi tính cho cả bộ, em cộng hết lỗi rồi chia cho tổng số từ. Với tiếng Trung và tiếng Nhật thì cách tính giống hệt nhưng đếm theo ký tự, gọi là CER.

### Slide 35. spBLEU và chrF++

**Nếu thầy cô hỏi BLEU tính thế nào:** BLEU đếm xem bản dịch máy có bao nhiêu cụm 1, 2, 3 và 4 từ trùng với bản dịch mẫu, rồi lấy trung bình nhân của bốn tỉ lệ đó. Bản dịch ngắn hơn bản mẫu thì bị trừ thêm. Vì là trung bình nhân, chỉ cần không có cụm 4 từ nào trùng là cả câu được 0 điểm, như ví dụ "I disagree with this proposal" ở dưới, dù câu này dịch đúng nghĩa. Nên BLEU chỉ có ý nghĩa khi tính trên cả bộ dữ liệu. spBLEU là BLEU nhưng tách từ theo một cách chung cho mọi ngôn ngữ, nhờ vậy chấm được cả tiếng Trung và tiếng Nhật.

### Slide 36. COMET

**Nếu thầy cô hỏi COMET là gì:** COMET là một mô hình được huấn luyện để chấm bản dịch giống như người chấm. Nó đọc ba câu cùng lúc: câu gốc, câu máy dịch và câu dịch mẫu, rồi cho điểm từ 0 đến 1. Mô hình này học từ rất nhiều điểm mà người thật đã chấm cho các bản dịch máy. Em dùng phiên bản Unbabel/wmt22-comet-da như thầy giao. Điểm COMET không phải phần trăm, 0,85 không có nghĩa là dịch đúng 85%. Nó dùng để so các chiều dịch hoặc các mô hình với nhau trên cùng một bộ dữ liệu.

### Slide 37. RTF và p90

**Nếu thầy cô hỏi về ngưỡng RTF:** RTF bằng thời gian xử lý chia cho độ dài câu nói. Dưới 1 là điều kiện tối thiểu. Nếu lớn hơn 1 thì máy xử lý không kịp, câu sau dồn lên câu trước và độ trễ cứ tăng mãi. Mục tiêu 0,5 là em tự đề xuất, dựa trên hai lý do. Một là hai chiều dịch dùng chung một bộ mô hình, nên khi hai bên cùng nói thì mỗi chiều chỉ còn khoảng nửa sức máy. Hai là câu dài nhất 6 giây nhân 0,5 thì mất khoảng 3 giây xử lý, gần với độ trễ khoảng 3 giây của phiên dịch viên thật. Em dùng p90 để 9 trên 10 câu đạt mức này. Nếu bị hỏi 0,5 theo chuẩn nào thì nói rõ đây là mức em suy ra, chưa có chuẩn sẵn cho cả chuỗi dịch.

### Slide 38. Câu hỏi: thêm ngôn ngữ khác

**Nếu thầy cô hỏi muốn thêm ngôn ngữ khác thì sao:** em không phải sửa chuỗi xử lý. VAD giữ nguyên vì nó không phụ thuộc ngôn ngữ. Whisper đã nhận dạng được khoảng 100 ngôn ngữ, nên chỉ cần truyền mã ngôn ngữ mới. NLLB có sẵn 200 ngôn ngữ, em chỉ thêm một dòng mã, ví dụ tiếng Hàn là kor_Hang. Phần khó nhất là khâu đọc, vì phải tìm được một giọng đọc chạy offline cho ngôn ngữ đó, giống như em đã phải thêm Kokoro cho tiếng Nhật. Ngoài ra là thêm tên ngôn ngữ vào giao diện.

Chất lượng thì phụ thuộc vào Whisper và NLLB, mỗi ngôn ngữ một khác. Ngôn ngữ nào ít dữ liệu huấn luyện thì sai nhiều hơn hẳn. FLEURS có 102 ngôn ngữ, nên trước khi đưa ngôn ngữ mới vào, em sẽ chạy lại đúng bộ đánh giá này để có số liệu.

**Tóm lại,** thêm ngôn ngữ chỉ đụng tới cấu hình và giọng đọc, còn chất lượng thì phải đo lại trên FLEURS.

### Slide 39. Câu hỏi: mô hình end-to-end, LLM

**Nếu thầy cô hỏi sao không dùng một mô hình làm trọn từ đầu đến cuối, hay dùng mô hình ngôn ngữ lớn:** những mô hình đó gộp nghe, dịch và đọc vào một, nên ít lỗi cộng dồn hơn. Nhưng để làm được hết một lúc thì mô hình phải lớn hơn. Ví dụ SeamlessM4T bản large có 2,3 tỷ tham số trong một khối. Một mô hình ngôn ngữ lớn 7 tỷ tham số, dù đã nén xuống 4 bit, riêng phần trọng số đã khoảng 3,5 GB, chưa tính phần nghe và đọc. Còn chuỗi của em có hai khâu chính cộng lại khoảng 1,4 tỷ tham số, và mỗi khâu chạy trên runtime nhanh nhất cho từng loại máy.

Với laptop phổ thông thì giới hạn phần cứng là vấn đề thật, và đó cũng là lý do em làm đề tài này. Thêm nữa, ghép từng khâu thì em đo được và thay được từng phần.

**Nếu bị hỏi đã chạy thử SeamlessM4T chưa:** em chưa đo, nên em không khẳng định nó chậm hơn bao nhiêu.

**Tóm lại,** mô hình một bước lớn hơn và không tách ra để đo hay thay được, nên đề tài chọn ghép các mô hình vừa phải.

### Slide 40. Lựa chọn mô hình, preset

**Nếu thầy cô hỏi vì sao chọn các mô hình này:** em chọn theo ba tiêu chí. Mô hình phải chạy được trên cả Windows và macOS, phải hỗ trợ đủ bốn ngôn ngữ, và phải đóng gói được vào bộ cài. Khâu nhận dạng có ba runtime, mỗi runtime dùng một tệp mô hình riêng. Khâu đọc thì em phải đổi giữa chừng, vì sherpa-onnx không đọc được tiếng Nhật nên em thêm Kokoro. Ba cấu hình Nhanh, Cân bằng và Chất lượng khác nhau ở mô hình nhận dạng và độ dài câu tối đa. Em mới đo đầy đủ cho cấu hình Cân bằng, nên chưa nói được cấu hình Nhanh kém hơn bao nhiêu.

### Slide 41. Nạp mô hình, GPU Windows

**Nếu thầy cô hỏi về tốc độ khởi động và GPU:** dịch vụ không nạp mô hình lúc mở, nên mở chỉ mất 0,4 giây thay vì 45 giây. Mô hình chỉ được nạp khi cần dùng. Bản cài Windows đầu tiên chạy nhận dạng bằng CPU, mất 17,6 giây cho 3 giây âm thanh, không dùng được. Em dựng lại whisper.cpp với Vulkan để chạy trên card đồ họa, còn 0,44 giây, bộ cài chỉ nặng thêm 18 MB. Trên laptop có hai card, whisper.cpp tự chọn card tích hợp Iris Xe nên chậm gần 60 lần, vì vậy em cho ứng dụng tự tìm và chọn card rời.

### Slide 42. Điểm nghẽn TTS

**Nếu thầy cô hỏi khâu nào chậm nhất:** so với máy Mac, card đồ họa trên máy Windows làm khâu nhận dạng nhanh khoảng 8 lần và khâu dịch nhanh 2 đến 2,5 lần. Khâu đọc vẫn chạy CPU nên gần như không đổi, và trở thành khâu chậm nhất khi dịch sang tiếng Trung hay tiếng Nhật, chiếm khoảng hai phần ba thời gian cả chuỗi. Em chỉ thấy được điều này vì đo riêng từng khâu.

### Slide 43. Câu 3 giây và chạy 60 phút

**Nếu thầy cô hỏi về độ ổn định:** bảng bên trái là thời gian xử lý một câu 3 giây trên máy Mac, cả bốn chiều đều đạt mục tiêu. Bên phải là bài chạy liên tục 60 phút trên máy Windows: 877 câu, không lỗi, bộ nhớ chỉ tăng từ 1.110 lên 1.122 MB, và 10% câu cuối chỉ chậm hơn 10% câu đầu chưa tới 2 mili giây. Đây là một lần chạy trên một máy.

### Slide 44. Tách câu trên giọng thật

**Nếu thầy cô hỏi bộ tách câu đã thử trên giọng thật chưa:** em thử trên ba bản ghi YouTube dài hơn 11 phút, ba kiểu nói khác nhau. Với bản tin đọc liền mạch, trước đây 10% số câu dài hơn 12,5 giây, giờ mức đó còn 5,9 giây, đổi lại 30% số đoạn bị cắt giữa câu. Với phỏng vấn, mức đó giảm từ 6,8 xuống 5,7 giây và 10% số đoạn bị cắt. Với bài nói TEDx thì gần như không đổi và không đoạn nào bị cắt, vì người nói tự nhiên có nhiều chỗ ngừng.

### Slide 45. Tài liệu tham khảo

Không trình bày trong mạch chính. Nếu được hỏi: “Danh mục nguồn và bài báo em sử dụng được liệt kê trong báo cáo và trên slide này.”

## Ghi chú luyện tập

- Mỗi slide một thông điệp, chính là câu Tóm lại. Nói theo hình, không đọc nguyên văn chữ trên slide.
- Nêu điều kiện cùng số liệu: "RTF p90 0,383 trên Windows RTX 4060", không chỉ đọc "0,383".
- Khi nói WER 24,6%, nói ngay đây là 25 đoạn của một cuộc phỏng vấn.
- Không gọi CER là WER; không so spBLEU giữa các chiều dịch; không gộp số M4 và RTX 4060 làm một.
- Thiếu giờ thì rút phần giải thích ở slide 5, 10, 13, 14 và 22, giữ câu Tóm lại, phần kết quả, hạn chế và demo.
