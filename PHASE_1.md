# Giai đoạn 1 — Tổ chức monorepo

Ngày hoàn thành: 02/11/2026

## Kết quả

- [x] Frontend hiện tại được chuyển vào `apps/legacy-web`.
- [x] Express API, database và script được chuyển vào `apps/legacy-api`.
- [x] Root package dùng npm workspaces để điều phối hai ứng dụng.
- [x] `.env` tiếp tục nằm ở gốc repo và không được commit.
- [x] Script database dùng đường dẫn tuyệt đối tính từ vị trí file.
- [x] Production API phục vụ build tại `apps/legacy-web/dist`.
- [x] Thư mục `packages/` được dành cho mã dùng chung ở các giai đoạn sau.

## Tương thích lệnh cũ

Các lệnh sau vẫn chạy từ thư mục gốc:

```powershell
npm.cmd run dev
npm.cmd run check
npm.cmd run build
npm.cmd run smoke
npm.cmd run db:backup
npm.cmd run admin:grant -- email@example.com
```

## Xác minh

- `npm.cmd install --offline --ignore-scripts`: thành công, 0 lỗ hổng được npm báo cáo.
- `npm.cmd run check`: thành công cho cả hai workspace.
- `npm.cmd run build`: thành công.
- `npm.cmd run db:backup`: thành công, backup đủ 9 bảng.
- `npm.cmd run smoke`: thành công.
- Development: trang chủ, admin, chi tiết bài toán và API health đều trả HTTP 200.
- Production thử nghiệm trên port 3002: ba trang HTML và API health đều trả HTTP 200.

## Bước tiếp theo

Giai đoạn 2 sẽ thêm một ứng dụng NestJS mới chạy song song, chưa thay thế Express ngay. API đầu tiên gồm `/api/v1/health` và tài liệu OpenAPI tại `/docs`.
