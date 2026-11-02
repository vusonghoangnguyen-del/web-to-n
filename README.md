# Tờ Toán

Website tạp chí toán học cộng đồng với frontend HTML/CSS/JavaScript, backend Node.js/Express và MySQL. Giao diện trang chủ lấy bài toán, lời giải và video từ API; dữ liệu người dùng nằm trong MySQL.

## Yêu cầu

- Node.js 20.19+ hoặc 22.12+
- npm 10+
- MySQL Server chạy tại `127.0.0.1:3306`

## Môi trường dự án

Node.js không dùng Python `venv`. Môi trường cô lập của dự án gồm:

- `node_modules/`: package chỉ dành cho dự án này.
- `.env`: thông tin kết nối MySQL và khóa phiên, không được commit.
- `package-lock.json`: khóa chính xác phiên bản package.

Khôi phục môi trường trên một máy mới bằng `npm install`.

## Kiến trúc monorepo

Dự án dùng npm workspaces. Các lệnh ở thư mục gốc điều phối hai ứng dụng hiện tại:

- `@to-toan/legacy-web`: frontend Vite trong `apps/legacy-web`.
- `@to-toan/legacy-api`: Express API và MySQL trong `apps/legacy-api`.
- `@to-toan/api`: NestJS API TypeScript mới trong `apps/api`, hiện chạy song song để chuyển đổi an toàn.

NestJS dùng TypeORM với `synchronize: false`. Các Entity ánh xạ schema MySQL hiện tại; mọi thay đổi cấu trúc từ giai đoạn 3 phải đi qua migration được lưu trong Git.

Tên `legacy` cho biết đây là ứng dụng ổn định đang được duy trì trong lúc NestJS và Next.js được xây ở các giai đoạn tiếp theo. Nó không có nghĩa là phần này đã ngừng hoạt động.

## Thiết lập lần đầu

```powershell
npm.cmd install
npm.cmd run db:setup
```

Lệnh `db:setup` yêu cầu nhập mật khẩu MySQL `root` ngay trong terminal và không hiển thị mật khẩu. Lệnh sẽ tự động:

1. Tạo database `to_toan` với UTF-8 đầy đủ.
2. Tạo user MySQL `to_toan_app` chỉ có quyền trên database này.
3. Tạo các bảng và sáu chuyên mục mặc định.
4. Sinh mật khẩu ứng dụng và `JWT_SECRET` ngẫu nhiên.
5. Ghi cấu hình vào file `.env`.

Không dùng tài khoản `root` trong backend và không chia sẻ nội dung `.env`.

Khi cập nhật một database đã tồn tại lên phiên bản có khu thảo luận, chạy một lần:

```powershell
npm.cmd run db:migrate
```

Lệnh yêu cầu mật khẩu `root` và tạo bảng `comments` mà không thay đổi tài khoản hay dữ liệu hiện có.

## Chạy dự án

```powershell
npm.cmd run dev
```

- Website: `http://localhost:5173`
- Express API cũ: `http://127.0.0.1:3000`
- NestJS API mới: `http://127.0.0.1:3001`
- Health NestJS + MySQL: `http://127.0.0.1:3001/api/v1/health`
- Swagger: `http://127.0.0.1:3001/docs`

Nếu port 5173 đang bận, Vite sẽ báo port thực tế ở terminal. Giữ terminal chạy trong lúc dùng website.

## Chức năng cơ bản

- Đăng ký, đăng nhập, đăng xuất và khôi phục phiên.
- Tài khoản mới xác minh email trước khi hoạt động; session được lưu và có thể thu hồi trong MySQL.
- Gửi bài toán; admin duyệt hoặc từ chối trước khi bài hiển thị công khai.
- Tìm kiếm, lọc theo chuyên mục và độ khó, xem thêm từng trang.
- Trang chi tiết bài toán với bình luận, trả lời và lời giải.
- Gửi lời giải; admin kiểm chứng trước khi hiển thị cho cộng đồng.
- Lưu bài toán vào hồ sơ cá nhân; xem bài đã gửi và trạng thái lời giải.
- Admin thêm hoặc gỡ liên kết video bài giảng.
- Admin xem thảo luận gần đây và ẩn bình luận không phù hợp.
- Ghi nhận email đăng ký nhận tin. **Chưa có dịch vụ gửi email**, nên hiện chưa phát hành bản tin tự động.

## Cấp quyền và mở trang admin

Sau khi tạo tài khoản trên website, cấp quyền quản trị bằng email của tài khoản đó:

```powershell
npm.cmd run admin:grant -- email-cua-ban@example.com
```

Tải lại website để liên kết **Quản trị** xuất hiện cạnh tên tài khoản, hoặc mở trực tiếp `http://localhost:5173/admin.html`. Trang admin cho phép:

- Xem thống kê thành viên, bài toán và lời giải.
- Duyệt, từ chối, gỡ hoặc đưa bài về hàng chờ.
- Đổi vai trò và vô hiệu hóa tài khoản khác.
- Xem bài đã duyệt xuất hiện trên trang độc giả.
- Thêm hoặc gỡ video bài giảng.

Mỗi bài đã xuất bản có trang chi tiết tại `problem.html?id=<id>`. Thành viên đăng nhập có thể bình luận, trả lời; tác giả bình luận và admin có thể xóa nội dung không phù hợp.

## Các lệnh chính

- `npm.cmd run dev`: chạy đồng thời Vite, Express cũ và NestJS mới với tự động tải lại.
- `npm.cmd run dev:nest`: chỉ chạy NestJS API mới tại cổng 3001.
- `npm.cmd run check`: kiểm tra cú pháp frontend, backend và script thiết lập.
- `npm.cmd run build`: build frontend và NestJS API production.
- `npm.cmd run test`: chạy unit test của NestJS.
- `npm.cmd run test:e2e`: build NestJS rồi kiểm tra HTTP thật với MySQL, Swagger và định dạng lỗi.
- `npm.cmd run schema:log`: so sánh Entity với schema thật mà không thay đổi database.
- `npm.cmd run migration:show`: xem migration đã/chưa chạy; yêu cầu mật khẩu MySQL `root`.
- `npm.cmd run migration:run`: áp dụng migration; mật khẩu `root` được nhập ẩn trong terminal.
- `npm.cmd run migration:generate -- src/database/migrations/TenMigration`: sinh migration mới từ thay đổi Entity.
- `npm.cmd run db:backup`: tạo bản sao MySQL trong thư mục `backups/` (Windows).
- `npm.cmd run smoke`: kiểm tra chuỗi API chính bằng dữ liệu tạm và xóa dữ liệu thử sau khi chạy. Cần API đang chạy.
- `npm.cmd start`: chạy API; khi `NODE_ENV=production`, API phục vụ cả `apps/legacy-web/dist/`.

## Cấu trúc

```text
.
├── apps/
│   ├── api/                 # NestJS API mới, TypeScript strict
│   │   ├── src/
│   │   │   ├── common/
│   │   │   ├── config/
│   │   │   ├── database/    # TypeORM Entity, DataSource và migration
│   │   │   └── health/
│   │   └── test/
│   ├── legacy-web/          # Frontend Vite đang hoạt động
│   │   ├── index.html
│   │   ├── admin.html
│   │   ├── problem.html
│   │   ├── *.js
│   │   ├── *.css
│   │   ├── vite.config.js
│   │   └── package.json
│   └── legacy-api/          # Express API đang hoạt động
│       ├── database/
│       │   ├── migrations/
│       │   └── schema.sql
│       ├── scripts/
│       │   ├── backup-database.ps1
│       │   ├── setup-database.js
│       │   ├── migrate-database.js
│       │   ├── grant-admin.js
│       │   └── smoke-test.js
│       ├── server/
│       │   ├── middleware/
│       │   ├── routes/
│       │   ├── config.js
│       │   ├── paths.js
│       │   ├── db.js
│       │   └── index.js
│       └── package.json
├── packages/                # Package dùng chung ở các giai đoạn sau
├── backups/                 # Backup local, không commit
├── .env                     # Cấu hình local, không commit
├── package.json             # Điều phối npm workspaces
└── package-lock.json
```

## Dữ liệu và bảo mật

- Mật khẩu độc giả được băm bằng bcrypt trước khi lưu.
- Phiên đăng nhập nằm trong cookie `HttpOnly`, JavaScript phía trình duyệt không đọc được.
- Câu lệnh SQL nhận dữ liệu người dùng đều dùng tham số hóa.
- Bài toán mới mặc định ở trạng thái `pending` để chờ duyệt.
- Lời giải mới cũng chờ duyệt; chỉ lời giải `verified` xuất hiện công khai.
- MySQL chỉ nên được truy cập từ backend, không kết nối trực tiếp từ trình duyệt.

Các bảng hiện có: `users`, `categories`, `problems`, `problem_categories`, `solutions`, `comments`, `bookmarks`, `videos` và `newsletter_subscriptions`.

TypeORM còn tạo bảng kỹ thuật `typeorm_migrations` để ghi nhận migration đã áp dụng. Không sửa hoặc xóa bảng này bằng tay.

## Xác minh email và session

Auth mới chạy tại `/api/v1/auth` trên NestJS. Đăng ký/đăng nhập cũ của Express trả HTTP 410 để không thể bỏ qua xác minh email; Express vẫn chấp nhận session NestJS cho các module nghiệp vụ chưa chuyển.

Trong môi trường local, `MAIL_MODE=preview` lưu email xác minh vào `storage/mail-preview/` thay vì gửi ra Internet. Mở file HTML mới nhất và nhấn liên kết để kiểm tra. Thư mục này không được commit.

Để gửi email thật, cấu hình SMTP trong `.env`:

```env
APP_WEB_URL=https://ten-mien-cua-ban.example
MAIL_MODE=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your-smtp-user
MAIL_PASSWORD=your-smtp-password
MAIL_FROM="Tờ Toán <no-reply@ten-mien-cua-ban.example>"
```

Không dùng mật khẩu tài khoản email thông thường nếu nhà cung cấp yêu cầu app password. Không commit thông tin SMTP.
