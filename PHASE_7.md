# Giai đoạn 7 — Markdown và MathJax

Giai đoạn 7 chuẩn hóa cách soạn và hiển thị nội dung toán học trên frontend Next.js. Nội dung nguồn tiếp tục được lưu dưới dạng văn bản Markdown + TeX; HTML kết quả chỉ được tạo khi render.

## Tiến độ

- [x] Bộ render Markdown dùng chung
- [x] Công thức TeX nội dòng và dạng khối
- [x] Render bài toán, lời giải và bình luận
- [x] Preview khi soạn bài, gửi lời giải và bình luận
- [x] Toolbar nhập nhanh công thức
- [x] Kiểm tra an toàn HTML và liên kết
- [x] Kiểm thử renderer và production build

## Định dạng nội dung

- CommonMark và GitHub Flavored Markdown cho tiêu đề, nhấn mạnh, danh sách, trích dẫn, bảng, liên kết và code.
- Công thức nội dòng đặt trong `$...$`.
- Công thức dạng khối đặt trong `$$...$$`.
- `remark-math` phân tích cú pháp toán; MathJax trên trình duyệt chuyển công thức thành SVG.
- Bundle MathJax SVG được phục vụ từ `apps/web/public/vendor/mathjax/`, không phụ thuộc CDN.

## An toàn

- HTML thô trong nội dung người dùng bị tắt bằng `skipHtml`.
- Không dùng `dangerouslySetInnerHTML` để render bài viết, lời giải hoặc bình luận.
- Liên kết chỉ chấp nhận đường dẫn nội bộ, `http:`, `https:` hoặc `mailto:`.
- Liên kết bên ngoài dùng `nofollow ugc noopener` và mở ở tab mới.
- Nội dung nguồn vẫn là chuỗi văn bản; MathJax không thực thi mã JavaScript từ nội dung.

## Trải nghiệm soạn thảo

- Toolbar dùng chung hỗ trợ in đậm, in nghiêng, công thức nội dòng, phân số, căn, số mũ, tổng, tích phân và ma trận.
- Nút toolbar bọc vùng văn bản đang chọn; nếu chưa chọn thì chèn ví dụ có thể sửa ngay.
- Preview cập nhật sau khi dừng nhập 400 ms để tránh render MathJax trên mỗi phím gõ.
- Trang soạn bài giữ bố cục hai cột nguồn và xem trước.
- Form lời giải và bình luận có vùng preview riêng trước khi gửi.

## Nơi đã áp dụng

- Đề bài trên `/bai-toan/[slug]`.
- Lời giải đã kiểm chứng.
- Cây bình luận và trả lời.
- Preview trang `/soan-bai`.
- Form gửi lời giải và bình luận.
- Nội dung trong `/admin` để moderator thấy đúng công thức khi duyệt.

## Kiểm thử

- Unit test xác nhận Markdown, GFM và ký hiệu công thức được chuẩn bị cho MathJax trên trình duyệt.
- Unit test xác nhận thẻ `<script>` và URL `javascript:` không đi vào DOM.
- TypeScript strict check thành công.
- Production build Next.js thành công.
- Bundle `tex-svg-full.js` được lưu cục bộ cùng giấy phép MathJax; trình duyệt tải từ `/vendor/mathjax/tex-svg-full.js`.

## Kết luận

Giai đoạn 7 đã hoàn thành. Website có một pipeline nội dung thống nhất từ Markdown + TeX tới HTML an toàn và công thức MathJax, dùng chung cho đọc, soạn và kiểm duyệt.

## Việc tiếp theo

Giai đoạn 8 sẽ đưa dự án LaTeX từ bản nháp `localStorage` sang MySQL với entity, migration và API quản lý project/file.
