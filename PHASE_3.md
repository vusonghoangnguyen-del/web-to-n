# Giai đoạn 3 — Chuẩn hóa database và migration

Giai đoạn 3 đưa schema MySQL hiện tại vào quản lý bằng TypeORM mà không thay đổi dữ liệu và không tắt Express.

## Kết quả

- Tích hợp `@nestjs/typeorm` và TypeORM vào NestJS.
- `synchronize: false` và `migrationsRun: false` trong mọi cấu hình.
- Health check dùng chính TypeORM `DataSource`.
- Ánh xạ 9 Entity:
  - `UserEntity`
  - `CategoryEntity`
  - `ProblemEntity`
  - `ProblemCategoryEntity`
  - `SolutionEntity`
  - `CommentEntity`
  - `BookmarkEntity`
  - `VideoEntity`
  - `NewsletterSubscriptionEntity`
- ID `BIGINT` được biểu diễn bằng `string` trong TypeScript để không mất độ chính xác.
- Tên bảng, cột, index, enum, timestamp và khóa ngoại khớp schema legacy.
- Baseline migration `BaselineSchema1762080000000` có thể dựng các bảng trên database trống và không tạo lại bảng khi database đã tồn tại.
- Baseline không cho phép tự động revert vì thao tác đó có thể xóa toàn bộ dữ liệu legacy.
- Bảng `typeorm_migrations` ghi nhận baseline đã áp dụng.
- Integration test đọc toàn bộ Entity và xác nhận migration bằng TypeORM.

## An toàn dữ liệu

Trước khi chạy baseline đã tạo backup MySQL trong thư mục `backups/`. Thư mục này bị Git bỏ qua.

Tài khoản ứng dụng chỉ có quyền `SELECT`, `INSERT`, `UPDATE`, `DELETE`. Các lệnh migration dùng tài khoản `root` qua script tương tác; mật khẩu được nhập ẩn và không lưu vào `.env` hay lịch sử command.

Không bật `synchronize: true`, kể cả trong môi trường phát triển. Dùng `schema:log` để xem khác biệt và tạo migration để thay đổi schema.

## Lệnh sử dụng

```powershell
npm.cmd run schema:log
npm.cmd run migration:show
npm.cmd run migration:run
npm.cmd run migration:revert
npm.cmd run migration:generate -- src/database/migrations/TenMigration
```

`migration:show`, `migration:run` và `migration:revert` yêu cầu nhập mật khẩu MySQL `root` ngay trong terminal. Không hiển thị và không ghi mật khẩu vào command.

## Quy trình cho thay đổi schema tiếp theo

1. Tạo backup database.
2. Sửa Entity.
3. Chạy `schema:log` để xem SQL dự kiến.
4. Sinh migration có tên rõ nghĩa.
5. Đọc migration và kiểm tra `up`/`down`.
6. Chạy migration trên database phát triển.
7. Chạy `check`, `test`, `test:e2e`, `build` và smoke test.
8. Chỉ sau đó mới commit migration.

## Kiểm chứng hoàn thành

- Baseline được ghi nhận trong `typeorm_migrations`.
- `schema:log` báo schema đã cập nhật, không có SQL đồng bộ cần chạy.
- 9 Entity đọc được dữ liệu hiện tại.
- NestJS kết nối MySQL qua TypeORM.
- Express vẫn dùng chung dữ liệu và tiếp tục hoạt động.
