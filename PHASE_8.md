# Giai đoạn 8: dự án LaTeX trong MySQL

## Bản đầu đã triển khai

- Mỗi tài khoản đăng nhập có thể tạo nhiều dự án riêng tại `/latex`.
- Mỗi dự án có `main.tex`, tên và lựa chọn `pdfLaTeX`, `XeLaTeX` hoặc `LuaLaTeX`.
- Mã nguồn được lưu trong cột `MEDIUMTEXT` của MySQL. Trang tự lưu sau khi ngừng gõ; khi đổi dự án, trang đợi lưu xong để tránh mất dữ liệu.
- Có thể mở lại dự án, sửa, xóa và tải `main.tex` về máy.
- Bản nháp cũ trong `localStorage` có thể nhập lên MySQL bằng nút trong trang LaTeX. Bản gốc trên trình duyệt được giữ lại để dự phòng.
- API kiểm tra phiên đăng nhập và giới hạn quyền truy cập theo chủ sở hữu. Tài khoản khác nhận 404 khi truy cập dự án hoặc tệp.

## Database và API

Migration `1763596800000-latex-projects.ts` tạo `latex_projects` và `latex_files`. Tệp có đường dẫn tương đối `main.tex`; nội dung tối đa một triệu ký tự. Chạy migration trên máy mới:

```powershell
npm.cmd run migration:run
```

Các route hiện có:

| Phương thức | Đường dẫn | Tác dụng |
| --- | --- | --- |
| GET | `/api/v1/latex/projects` | Danh sách dự án của tôi |
| POST | `/api/v1/latex/projects` | Tạo dự án và `main.tex` |
| GET | `/api/v1/latex/projects/:id` | Mở dự án và nguồn |
| PATCH | `/api/v1/latex/projects/:id` | Sửa tên hoặc compiler |
| PUT | `/api/v1/latex/projects/:id/files/:fileId` | Lưu nguồn `main.tex` |
| DELETE | `/api/v1/latex/projects/:id` | Xóa dự án |

## Kiểm tra

`npm.cmd run check --workspace=@to-toan/api` và `npm.cmd run check --workspace=@to-toan/web` kiểm tra kiểu dữ liệu. `node apps/api/test/latex.e2e.mjs` kiểm tra tạo, liệt kê, phân quyền, sửa, lưu, mở lại và xóa trên MySQL thật; dữ liệu thử được xóa sau khi chạy.

## Phần mở rộng

Bản đầu chỉ quản lý `main.tex`. Nhiều tệp, thư mục, lịch sử sửa đổi và xuất ZIP là bước mở rộng sau. Biên dịch PDF, log và trạng thái build đã được bổ sung ở [PHASE_9.md](PHASE_9.md).
