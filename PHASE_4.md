# Giai đoạn 4 — Auth, session, phân quyền và xác minh email

Giai đoạn 4 chuyển chức năng tài khoản sang NestJS nhưng giữ các module bài toán, bình luận, lời giải và admin trong Express.

## API NestJS

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/email/verify`
- `POST /api/v1/auth/email/resend`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `GET /api/v1/auth/me`

## Đăng ký và xác minh email

Tài khoản mới có vai trò `reader`, trạng thái `active` và chưa thể đăng nhập cho tới khi `email_verified_at` được ghi nhận. Backend tạo token 32 byte ngẫu nhiên, chỉ lưu SHA-256 hash trong MySQL và gửi token gốc qua email xác minh.

Khi token hợp lệ, backend đặt `email_verified_at`, chuyển tài khoản sang `active`, đánh dấu token đã dùng và tạo session. Token hết hạn sau thời gian cấu hình, chỉ dùng một lần và token cũ bị vô hiệu hóa khi gửi lại.

Endpoint gửi lại luôn trả thông báo chung để tránh dò email. Có cooldown nội bộ và rate limit theo IP.

## Email local và SMTP

- `MAIL_MODE=preview`: ghi file HTML vào `storage/mail-preview/`, dành cho local và test.
- `MAIL_MODE=smtp`: gửi email thật bằng SMTP.

Không ghi token vào log. E2E đọc file preview cục bộ rồi xóa sau khi kiểm tra.

## Session

Cookie `to_toan_session` chứa token ngẫu nhiên và có `HttpOnly`, `SameSite=Lax`, `Secure` trong production. MySQL chỉ lưu hash của token trong bảng `sessions`.

Session có thời hạn, thời điểm sử dụng gần nhất, IP, user-agent và thời điểm thu hồi. Đăng xuất thu hồi session hiện tại; `logout-all` thu hồi mọi session của tài khoản.

Express tạm thời hiểu cookie NestJS bằng cách băm token và tra bảng `sessions`. Phiên JWT cũ vẫn được chấp nhận trong thời gian chuyển đổi. Đăng ký và đăng nhập Express cũ đã bị đóng bằng HTTP 410.

## Database

Migration `AuthSessionsEmailVerification1762087200000`:

- Thêm vai trò `moderator`.
- Trạng thái tài khoản gồm `active`, `suspended` và `banned`; email của tài khoản bị cấm vẫn được giữ và vẫn có ràng buộc duy nhất.
- Lưu thời điểm cấm, người thực hiện và lý do cấm; mọi session bị thu hồi ngay khi khóa hoặc cấm.
- Thêm `users.email_verified_at`.
- Tạo `sessions`.
- Tạo `email_verification_tokens`.
- Đánh dấu tài khoản cũ đang active là đã xác minh để không khóa người dùng hiện tại.

## Frontend

- Form đăng ký yêu cầu username duy nhất, mật khẩu tối thiểu 8 ký tự, nhập lại mật khẩu và đồng ý điều khoản.
- Sau đăng ký hiển thị yêu cầu kiểm tra email.
- Có nút gửi lại email xác minh.
- `verify-email.html` nhận token và gọi NestJS.
- Trang chính, chi tiết và admin khôi phục phiên qua `/api/v1/auth/me`.
- Vite proxy `/api/v1` tới NestJS 3001 và `/api` còn lại tới Express 3000.

## Vai trò và trạng thái

Vai trò: `reader`, `editor`, `moderator`, `admin`.

Trạng thái: `active`, `suspended`, `banned`.

Tài khoản chưa xác minh vẫn có trạng thái `active`, nhưng không thể đăng nhập khi `email_verified_at` còn trống. Admin được đổi vai trò, cấm và mở cấm. Moderator được quản lý nội dung và tạm khóa tài khoản reader/editor, nhưng không được đổi vai trò, cấm vĩnh viễn hoặc tác động tới moderator/admin.

`SessionGuard`, `RolesGuard`, decorator `CurrentUser` và `Roles` đã sẵn sàng cho các module NestJS tiếp theo.

## Kiểm thử

Auth E2E kiểm tra:

- Đăng ký tạo tài khoản chờ xác minh.
- Chưa xác minh không đăng nhập được.
- Email preview chứa liên kết hợp lệ.
- Xác minh kích hoạt tài khoản và tạo cookie.
- `/me` phục hồi đúng người dùng.
- Đăng xuất thu hồi session.
- Đăng nhập lại thành công.
- Response không lộ password hash.
- Session NestJS truy cập được route Express cũ.
- Dữ liệu test và email preview được dọn sau khi chạy.

## Lưu ý production

Cần cấu hình SMTP thật, HTTPS, domain chính xác trong `APP_WEB_URL`, SPF, DKIM và DMARC trước khi gửi email cho người dùng thật. Reverse proxy production phải chuyển `/api/v1` tới NestJS và các `/api` legacy còn lại tới Express.
