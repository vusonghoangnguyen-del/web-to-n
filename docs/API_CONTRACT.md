# Hợp đồng API giữa Codex và Kombai

Tài liệu này là nguồn chuẩn chung cho backend (Codex) và frontend (Kombai).
Nếu mã nguồn, mock data hoặc trao đổi trong chat khác với hợp đồng này, nội dung
trong `docs/openapi.yaml` được ưu tiên.

## 1. Phân công

- **Codex / Backend**: thiết kế dữ liệu, bảo mật, database, API và kiểm thử API.
- **Kombai / Frontend**: thiết kế UI/UX, trạng thái giao diện và tích hợp API.
- **Codex điều phối tích hợp**: cập nhật hợp đồng, sinh kiểu dữ liệu nếu có thể,
  chạy kiểm tra build/type/test và xử lý điểm không khớp giữa hai phía.

## 2. Quy trình bắt buộc cho mỗi tính năng

1. Codex mô tả endpoint, request, response và lỗi trong `docs/openapi.yaml`.
2. Kombai chỉ dùng đúng endpoint và trường dữ liệu đã khai báo; không tự đoán.
3. Khi backend chưa hoàn thành, frontend dùng mock có cùng cấu trúc và ví dụ với OpenAPI.
4. Codex triển khai backend theo hợp đồng và thêm kiểm thử cho các response chính.
5. Hai phía chạy kiểm tra tích hợp. Chỉ coi tính năng hoàn tất khi loading, empty,
   success, validation error, unauthorized và server error đã được xử lý phù hợp.

Nếu một phía cần thay đổi hợp đồng, phải sửa OpenAPI trước rồi mới sửa code.

## 3. Quy ước chung

- Base URL phát triển: `/api/v1`.
- Gửi và nhận JSON với `Content-Type: application/json; charset=utf-8`.
- Tên trường JSON dùng `camelCase`.
- ID luôn là `string`, kể cả khi database dùng số.
- Thời gian dùng ISO 8601 UTC, ví dụ `2026-11-20T08:30:00Z`.
- Ngày không kèm giờ dùng `YYYY-MM-DD`.
- Tiền tệ dùng số nguyên theo đơn vị nhỏ nhất (`amountMinor`) kèm mã ISO 4217
  (`currency`), không dùng số thực.
- Trường có thể rỗng phải khai báo rõ `null`; trường không có ý nghĩa thì nên bỏ khỏi response.
- Boolean chỉ dùng `true` hoặc `false`, không dùng `0`, `1` hay chuỗi.
- Danh sách luôn trả về mảng; không trả `null` thay cho mảng rỗng.

## 4. HTTP status

- `200 OK`: đọc/cập nhật thành công.
- `201 Created`: tạo mới thành công.
- `204 No Content`: thành công và không có response body.
- `400 Bad Request`: request sai định dạng.
- `401 Unauthorized`: thiếu hoặc hết hạn đăng nhập.
- `403 Forbidden`: đã đăng nhập nhưng không có quyền.
- `404 Not Found`: tài nguyên không tồn tại.
- `409 Conflict`: xung đột trạng thái hoặc dữ liệu trùng.
- `422 Unprocessable Content`: dữ liệu hợp lệ về JSON nhưng sai quy tắc nghiệp vụ.
- `429 Too Many Requests`: vượt giới hạn truy cập.
- `500 Internal Server Error`: lỗi ngoài dự kiến; không để lộ stack trace.

## 5. Cấu trúc lỗi chuẩn

Mọi lỗi có response body phải theo dạng:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu chưa hợp lệ.",
    "fieldErrors": {
      "email": ["Email không đúng định dạng."]
    },
    "requestId": "req_01J..."
  }
}
```

- `code` là mã ổn định để frontend xử lý logic; không dùng `message` để rẽ nhánh.
- `message` là nội dung an toàn để hiển thị hoặc ghi log.
- `fieldErrors` chỉ có khi lỗi gắn với trường nhập liệu.
- `requestId` giúp đối chiếu log frontend và backend.

## 6. Phân trang

Endpoint danh sách dùng `page` (bắt đầu từ 1) và `pageSize` (mặc định 20,
tối đa 100). Response chuẩn:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

## 7. Xác thực và bảo mật

- Nếu tính năng cần đăng nhập, dùng `Authorization: Bearer <access-token>`.
- Không lưu mật khẩu, access token dài hạn hoặc secret trong repository.
- Frontend không được xem việc ẩn nút là biện pháp phân quyền; backend luôn kiểm tra quyền.
- Cookie xác thực (nếu dùng) phải là `HttpOnly`, `Secure` ở production và có
  `SameSite` phù hợp.
- Endpoint tạo/cập nhật quan trọng nên hỗ trợ `Idempotency-Key` khi có nguy cơ gửi lặp.
- CORS production chỉ cho phép các origin đã cấu hình.

## 8. Thay đổi và tương thích

- Thêm trường response tùy chọn: thay đổi tương thích.
- Xóa/đổi tên trường, đổi kiểu, đổi ý nghĩa hoặc làm trường tùy chọn thành bắt buộc:
  thay đổi phá vỡ tương thích.
- Thay đổi phá vỡ tương thích phải tạo phiên bản API mới (ví dụ `/api/v2`) hoặc
  có giai đoạn chuyển tiếp được ghi rõ.
- Mỗi thay đổi OpenAPI phải cập nhật `info.version` và phần nhật ký bên dưới.

## 9. Điều kiện hoàn tất

Một tính năng chỉ được đánh dấu hoàn tất khi:

- OpenAPI mô tả đầy đủ request, response, lỗi và ví dụ.
- Backend tuân thủ hợp đồng và có kiểm thử phù hợp.
- Frontend không còn mock ngoài môi trường phát triển.
- Build và type-check thành công.
- Các trạng thái loading, empty, success và error đều có giao diện.
- Không có secret hoặc dữ liệu nhạy cảm xuất hiện trong log/client bundle.

## 10. Nhật ký thay đổi

- `0.1.0` — Tạo hợp đồng nền và endpoint kiểm tra hệ thống.
