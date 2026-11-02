# Giai đoạn 2 — Dựng NestJS song song

Giai đoạn 2 tạo backend NestJS mới mà không tắt hoặc thay đổi hành vi của Express hiện tại.

## Thành phần đã hoàn thành

- Workspace `@to-toan/api` tại `apps/api`.
- TypeScript strict mode và build production bằng Nest CLI.
- API có version với endpoint `GET /api/v1/health`.
- Health check truy cập MySQL thật, không chỉ kiểm tra tiến trình API.
- Swagger UI tại `/docs`, OpenAPI JSON tại `/docs-json`.
- Kiểm tra biến môi trường ngay khi khởi động.
- ValidationPipe toàn cục cho DTO ở các module tiếp theo.
- Định dạng lỗi thống nhất gồm `statusCode`, `message`, `path`, `timestamp`.
- Log JSON có timestamp, level và context.
- Helmet, CORS theo danh sách origin và rate limit 100 request/phút.
- Unit test cho cấu hình và integration test qua HTTP production artifact.
- Express tiếp tục chạy ở cổng 3000; NestJS chạy ở cổng 3001.

## Chạy và kiểm tra

```powershell
npm.cmd run dev
npm.cmd run check
npm.cmd run test
npm.cmd run test:e2e
npm.cmd run build
```

Địa chỉ dùng khi phát triển:

- Frontend cũ: `http://localhost:5173`
- Express API: `http://127.0.0.1:3000`
- NestJS API: `http://127.0.0.1:3001/api/v1`
- Swagger: `http://127.0.0.1:3001/docs`

## Quyết định kỹ thuật

Giai đoạn này dùng pool `mysql2` tối giản cho health check. Entity và TypeORM chưa được đưa vào để tránh trộn phạm vi; chúng thuộc giai đoạn 3, khi schema và migration được chuẩn hóa.

Integration test khởi động trực tiếp `dist/main.js` trên một cổng trống, gọi HTTP thật rồi tắt tiến trình. Vì vậy bài test kiểm tra đúng artifact production cùng kết nối MySQL local.

`npm audit --omit=dev` không ghi nhận lỗ hổng production tại thời điểm hoàn thành. Hai cảnh báo mức vừa còn lại thuộc dependency gián tiếp của Nest CLI dùng khi phát triển; không dùng `npm audit fix --force` vì thao tác đó hạ major CLI.

## Điều kiện hoàn thành

- NestJS kết nối MySQL: đạt.
- Health endpoint hoạt động: đạt.
- Swagger có endpoint và DTO health: đạt.
- Hệ thống Express cũ vẫn tồn tại và có thể chạy song song: đạt.
