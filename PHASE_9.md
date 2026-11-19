# Giai đoạn 9: biên dịch tài liệu LaTeX

## Đã triển khai

- Trang `/latex` nhận toàn bộ nội dung `main.tex`, gồm phần mở đầu, tiêu đề, các mục và công thức. Có thể nhập tệp `.tex` đã soạn trên máy, sửa tiếp và tải nguồn về.
- Dự án có thể chứa nhiều tệp trong thư mục con. Có thể tạo/sửa `.tex`, `.bib`, `.sty`, `.cls`, tải ảnh PNG/JPEG/PDF/EPS lên, nhập ZIP dự án TeXstudio và xuất ZIP toàn bộ dự án.
- Nút **Biên dịch PDF** lưu bản thảo hiện tại rồi tạo một build có bản chụp mã nguồn riêng. Sửa bản thảo sau khi bấm nút không làm thay đổi build đang chạy.
- API gửi job vào Redis/BullMQ. Worker riêng lấy mã nguồn từ MySQL, chạy `latexmk` trong TeX Live container và lưu PDF vào `storage/latex-builds/`; trạng thái và log lưu trong MySQL.
- Giao diện cập nhật trạng thái, cho xem/tải PDF, xem log và mở lại các lần biên dịch trước. PDF và build chỉ chủ dự án mới đọc được.
- Hỗ trợ `pdfLaTeX`, `XeLaTeX`, `LuaLaTeX`. Mẫu mới dùng XeLaTeX và font TeX Gyre Termes để viết tiếng Việt.

Đây là **biên dịch tài liệu LaTeX thật** thành PDF, không phải chỉ hiển thị công thức bằng MathJax. Mỗi build chụp toàn bộ cây tệp thành ZIP riêng. Có thể dùng `\input`, `\includegraphics` và BibTeX với đường dẫn tương đối. Các gói cần `shell-escape` hoặc truy cập mạng không chạy trong worker.

## Chạy trên máy local

1. Cài và mở Docker Desktop. Chạy `docker pull texlive/texlive:latest` một lần; image TeX Live đầy đủ khá lớn.
2. Chạy `docker compose -f compose.latex.yml up -d` để bật Redis trên `127.0.0.1:6379`.
3. Chạy migration `npm.cmd run migration:run` bằng tài khoản MySQL có quyền sửa schema. Migration `1763769600000-latex-multiple-files.ts` thêm dữ liệu nhị phân và ZIP snapshot.
4. Chạy website/API bằng `npm.cmd run dev` và chạy worker trong terminal khác bằng `npm.cmd run dev:worker`.

Trên Windows, `KHOI_DONG_WEB.bat` cố gắng mở Docker Desktop, bật Redis và worker cùng website. Nếu Docker chưa sẵn sàng, web vẫn chạy nhưng biên dịch PDF chưa dùng được. Redis và Docker chỉ cần cho tác vụ biên dịch.

Biến cấu hình tùy chọn: `REDIS_URL` (mặc định `redis://127.0.0.1:6379`), `LATEX_IMAGE` (mặc định `texlive/texlive:latest`) và `LATEX_STORAGE_DIR` (mặc định `storage/latex-builds`). Thư mục PDF nằm trong `.gitignore`; cần sao lưu riêng nếu muốn giữ kết quả lâu dài.

## API và dữ liệu

Migration `1763683200000-latex-builds.ts` tạo bảng `latex_builds` với trạng thái `queued`, `compiling`, `success`, `failed`, `cancelled`, bản chụp nguồn, mã SHA-256, đường dẫn PDF, log và thời gian. Các route đều cần phiên đăng nhập và quyền sở hữu dự án:

| Phương thức | Đường dẫn | Tác dụng |
| --- | --- | --- |
| POST | `/api/v1/latex/projects/:id/compile` | Tạo build, trả HTTP 202 |
| GET | `/api/v1/latex/projects/:id/builds` | Danh sách 20 build gần nhất |
| GET | `/api/v1/latex/projects/:id/builds/:buildId` | Trạng thái và log |
| GET | `/api/v1/latex/projects/:id/builds/:buildId/pdf` | Đọc PDF nếu đã thành công |
| POST | `/api/v1/latex/projects/import-zip` | Nhập dự án ZIP |
| POST | `/api/v1/latex/projects/:id/files` | Tạo tệp văn bản |
| POST | `/api/v1/latex/projects/:id/files/upload` | Tải tệp hỗ trợ lên |
| GET | `/api/v1/latex/projects/:id/files/:fileId/raw` | Xem/tải tệp |
| DELETE | `/api/v1/latex/projects/:id/files/:fileId` | Xóa tệp phụ |
| GET | `/api/v1/latex/projects/:id/export` | Xuất dự án ZIP |

## Giới hạn và kiểm tra

Mỗi container tắt mạng và `shell-escape`, chỉ có một CPU, tối đa 512 MB RAM, không có quyền root, filesystem chỉ đọc ngoài thư mục làm việc và bị xóa sau job. Thời gian tối đa 30 giây cho pdfLaTeX/XeLaTeX, 90 giây cho LuaLaTeX vì lần chạy đầu phải tạo cache font. Tối đa 100 tệp/dự án; mỗi tệp văn bản tối đa 1 MB, tệp nhị phân 5 MB, cả dự án 25 MB, ZIP nhập 20 MB. PDF tối đa 20 MB, log tối đa 500.000 ký tự. Worker chạy độc lập với API và mỗi lần chỉ biên dịch một job; có thể chạy thêm worker khi cần.

Đã kiểm tra build API/web, migration MySQL, biên dịch PDF bằng cả ba compiler; kiểm thử `node apps/api/test/latex-build.e2e.mjs` xác nhận `\input` từ thư mục con, ảnh PNG qua `\includegraphics`, tài liệu tham khảo BibTeX, ZIP xuất/nhập lại, PDF thật, lỗi biên dịch có log, phân quyền và xóa dự án. ZIP cần `main.tex` ở gốc hoặc đúng một tệp `.tex` gốc để dùng làm tệp chính; cho phép một thư mục bao ngoài. Chưa có quản lý gói TeX Live riêng hoặc chức năng xuất bản bài báo trực tiếp từ dự án.
