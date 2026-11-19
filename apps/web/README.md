# Next.js frontend

Frontend Next.js đang dùng của Tờ Toán.

## Chạy local

Từ thư mục gốc:

```bash
npm run dev
```

Mở `http://127.0.0.1:5174`. Lệnh trên chạy Next.js ở cổng 5174 và NestJS ở cổng 3001. Next.js chuyển `/api/v1/*` tới NestJS để cookie hoạt động cùng origin. Dùng cùng địa chỉ `127.0.0.1` khi mở liên kết xác minh email.
