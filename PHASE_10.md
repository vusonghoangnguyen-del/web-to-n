# Giai đoạn 10: triển khai và vận hành

## Đã chuẩn bị trong mã nguồn

- `compose.production.yml` chạy Next.js, NestJS, worker, trình biên dịch TeX, MySQL, Redis và Caddy. Caddy cấp HTTPS khi DNS trỏ đúng về VPS. Chỉ Caddy mở cổng 80/443; MySQL, Redis và API ở mạng nội bộ.
- Trình biên dịch TeX chạy trong container riêng, không có mạng và không cần quyền điều khiển Docker. Worker chuyển job qua volume tạm; PDF được lưu trên volume riêng. Cấu hình local ở giai đoạn 9 vẫn dùng được.
- Health check cho MySQL, Redis, API, worker và trình biên dịch. Log các container tập hợp qua `docker compose logs`, giới hạn dung lượng từng file log. API ghi JSON về lỗi và thời gian xử lý từng request (không ghi query chứa token hoặc nội dung mật khẩu); đã có giới hạn request toàn cục/theo endpoint đăng nhập và theo tài khoản cho tạo bài, bình luận, lời giải, biên dịch LaTeX. Caddy chuyển `/api/v1/*` thẳng đến API để giữ đúng IP khách truy cập cho giới hạn này.
- CI GitHub Actions chạy `npm ci`, `check`, `test`, `build`. Migration có lệnh riêng trong profile `ops`, không chạy ngầm khi API khởi động.
- Đăng ký vẫn xác minh email; đã thêm yêu cầu và xác nhận đặt lại mật khẩu. Link đặt lại dùng một lần, hết hạn sau 30 phút; đổi mật khẩu thu hồi các phiên cũ.
- `ops/backup.sh` sao lưu MySQL và PDF; `ops/restore-check.sh` kiểm tra khôi phục trong MySQL tạm. `npm run latex:prune` xem trước, `-- --apply` xóa bản biên dịch quá hạn theo `LATEX_RETENTION_DAYS`.

## Triển khai trên VPS Linux

Cần VPS có Docker Engine + Compose plugin, tên miền trỏ A/AAAA về VPS, mở cổng TCP 80/443 và SMTP gửi thư. GitHub lưu mã nguồn và chạy CI; website, MySQL, Redis và TeX vẫn cần máy chủ để chạy. Không đưa `.env.production` hoặc bản backup lên Git.

```bash
git clone https://github.com/vusonghoangnguyen-del/web-to-n.git
cd web-to-n
cp .env.production.example .env.production
chmod 600 .env.production
```

Điền tên miền, mật khẩu MySQL riêng cho ứng dụng và root, `JWT_SECRET` ngẫu nhiên tối thiểu 32 ký tự, thông tin SMTP thật. `MAIL_MODE=preview` chỉ ghi file trong container, không gửi thư. Không dùng địa chỉ `127.0.0.1` của máy cá nhân làm `DB_HOST` trên VPS. Giữ `DB_HOST=mysql`, `REDIS_URL=redis://redis:6379`, `APP_WEB_URL` và `CORS_ORIGINS` là `https://<tên miền>`.

```bash
docker compose --env-file .env.production -f compose.production.yml build
docker compose --env-file .env.production -f compose.production.yml up -d mysql redis
docker compose --env-file .env.production -f compose.production.yml --profile ops run --rm migrate
docker compose --env-file .env.production -f compose.production.yml up -d api worker compiler web caddy
docker compose --env-file .env.production -f compose.production.yml ps
curl -fsS https://<tên miền>/api/v1/health
```

TeX Live image lớn; lần tải đầu có thể lâu. Chỉ chạy migration sau khi đã sao lưu khi cập nhật một database có dữ liệu. Trước mỗi lần cập nhật: `bash ops/backup.sh`, `git pull`, build image, chạy migration, rồi `up -d`. Migration có thay đổi schema không phải lúc nào cũng đảo ngược được; cần kiểm tra bản backup trước khi chạy.

Staging trên VPS riêng: tạo `.env.staging` với `DEPLOY_ENV_FILE=.env.staging`, `DEPLOY_PROJECT_NAME=to-toan-staging` và domain staging, rồi thay `--env-file .env.production` bằng `--env-file .env.staging`. Local development vẫn chạy bằng `npm run dev`, `compose.latex.yml` và MySQL local.

## Sao lưu, kiểm tra khôi phục và log

```bash
bash ops/backup.sh
bash ops/restore-check.sh backups/production/to-toan-YYYYMMDDTHHMMSSZ
docker compose --env-file .env.production -f compose.production.yml logs --since 1h api web worker compiler
docker compose --env-file .env.production -f compose.production.yml ps
```

`backup.sh` tạo `database.sql.gz` và `latex-builds.tar.gz` trong `backups/production/`, chỉ công bố thư mục sau khi cả hai bản sao hợp lệ. Lập lịch cron trên VPS, ví dụ `0 2 * * * cd /srv/web-to-n && /bin/bash ops/backup.sh >> /var/log/to-toan-backup.log 2>&1`. Chuyển bản backup sang nơi lưu trữ khác VPS, giới hạn quyền đọc và thử khôi phục định kỳ. Script kiểm tra khôi phục chỉ tạo MySQL tạm không có mạng, không ghi vào database đang phục vụ web.

Để xem trước các PDF/build sẽ bị dọn sau 90 ngày:

```bash
docker compose --env-file .env.production -f compose.production.yml run --rm worker node apps/api/scripts/prune-latex-builds.mjs
docker compose --env-file .env.production -f compose.production.yml run --rm worker node apps/api/scripts/prune-latex-builds.mjs --apply
```

## Giới hạn hiện tại

Chưa có VPS/domain hoặc quyền DNS trong dự án này nên chưa thể xác nhận HTTPS và chạy lịch backup thật. Log hiện tập trung trên một Docker host; chưa có hệ thống lưu log từ nhiều máy, cảnh báo lỗi/hiệu năng bên ngoài hoặc backup offsite tự động. Bộ đếm giới hạn theo tài khoản hiện nằm trong bộ nhớ của một API instance; khi chạy nhiều instance cần chuyển sang kho dùng chung. Những mục này cần cấu hình cùng hạ tầng và lưu lượng thực tế trước khi coi giai đoạn vận hành hoàn tất.

Giới hạn toàn cục vẫn là 100 request/phút/IP. Các lần Next.js lấy dữ liệu phía máy chủ có thể dùng chung IP của web container, vì vậy cần đo tải và chọn cách giới hạn phù hợp trước khi mở rộng lượng truy cập; không tự tăng ngưỡng này khi chưa đánh giá khả năng chống lạm dụng.
