# Hướng dẫn chạy Tờ Toán trên một máy Windows khác

Tài liệu này dành cho người cài lần đầu trên **chính máy sẽ mở website**. Sau khi chạy, mở `http://127.0.0.1:5174` trong trình duyệt của máy đó. Địa chỉ `127.0.0.1` luôn chỉ máy đang sử dụng; nó không mở website cho máy khác trong mạng.

## 1. Chuẩn bị phần mềm

**Cài nhanh:** nhấp chuột phải [CAI_PHAN_MEM_LOCAL.bat](CAI_PHAN_MEM_LOCAL.bat), chọn **Run as administrator**. File này dùng WinGet để cài lần lượt Node.js, MySQL Server, MySQL Workbench, Docker Desktop và chạy `npm.cmd ci`. Sau khi cài, vẫn cần cấu hình MySQL và chọn cách chuẩn bị dữ liệu ở mục 3; không có mật khẩu `root` hoặc bản sao dữ liệu cũ thì BAT không thể tự quyết định phần đó. Có thể chạy lại BAT nếu quá trình cài bị ngắt.

Nếu muốn tự cài từng phần hoặc BAT báo thiếu WinGet, làm theo các bước bên dưới.

Cài các phần mềm sau trên máy mới:

1. **Node.js** phiên bản đáp ứng yêu cầu dự án: 20.19 trở lên hoặc 22.12 trở lên. Bản Node.js 22 phù hợp để cài mới. Trình cài đặt Node.js kèm `npm`.
2. **MySQL Server 8**. Trong lúc cài, đặt và ghi nhớ mật khẩu tài khoản MySQL `root`; giữ cổng mặc định `3306`.
3. **Docker Desktop** để dùng chức năng biên dịch LaTeX thành PDF. Khởi động Docker Desktop và đợi trạng thái engine hoạt động. Nếu Docker yêu cầu WSL 2 hoặc khởi động lại Windows, hoàn thành bước đó trước.
4. **MySQL Workbench** nếu cần chuyển dữ liệu từ máy cũ; công cụ này có mục Data Export và Data Import.
5. Một trình duyệt như Edge hoặc Chrome.

Mở **PowerShell** mới và kiểm tra:

```powershell
node --version
npm.cmd --version
docker --version
docker info
```

Nếu `node` hoặc `docker` không được nhận diện, đóng và mở lại PowerShell sau khi cài. `docker info` phải chạy được trước khi dùng tính năng PDF. MySQL Server phải đang chạy; có thể xem trong ứng dụng **Services** của Windows, tìm dịch vụ có tên bắt đầu bằng `MySQL`.

## 2. Chép mã nguồn sang máy mới

Chép **toàn bộ thư mục dự án** sang một thư mục dễ tìm, ví dụ `D:\ToToan`. Có thể tải ZIP mã nguồn từ kho Git rồi giải nén, hoặc chép thư mục dự án hiện tại. Thư mục đúng là nơi có `package.json`, `package-lock.json`, `apps`, `compose.latex.yml` và `KHOI_DONG_WEB.bat`.

Không cần chép `node_modules`, `.next` hay `dist`; chúng sẽ được tạo lại. **Không gửi file `.env` qua kênh công khai** vì file đó chứa mật khẩu database và khóa phiên đăng nhập.

Mở PowerShell tại thư mục dự án (trong File Explorer, bấm vào thanh địa chỉ, gõ `powershell` rồi Enter). Mọi lệnh bên dưới đều chạy tại **thư mục gốc của dự án**.

```powershell
npm.cmd ci
```

Lệnh này cài đúng phiên bản thư viện theo `package-lock.json`. Cần kết nối Internet ở lần cài đầu.

## 3. Chọn cách chuẩn bị dữ liệu

### Cách A — Máy mới, bắt đầu với database trống

Chỉ dùng cách này nếu **không cần chuyển tài khoản và bài viết từ máy cũ**. Kiểm tra trong thư mục dự án chưa có `.env`. Chạy:

```powershell
npm.cmd run db:setup
npm.cmd run migration:run
```

Mỗi lệnh hỏi mật khẩu MySQL `root` ngay trong terminal; lúc gõ sẽ **không hiện ký tự**, gõ xong bấm Enter. `db:setup` tạo database `to_toan`, tài khoản ứng dụng `to_toan_app`, bảng cơ bản và file `.env` với mật khẩu ngẫu nhiên. `migration:run` bổ sung các bảng và cột mới, gồm phần dự án LaTeX. **Không chạy lại `db:setup` khi `.env` đã tồn tại hoặc khi đang chuyển database cũ.**

### Cách B — Mang theo tài khoản, bài viết và dự án từ máy cũ

Trên máy cũ, sao lưu database `to_toan` thành file `.sql` bằng chức năng **Data Export** của MySQL Workbench (chọn cả schema và data). Sao lưu riêng thư mục `storage` của dự án; trong đó có PDF đã biên dịch và bản xem trước email. Giữ các bản sao lưu ở nơi riêng tư.

Trên máy mới, nhập file `.sql` bằng **Data Import** của MySQL Workbench vào database `to_toan` (tạo schema `to_toan` trong Workbench trước nếu bản xuất không tự tạo). Chép thư mục `storage` vào thư mục gốc dự án. Chép **an toàn** file `.env` từ máy cũ sang cùng vị trí trên máy mới. Kiểm tra `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_NAME=to_toan`, `NEST_API_URL=http://127.0.0.1:3001` và `APP_WEB_URL=http://127.0.0.1:5174` (nếu có). Giữ `JWT_SECRET` cũ nếu muốn các phiên đăng nhập hiện có tiếp tục hợp lệ.

Trong MySQL Workbench, kết nối bằng `root`, mở một SQL tab và chạy đoạn dưới. Thay `MAT_KHAU_TRONG_ENV` bằng chính giá trị `DB_PASSWORD` trong `.env` đã chép (nếu mật khẩu có dấu nháy đơn, nên đặt mật khẩu mới chỉ gồm chữ và số rồi cập nhật cả `.env`). Đây là tài khoản mà API dùng để đọc/ghi dữ liệu:

```sql
CREATE USER IF NOT EXISTS 'to_toan_app'@'127.0.0.1' IDENTIFIED BY 'MAT_KHAU_TRONG_ENV';
ALTER USER 'to_toan_app'@'127.0.0.1' IDENTIFIED BY 'MAT_KHAU_TRONG_ENV';
GRANT SELECT, INSERT, UPDATE, DELETE ON `to_toan`.* TO 'to_toan_app'@'127.0.0.1';
```

Sau khi nhập dữ liệu, chạy:

```powershell
npm.cmd run migration:run
```

Lệnh migration chỉ áp dụng phần schema còn thiếu. **Không chạy `db:setup` trên bản database đã nhập**: lệnh này thay mật khẩu user ứng dụng và không phải công cụ khôi phục dữ liệu.

> Nếu chỉ có mã nguồn mà không có bản sao MySQL của máy cũ, không thể lấy lại tài khoản/bài viết cũ từ mã nguồn. Nếu thiếu thư mục `storage`, database vẫn có thông tin các bản biên dịch nhưng file PDF cũ có thể không mở được.

## 4. Chuẩn bị LaTeX và Redis

Giữ Docker Desktop đang chạy. Tại thư mục dự án, chạy một lần:

```powershell
docker pull texlive/texlive:latest
docker compose -f compose.latex.yml up -d
```

Image TeX Live khá lớn nên lần tải đầu có thể lâu. Lệnh Compose bật Redis ở `127.0.0.1:6379` để nhận tác vụ biên dịch. Kiểm tra Redis bằng:

```powershell
docker compose -f compose.latex.yml ps
```

## 5. Chạy website

### Cách đơn giản: bấm đúp

Bấm đúp **`KHOI_DONG_WEB.bat`** trong thư mục dự án. File này kiểm tra thư viện, cố gắng bật Docker/Redis, rồi mở ba cửa sổ: API NestJS, website Next.js và worker LaTeX. Khi sẵn sàng, trình duyệt mở `http://127.0.0.1:5174`. Giữ các cửa sổ đó mở trong lúc dùng. Nếu cửa sổ hiện lỗi, dùng cách thủ công bên dưới để đọc lỗi rõ hơn.

### Cách thủ công: ba cửa sổ PowerShell

Mở **ba** cửa sổ PowerShell tại thư mục gốc dự án. Chạy mỗi lệnh trong một cửa sổ và giữ cả ba cửa sổ mở:

```powershell
npm.cmd run dev:nest
```

```powershell
npm.cmd run dev:next
```

```powershell
npm.cmd run dev:worker
```

Trước đó phải bật Redis bằng lệnh Compose ở bước 4. API dùng cổng `3001`, website dùng cổng `5174`. Worker cần Docker và Redis để tạo PDF. Để tắt, bấm `Ctrl+C` trong từng cửa sổ; Redis có thể dừng bằng `docker compose -f compose.latex.yml down` nếu không dùng nữa.

## 6. Kiểm tra sau khi chạy

1. Mở `http://127.0.0.1:3001/api/v1/health`. API phải báo hoạt động và kết nối được MySQL.
2. Mở `http://127.0.0.1:5174`. Dùng **đúng địa chỉ này** khi đăng nhập và mở liên kết xác minh email; đừng đổi qua lại giữa `localhost` và `127.0.0.1`.
3. Đăng ký/đăng nhập. Với `MAIL_MODE=preview` (mặc định trên local), email xác minh không gửi ra Internet mà được lưu thành file HTML trong `storage/mail-preview`. Mở file mới nhất và bấm liên kết xác minh.
4. Vào **Soạn bài**, tạo dự án, bấm **Biên dịch PDF**. Nếu bản xem trước PDF xuất hiện thì API, Redis, worker và Docker đã chạy đủ.

Muốn trang chủ có sẵn bốn bài viết mẫu sau khi tạo database mới, chạy **một lần sau migration**:

```powershell
npm.cmd run db:seed
```

Lệnh này chỉ thêm bài mẫu còn thiếu; chạy lại không nhân đôi và không thay đổi bài của người dùng. Bộ mẫu là nội dung tự viết, không gồm tài khoản hay tài liệu cá nhân từ máy khác.

Muốn cấp quyền quản trị cho tài khoản đã đăng ký, chạy lệnh sau tại thư mục dự án, thay địa chỉ email cho đúng:

```powershell
npm.cmd run admin:grant -- email-cua-bo@example.com
```

Nếu trang đăng ký chưa tạo được tài khoản, có thể tạo admin trực tiếp trong PowerShell bằng `npm.cmd run admin:create`. Lệnh hỏi email, tên đăng nhập và mật khẩu; mật khẩu không hiện khi gõ. Chỉ chạy trên máy quản trị mà bạn kiểm soát, sau khi đã hoàn tất `db:setup` và `migration:run`.

## 7. Lỗi thường gặp

| Hiện tượng | Cách kiểm tra và xử lý |
| --- | --- |
| `node`/`npm` không được nhận diện | Cài Node.js, mở PowerShell mới, chạy lại `node --version`. |
| `db:setup` báo `.env` đã tồn tại | Dừng lại và kiểm tra file `.env`; nếu đang chuyển dữ liệu cũ thì dùng **Cách B**, không xóa file tùy tiện. |
| API báo không kết nối MySQL / health lỗi | Kiểm tra dịch vụ MySQL đang chạy, mật khẩu `DB_PASSWORD` trong `.env`, cổng `3306`, và đã chạy migration. |
| Cổng `3001`, `5174` hoặc `6379` đã được dùng | Đóng tiến trình cũ đang chạy trên cổng đó; tránh mở nhiều bản website/Redis cùng lúc. |
| Nút biên dịch báo chưa có worker/Redis | Mở Docker Desktop, chạy lại Compose, và giữ cửa sổ `npm.cmd run dev:worker` hoạt động. |
| Báo thiếu image TeX Live | Chạy `docker pull texlive/texlive:latest` và đợi hoàn tất. |
| LaTeX biên dịch thất bại | Mở **nhật ký biên dịch** trong bàn soạn; sửa lỗi trong `main.tex` hoặc kiểm tra tệp ảnh/tham khảo. |
| Không nhận email xác minh | Với chế độ local, mở `storage/mail-preview`; không chờ email trong hộp thư. |
| Website mở được nhưng dữ liệu trống | Kiểm tra đang kết nối đúng database `to_toan` và đã nhập bản sao dữ liệu nếu muốn giữ nội dung máy cũ. |

## 8. Sao lưu và cập nhật

Nên sao lưu **database MySQL `to_toan`**, thư mục **`storage`** và file **`.env`** (giữ riêng tư) trước khi chuyển máy hoặc cập nhật mã. Chỉ chép mã nguồn thì không mang theo dữ liệu và PDF.

Khi nhận phiên bản mã mới: dừng API/web/worker, sao lưu như trên, cập nhật mã nguồn, rồi tại thư mục gốc chạy:

```powershell
npm.cmd ci
npm.cmd run migration:run
```

Sau đó bật lại Docker/Redis và khởi động website. Migration cần mật khẩu MySQL `root`; không chạy `db:setup` khi cập nhật.
