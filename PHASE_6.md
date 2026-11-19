# Giai đoạn 6 — Chuyển frontend sang Next.js

Frontend Next.js được xây dựng song song tại `apps/web`. Bản Vite cũ trong `apps/legacy-web` tiếp tục hoạt động trong thời gian chuyển đổi để đối chiếu chức năng và giao diện.

## Tiến độ

- [x] 6.1 Nền móng Next.js, layout, header và footer
- [x] 6.2 Trang chủ
- [x] 6.3 Danh sách bài toán
- [x] 6.4 Chi tiết bài toán
- [x] 6.5 Đăng nhập và đăng ký
- [x] 6.6 Hồ sơ cá nhân
- [x] 6.7 Trang soạn bài
- [x] 6.8 Trang admin
- [x] 6.9 Trang dự án LaTeX

## 6.1 Nền móng và layout

- Tạo workspace `@to-toan/web` sử dụng Next.js App Router, React và TypeScript strict.
- Tạo Root Layout dùng chung với metadata SEO, ngôn ngữ tiếng Việt và màu giao diện.
- Component hóa Header, điều hướng responsive và Footer.
- Giữ phong cách báo in, bảng màu và typography của giao diện hiện tại.
- Cấu hình proxy `/api/v1/*` tới NestJS và `/api/*` tới Express cũ trong giai đoạn chuyển tiếp.
- Next.js chạy ở `http://localhost:5174`, không xung đột Vite cũ ở cổng 5173.

## 6.2 Trang chủ

- Trang chủ là Server Component, được prerender và tự cập nhật dữ liệu sau mỗi 60 giây.
- Bài nổi bật, bài mới, tổng số bài, chuyên mục, độ khó và số thảo luận được lấy từ `GET /api/v1/problems` của NestJS.
- Có trạng thái rỗng và trạng thái API chưa chạy, nên trang vẫn render an toàn khi backend tạm thời không khả dụng.
- Chuyển các khu vực lời tòa soạn, kho bài, lời giải cộng đồng, video bài giảng và nhận bản tin sang component Next.js.
- Lời giải nổi bật, video và đăng ký nhận tin tạm thời đi qua Express bằng proxy trong giai đoạn chuyển tiếp.
- Các link chi tiết bài đã được mục 6.4 chuyển sang URL slug thân thiện của Next.js.
- Form nhận tin là Client Component; phần nội dung còn lại không gửi JavaScript không cần thiết xuống trình duyệt.
- Metadata riêng cho trang chủ đã được bổ sung.

### Kiểm thử

- TypeScript check và production build Next.js thành công.
- Bản build tạo trang chủ ISR với thời gian revalidate 60 giây.
- Runtime trả HTTP 200 và HTML có tiêu đề bài toán thật lấy từ MySQL qua NestJS.
- Proxy `/api/v1/health` qua Next.js trả HTTP 200.
- Build vẫn hoàn thành khi API chưa chạy nhờ trạng thái dự phòng.

## 6.3 Danh sách bài toán

- Tạo trang `/bai-toan` bằng Server Component để nội dung được render sẵn, thân thiện với SEO.
- Lấy danh sách và tổng số bài từ `GET /api/v1/problems` của NestJS.
- Hỗ trợ tìm kiếm, lọc theo chuyên mục, lọc theo độ khó và phân trang hoàn toàn qua query string trên URL.
- Giữ lại điều kiện lọc khi chuyển trang và chuẩn hóa tham số đầu vào không hợp lệ để trang không bị lỗi.
- Hiển thị chuyên mục, tác giả, mô tả ngắn, độ khó và số lượt thảo luận trên từng thẻ bài.
- Có trạng thái không tìm thấy kết quả và trạng thái backend tạm thời không khả dụng.
- Các link trong danh sách đã được mục 6.4 chuyển sang trang chi tiết Next.js.

### Kiểm thử

- TypeScript check và production build toàn bộ monorepo thành công.
- Route `/bai-toan` được Next.js build ở chế độ dynamic server rendering.
- Trang danh sách trả HTTP 200 và hiển thị dữ liệu bài toán thật từ MySQL.
- Tìm kiếm bằng query string trả HTTP 200 và giữ đúng giá trị trong biểu mẫu.
- Các tham số không hợp lệ như số trang âm hoặc chuyên mục không tồn tại được xử lý an toàn.

## 6.4 Chi tiết bài toán

- Tạo route động `/bai-toan/[slug]` và vẫn hỗ trợ ID để các liên kết dữ liệu cũ tiếp tục hoạt động.
- Render phía server đề bài, thông tin tác giả, chuyên mục, độ khó, nguồn tham khảo, lời giải đã kiểm chứng và cây thảo luận.
- Bổ sung metadata động, canonical URL, Open Graph và dữ liệu có cấu trúc Article theo từng bài toán.
- Chuyển toàn bộ link bài toán trên trang chủ và trang danh sách khỏi Vite sang route Next.js.
- Bổ sung thao tác lưu bài, thích và theo dõi; khách chưa đăng nhập được chuyển tới luồng đăng nhập.
- Người đã đăng nhập có thể gửi lời giải và bình luận qua NestJS API; lời giải mới tiếp tục qua quy trình kiểm duyệt hiện có.
- Có trang lỗi thân thiện khi API chưa chạy và trả HTTP 404 đúng cho slug không tồn tại.

### Kiểm thử

- TypeScript check và production build Next.js thành công.
- Route động `/bai-toan/[slug]` được build ở chế độ server rendering.
- Trang chi tiết bài thật từ MySQL trả HTTP 200, có đúng tiêu đề, khu vực lời giải và thảo luận.
- Slug không tồn tại trả HTTP 404.

## 6.5 Đăng nhập, đăng ký và xác minh email

- Tạo các route `/dang-nhap`, `/dang-ky`, `/kiem-tra-email` và `/xac-minh-email` bằng Next.js.
- Form đăng ký áp dụng cùng validation với NestJS: tên đăng nhập 3–30 ký tự, mật khẩu tối thiểu 8 ký tự, xác nhận mật khẩu và đồng ý điều khoản.
- Sau khi đăng ký thành công, email được lưu tạm trong sessionStorage và người dùng được chuyển tới trang chờ xác minh.
- Trang chờ có chức năng gửi lại email và bộ đếm 60 giây để phù hợp giới hạn phía API.
- Trang xác minh nhận token, gọi NestJS, tạo session HTTP-only và hiển thị trạng thái thành công hoặc liên kết hết hạn.
- Đăng nhập hỗ trợ quay lại trang người dùng đang đọc qua tham số `return` đã được kiểm tra an toàn.
- Header tự nhận phiên đăng nhập, hiển thị menu tài khoản, số thông báo chưa đọc và chức năng đăng xuất.
- Email xác minh từ NestJS đã chuyển khỏi `verify-email.html` sang route `/xac-minh-email` của Next.js.
- URL frontend local mặc định được chuyển sang `http://localhost:5174`; Vite cũ vẫn nằm trong danh sách CORS trong thời gian chuyển tiếp.

### Kiểm thử

- TypeScript check, unit test cấu hình API và production build Next.js thành công.
- Bốn trang xác thực đều trả HTTP 200 khi chạy local.
- Request đăng nhập và xác minh không hợp lệ đi qua proxy Next.js và được NestJS từ chối bằng HTTP 400 như mong đợi.
- Không tạo tài khoản rác trong lúc kiểm thử runtime.

## 6.6 Hồ sơ cá nhân

- Tạo route riêng tư `/ho-so`; khách chưa đăng nhập được chuyển tới `/dang-nhap?return=/ho-so`.
- Hiển thị thông tin tài khoản, vai trò và thống kê nhanh cho bài toán, lời giải, bài đã lưu và thông báo chưa đọc.
- Khu vực bài đăng hiển thị trạng thái bản nháp, chờ duyệt, đã xuất bản hoặc bị từ chối.
- Khu vực lời giải hiển thị trạng thái kiểm duyệt, nội dung tóm tắt và ghi chú của tòa soạn nếu có.
- Bài đã lưu và bài đang theo dõi liên kết thẳng tới trang chi tiết; người dùng có thể bỏ lưu hoặc bỏ theo dõi ngay trong hồ sơ.
- Danh sách thông báo phân biệt đã đọc/chưa đọc, liên kết tới bài liên quan và hỗ trợ đánh dấu tất cả đã đọc.
- Bổ sung thao tác thu hồi toàn bộ phiên đăng nhập trên mọi thiết bị với bước xác nhận.
- Menu tài khoản trên header liên kết trực tiếp tới hồ sơ và khu vực thông báo.

### Kiểm thử

- TypeScript check và production build Next.js thành công.
- Route `/ho-so` trả HTTP 200 và render shell tải hồ sơ.
- Tất cả endpoint hồ sơ riêng tư trả HTTP 401 khi không có session.
- Trạng thái loading, lỗi API, dữ liệu trống và session hết hạn đều có xử lý riêng.

## 6.7 Trang soạn bài

- Tạo route riêng tư `/soan-bai`; khách chưa đăng nhập được chuyển tới đăng nhập và quay lại đúng URL.
- Form hỗ trợ tiêu đề, đề bài, nguồn, 1–5 chuyên mục, độ khó và ghi chú thay đổi.
- Có hai hành động riêng: lưu bản nháp và gửi tòa soạn duyệt.
- Chỉnh sửa bài qua `/soan-bai?id=...`, chỉ mở khi người dùng là chủ bài hoặc có quyền phù hợp theo NestJS.
- Hiển thị preview trực tiếp, bộ đếm ký tự, mức độ hoàn thiện và cảnh báo khi rời trang với thay đổi chưa lưu.
- Hiển thị lịch sử phiên bản, người chỉnh sửa, thời điểm và ghi chú thay đổi.
- Bài đã xuất bản được mở ở chế độ chỉ đọc trên bàn soạn; việc đính chính sẽ đi qua moderator/admin.
- Hồ sơ cá nhân có liên kết sửa cho bài nháp, bài chờ duyệt và bài bị từ chối; menu tài khoản có lối tắt đăng bài mới.

### Kiểm thử

- TypeScript check và production build Next.js thành công.
- Route `/soan-bai` trả HTTP 200; API tạo bài trả HTTP 401 khi không có session.
- E2E bằng dữ liệu tạm xác nhận tạo nháp, danh sách của tôi, sửa, gửi duyệt, lịch sử phiên bản, slug và xóa mềm; dữ liệu thử được dọn sau khi chạy.

## 6.8 Trang admin

- Tạo route riêng tư `/admin`, chỉ cho phép tài khoản `moderator` và `admin` truy cập; tài khoản chưa đăng nhập được chuyển về luồng đăng nhập.
- Hiển thị thống kê bài chờ duyệt, lời giải chờ duyệt, báo cáo mới, tổng tài khoản và bài đã xuất bản.
- Duyệt, từ chối hoặc đưa bài toán về trạng thái chờ duyệt, kèm ghi chú kiểm duyệt.
- Kiểm chứng hoặc từ chối lời giải; lời giải đã kiểm chứng có thể được đánh dấu nổi bật.
- Ẩn và hiện lại bình luận trực tiếp từ bàn biên tập.
- Xử lý báo cáo bằng cách ẩn bình luận hoặc bỏ qua báo cáo.
- Hiển thị nhật ký kiểm duyệt để truy vết người thực hiện, hành động, đối tượng và thời gian.
- Bổ sung liên kết “Bàn biên tập” trong menu tài khoản cho đúng hai vai trò có quyền.

### Kiểm thử

- TypeScript strict check và production build Next.js thành công.
- Route `/admin` được build thành công; toàn bộ thao tác ghi sử dụng API NestJS `/api/v1` và cookie phiên hiện tại.
- API tiếp tục là lớp quyết định quyền cuối cùng; giao diện ẩn liên kết không thay thế kiểm tra `SessionGuard` và `RolesGuard`.

## 6.9 Trang dự án LaTeX

- Tạo route riêng tư `/latex` và liên kết “Dự án LaTeX” trong menu tài khoản.
- Cho phép tạo nhiều dự án cục bộ, đổi tên, chọn `pdfLaTeX`, `XeLaTeX` hoặc `LuaLaTeX` và chỉnh sửa tệp `main.tex`.
- Tự động lưu sau khi người dùng dừng nhập, tách dữ liệu theo tài khoản và hiển thị thời điểm cập nhật gần nhất.
- Có thể tải mã nguồn dự án về tệp `.tex` và xóa bản nháp với bước xác nhận.
- Dữ liệu ở giai đoạn frontend được lưu trong `localStorage`; giao diện ghi rõ chưa đồng bộ lên máy chủ để tránh hiểu nhầm.
- Việc lưu dự án trong MySQL thuộc giai đoạn 8; biên dịch PDF cách ly thuộc giai đoạn 9 và chưa được giả lập trong giai đoạn này.

### Kiểm thử

- TypeScript strict check và production build Next.js thành công.
- Route `/latex` được build thành công, kiểm tra phiên trước khi tải workspace và hoạt động không phụ thuộc backend LaTeX chưa được triển khai.

## Kết luận

Giai đoạn 6 đã hoàn thành toàn bộ chín mục. Frontend Next.js hiện có layout, trang chủ, kho bài, chi tiết bài, xác thực, hồ sơ, trang soạn bài, bàn biên tập và workspace LaTeX cục bộ.

## Việc tiếp theo

Giai đoạn 7 sẽ bổ sung luồng Markdown + MathJax thống nhất cho bài toán, lời giải, bình luận và phần xem trước khi soạn.
