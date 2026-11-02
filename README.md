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
- API: `http://127.0.0.1:3000`
- Kiểm tra database: `http://127.0.0.1:3000/api/health`

Nếu port 5173 đang bận, Vite sẽ báo port thực tế ở terminal. Giữ terminal chạy trong lúc dùng website.

## Chức năng cơ bản

- Đăng ký, đăng nhập, đăng xuất và khôi phục phiên.
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

- `npm.cmd run dev`: chạy đồng thời Vite và API với tự động tải lại.
- `npm.cmd run check`: kiểm tra cú pháp frontend, backend và script thiết lập.
- `npm.cmd run build`: tạo frontend production trong `dist/`.
- `npm.cmd run db:backup`: tạo bản sao MySQL trong thư mục `backups/` (Windows).
- `npm.cmd run smoke`: kiểm tra chuỗi API chính bằng dữ liệu tạm và xóa dữ liệu thử sau khi chạy. Cần API đang chạy.
- `npm.cmd start`: chạy API; khi `NODE_ENV=production`, API phục vụ cả thư mục `dist/`.

## Cấu trúc

```text
.
├── database/
│   ├── migrations/          # Cập nhật cấu trúc database đang dùng
│   └── schema.sql           # Bảng, khóa ngoại và dữ liệu nền
├── scripts/
│   ├── setup-database.js    # Khởi tạo MySQL và sinh .env
│   ├── migrate-database.js  # Áp dụng bảng thảo luận
│   ├── grant-admin.js       # Cấp quyền admin theo email
│   └── smoke-test.js        # Kiểm tra luồng API
├── server/
│   ├── middleware/auth.js   # Xác thực cookie JWT
│   ├── routes/auth.js       # Đăng ký, đăng nhập, đăng xuất
│   ├── routes/admin.js      # Duyệt bài và quản lý tài khoản
│   ├── routes/community.js  # Bài đã lưu, video, danh sách nhận tin
│   ├── routes/problems.js   # Bài toán, bình luận, lời giải
│   ├── config.js            # Đọc biến môi trường
│   ├── db.js                # Connection pool MySQL
│   └── index.js             # Express API
├── index.html
├── admin.html               # Dashboard quản trị
├── admin.js
├── admin.css
├── problem.html             # Trang bài toán và thảo luận
├── problem.js
├── problem.css
├── script.js
├── styles.css
└── vite.config.js
```

## Dữ liệu và bảo mật

- Mật khẩu độc giả được băm bằng bcrypt trước khi lưu.
- Phiên đăng nhập nằm trong cookie `HttpOnly`, JavaScript phía trình duyệt không đọc được.
- Câu lệnh SQL nhận dữ liệu người dùng đều dùng tham số hóa.
- Bài toán mới mặc định ở trạng thái `pending` để chờ duyệt.
- Lời giải mới cũng chờ duyệt; chỉ lời giải `verified` xuất hiện công khai.
- MySQL chỉ nên được truy cập từ backend, không kết nối trực tiếp từ trình duyệt.

Các bảng hiện có: `users`, `categories`, `problems`, `problem_categories`, `solutions`, `comments`, `bookmarks`, `videos` và `newsletter_subscriptions`.
