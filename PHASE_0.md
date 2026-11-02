# Giai đoạn 0 — Mốc ổn định ban đầu

Ngày kiểm tra: 02/11/2026

## Kết quả

- [x] MySQL hoạt động và API health báo `database: connected`.
- [x] `npm.cmd run check` thành công.
- [x] `npm.cmd run build` thành công.
- [x] `npm.cmd run smoke` thành công.
- [x] Đã tạo backup MySQL hoàn chỉnh gồm 9 bảng.
- [x] `.env`, `backups/`, `storage/`, `node_modules/` và `dist/` được Git bỏ qua.
- [x] Không phát hiện GitHub token hoặc private key trong mã nguồn chuẩn bị commit.

## Backup database

```powershell
npm.cmd run db:backup
```

Backup được tạo trong `backups/`. Thư mục này không được đưa lên GitHub vì có thể chứa dữ liệu người dùng.

## Bộ kiểm tra trước mỗi mốc

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run smoke
```

Lệnh `smoke` cần API đang chạy và tự xóa dữ liệu thử sau khi hoàn thành.
