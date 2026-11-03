# Giai đoạn 5 — Chuyển các module nghiệp vụ sang NestJS

Giai đoạn 5 chuyển lần lượt các nghiệp vụ khỏi Express sang API NestJS `/api/v1`. Route Express cũ được giữ trong thời gian chuyển đổi để các phần chưa chuyển tiếp tục hoạt động.

## Tiến độ

- [x] 5.1 Problems
- [x] 5.2 Comments
- [x] 5.3 Solutions
- [x] 5.4 Bookmarks, reactions và follows
- [x] 5.5 Moderation và audit log

## 5.1 Problems

### API NestJS

- `GET /api/v1/problems`: danh sách bài đã xuất bản.
- `GET /api/v1/problems/:identifier`: chi tiết theo ID hoặc slug.
- `GET /api/v1/problems/mine`: danh sách bài của tài khoản hiện tại.
- `POST /api/v1/problems`: tạo bản nháp hoặc gửi bài chờ duyệt.
- `PATCH /api/v1/problems/:identifier`: sửa bài và lưu phiên bản lịch sử.
- `DELETE /api/v1/problems/:identifier`: xóa mềm.
- `GET /api/v1/problems/:identifier/history`: xem lịch sử phiên bản.

Danh sách công khai hỗ trợ:

- Tìm kiếm trong tiêu đề và nội dung.
- Lọc theo chuyên mục và độ khó.
- Phân trang với `page` và `limit`.
- Đếm số bình luận đang hiển thị.

### Quy tắc quyền hạn

- Người dùng đã đăng nhập có thể tạo bản nháp hoặc gửi bài chờ duyệt.
- Tác giả được sửa bài của mình khi bài chưa xuất bản.
- Bài đã xuất bản chỉ moderator hoặc admin được sửa trực tiếp.
- Tác giả, moderator hoặc admin có thể xóa mềm bài phù hợp với quyền hạn.
- Chỉ tác giả, moderator hoặc admin được xem lịch sử phiên bản của bài chưa công khai.
- API công khai không trả bài nháp, bài chờ duyệt, bài bị từ chối hoặc bài đã xóa mềm.

### Database

Migration `ProblemsModule1762260000000`:

- Thêm `problems.slug` với ràng buộc duy nhất.
- Thêm `problems.deleted_at` để xóa mềm mà không mất dữ liệu.
- Thêm index phục vụ danh sách bài công khai.
- Tạo bảng `problem_revisions` lưu nội dung, chuyên mục, trạng thái, người sửa và mô tả thay đổi của từng phiên bản.
- Tạo phiên bản đầu tiên cho toàn bộ bài toán đã có trước migration.

Trước khi chạy migration đã tạo backup MySQL tại `backups/to_toan-20261103-021123.sql`. Backup local không được commit lên Git.

### Frontend hiện tại

Frontend Vite đã chuyển các luồng sau sang NestJS:

- Danh sách, tìm kiếm, lọc và phân trang bài toán.
- Xem chi tiết bài toán.
- Gửi bài toán mới.
- Xem danh sách bài của tài khoản hiện tại.

Bình luận, lời giải, bookmark và trang moderation vẫn gọi Express cho tới khi hoàn thành các mục 5.2–5.5.

### Tương thích và kiểm thử

- Route Problems cũ của Express vẫn còn nguyên để tránh làm gián đoạn các module chưa chuyển.
- Route tạo bài cũ tự sinh slug và phiên bản lịch sử đầu tiên để tương thích với schema mới.
- Entity TypeORM và schema MySQL đã được đối chiếu, không còn sai khác.
- Unit test kiểm tra slug tiếng Việt và trường hợp slug dự phòng.
- E2E kiểm tra tạo draft, danh sách của tôi, sửa bài, lịch sử, slug, tìm kiếm, lọc, chi tiết công khai và xóa mềm.
- Smoke test Express cũ vẫn qua luồng đăng bài, duyệt, tìm kiếm, bookmark, bình luận và lời giải.
- Dữ liệu E2E được xóa sau khi kiểm tra.

## 5.2 Comments

### API NestJS

- `GET /api/v1/problems/:problemId/comments`: danh sách bình luận có phân trang.
- `POST /api/v1/problems/:problemId/comments`: bình luận hoặc trả lời.
- `PATCH /api/v1/comments/:commentId`: sửa bình luận của chính mình.
- `DELETE /api/v1/comments/:commentId`: xóa mềm bình luận.
- `POST /api/v1/comments/:commentId/reports`: báo cáo nội dung không phù hợp.

Danh sách sử dụng `page` và `limit`, giới hạn tối đa 100 bình luận mỗi trang. Bình luận đã xóa vẫn giữ vị trí trong luồng trả lời nhưng nội dung công khai được thay bằng thông báo `[Bình luận đã được xóa]`.

### Quy tắc quyền hạn

- Chỉ tài khoản đã đăng nhập mới được bình luận, trả lời, sửa, xóa hoặc báo cáo.
- Người dùng chỉ được sửa bình luận của chính mình.
- Tác giả, moderator hoặc admin có thể xóa mềm theo phạm vi quyền hạn.
- Không thể trả lời hoặc báo cáo một bình luận đã xóa hay bị ẩn.
- Mỗi tài khoản chỉ được báo cáo một bình luận một lần.
- Nội dung thật của bình luận xóa mềm vẫn được giữ trong MySQL để phục vụ kiểm duyệt và audit về sau, nhưng không được trả về API công khai.

### Database

Migration `CommentsModule1762346400000`:

- Thêm `comments.edited_at`.
- Thêm `comments.deleted_at` và `comments.deleted_by`.
- Thêm index cho phân trang bình luận đang hiển thị.
- Tạo bảng `comment_reports` với lý do, chi tiết, trạng thái xử lý và người báo cáo.
- Giữ khóa ngoại để báo cáo được xóa theo bình luận hoặc tài khoản báo cáo.

Trước migration đã tạo backup MySQL tại `backups/to_toan-20261103-102511.sql`. Backup local không được commit lên Git.

### Frontend và tương thích

Trang chi tiết bài toán đã chuyển đọc, gửi, trả lời, sửa, xóa và báo cáo bình luận sang NestJS. Nút “Xem thêm bình luận” tải trang tiếp theo mà không tải lại trang bài toán.

Route bình luận Express cũ vẫn hoạt động trong giai đoạn chuyển tiếp và đã được điều chỉnh để hiểu xóa mềm. Trang admin cũ không hiển thị các bình luận người dùng đã xóa mềm.

### Kiểm thử

- E2E dùng hai tài khoản kiểm tra bình luận, trả lời và sửa bình luận.
- Kiểm tra người khác không thể sửa bình luận không thuộc sở hữu.
- Kiểm tra báo cáo thành công và chặn báo cáo trùng.
- Kiểm tra phân trang và `hasMore`.
- Kiểm tra xóa mềm trả placeholder nhưng không làm mất câu trả lời.
- Schema E2E xác nhận migration và 13 Entity.
- Toàn bộ E2E Auth, Problems và Comments đều đạt.
- Smoke test Express cũ vẫn đạt sau khi chuyển Comments.

## 5.3 Solutions

### API NestJS

- `GET /api/v1/problems/:problemId/solutions`: danh sách lời giải đã kiểm chứng, ưu tiên lời giải nổi bật.
- `GET /api/v1/problems/:problemId/solutions/mine`: lời giải của tài khoản hiện tại trong một bài toán.
- `POST /api/v1/problems/:problemId/solutions`: gửi lời giải chờ duyệt.
- `GET /api/v1/solutions/mine`: toàn bộ lời giải của tài khoản hiện tại, có phân trang.
- `PATCH /api/v1/solutions/:solutionId`: sửa và tự động gửi duyệt lại.
- `DELETE /api/v1/solutions/:solutionId`: rút lời giải nhưng vẫn giữ dữ liệu lịch sử.
- `GET /api/v1/solutions/:solutionId/history`: xem lịch sử phiên bản.
- `GET /api/v1/solutions/moderation`: danh sách kiểm duyệt dành cho moderator và admin.
- `PATCH /api/v1/solutions/:solutionId/review`: kiểm chứng, từ chối hoặc đưa lại về chờ duyệt.
- `PATCH /api/v1/solutions/:solutionId/featured`: đánh dấu hoặc bỏ đánh dấu lời giải nổi bật.

### Quy tắc quyền hạn

- Chỉ tài khoản đã đăng nhập mới được gửi, sửa hoặc rút lời giải.
- Tác giả chỉ sửa được lời giải của chính mình; sau mỗi lần sửa, trạng thái trở về `pending` và thông tin kiểm duyệt cũ được xóa.
- Mỗi tác giả chỉ có một lời giải đang chờ duyệt cho cùng một bài toán.
- Chỉ moderator hoặc admin được kiểm duyệt và chọn lời giải nổi bật.
- Lời giải bị từ chối bắt buộc có lý do để tác giả biết nội dung cần sửa.
- Chỉ lời giải `verified` mới được hiển thị công khai hoặc đánh dấu nổi bật.
- Lời giải đã rút chuyển sang `withdrawn`, không xuất hiện trong danh sách công khai, cá nhân hay kiểm duyệt nhưng dữ liệu vẫn còn để audit.

### Database

Migration `SolutionsModule1762432800000`:

- Bổ sung trạng thái `withdrawn` và các mốc sửa, rút, kiểm duyệt cho bảng `solutions`.
- Lưu người kiểm duyệt, ghi chú kiểm duyệt và thông tin lời giải nổi bật.
- Thêm index cho danh sách công khai, người kiểm duyệt và người đánh dấu nổi bật.
- Tạo bảng `solution_revisions` lưu nội dung, trạng thái, phiên bản, người sửa và mô tả thay đổi.
- Tạo phiên bản đầu tiên cho các lời giải đã tồn tại trước migration.

Trước migration đã tạo backup MySQL tại `backups/to_toan-20261103-103536.sql`. Backup local không được commit lên Git.

### Frontend và tương thích

Trang chi tiết bài toán đã chuyển luồng đọc, gửi, sửa, xem lịch sử và rút lời giải sang NestJS. Trang cá nhân dùng API NestJS để hiển thị toàn bộ lời giải của người dùng. Trang admin dùng API moderation mới để kiểm chứng, từ chối, đưa lại về chờ duyệt và chọn lời giải nổi bật.

Route Solutions Express cũ vẫn được giữ trong thời gian chuyển tiếp. Các thao tác tạo, rút và kiểm duyệt qua Express cũng ghi phiên bản lịch sử và hiểu trạng thái `withdrawn`, bảo đảm phần cũ không làm sai schema mới.

### Kiểm thử

- E2E kiểm tra gửi lời giải và chặn một lời giải chờ duyệt bị gửi trùng.
- Kiểm tra người khác không thể sửa lời giải không thuộc sở hữu.
- Kiểm tra sửa nội dung, lịch sử phiên bản và gửi duyệt lại.
- Kiểm tra từ chối bắt buộc có lý do, sau đó tác giả sửa và gửi lại.
- Kiểm tra moderator xác minh, đánh dấu nổi bật và API công khai trả đúng dữ liệu.
- Kiểm tra rút lời giải làm nội dung biến mất khỏi API công khai nhưng lịch sử vẫn được giữ.
- Schema E2E xác nhận migration và Entity `solution_revisions`.

## 5.4 Bookmarks, reactions và follows

### API NestJS

- `GET /api/v1/bookmarks`: danh sách bài toán đã lưu của tài khoản hiện tại.
- `PUT /api/v1/bookmarks/:problemId`: lưu bài toán.
- `DELETE /api/v1/bookmarks/:problemId`: bỏ lưu bài toán.
- `GET /api/v1/follows`: danh sách bài toán đang theo dõi.
- `PUT /api/v1/follows/problems/:problemId`: theo dõi bài toán.
- `DELETE /api/v1/follows/problems/:problemId`: bỏ theo dõi bài toán.
- `GET /api/v1/problems/:problemId/engagement`: bộ đếm lượt thích bài, người theo dõi và lượt thích từng lời giải.
- `GET /api/v1/problems/:problemId/engagement/mine`: trạng thái lưu, theo dõi và thích của tài khoản hiện tại.
- `PUT/DELETE /api/v1/problems/:problemId/reaction`: thích hoặc bỏ thích bài toán.
- `PUT/DELETE /api/v1/solutions/:solutionId/reaction`: thích hoặc bỏ thích lời giải.
- `GET /api/v1/notifications`: danh sách thông báo phát sinh từ các bài đang theo dõi.
- `PATCH /api/v1/notifications/read`: đánh dấu toàn bộ thông báo đã đọc.

### Quy tắc nghiệp vụ

- Chỉ bài toán đang xuất bản mới có thể được lưu, thích hoặc theo dõi.
- Chỉ lời giải đã kiểm chứng thuộc bài toán đang xuất bản mới có thể được thích.
- Mỗi tài khoản chỉ có tối đa một bookmark, một lượt thích và một lượt theo dõi trên cùng đối tượng.
- Các lệnh `PUT` và `DELETE` có tính idempotent: gửi lặp lại không tạo dữ liệu trùng và không gây lỗi.
- Bộ đếm được tính từ dữ liệu quan hệ thực tế để không lệch khi người dùng bỏ thích hoặc bỏ theo dõi.
- Trạng thái cá nhân yêu cầu đăng nhập; bộ đếm tổng được đọc công khai.

### Database

Migration `EngagementModule1762519200000` tạo:

- `problem_reactions`: lượt thích bài toán.
- `solution_reactions`: lượt thích lời giải.
- `problem_follows`: danh sách theo dõi bài toán.
Migration `FollowNotifications1762522800000` tạo bảng `notifications` cho bình luận mới và lời giải mới được kiểm chứng trong bài đang theo dõi.

Mỗi bảng dùng khóa chính kép gồm tài khoản và đối tượng, có index theo đối tượng và khóa ngoại `ON DELETE CASCADE`. Bảng `bookmarks` hiện có tiếp tục được tái sử dụng.

Trước các migration đã tạo backup MySQL tại `backups/to_toan-20261103-110203.sql` và `backups/to_toan-20261103-110616.sql`. Backup local không được commit lên Git.

### Frontend

- Nút lưu bài ở trang chủ và trang chi tiết đã chuyển sang API NestJS.
- Trang chi tiết hiển thị nút thích bài, theo dõi bài và bộ đếm tương ứng.
- Mỗi lời giải đã kiểm chứng có nút thích và bộ đếm riêng.
- Trạng thái nút của tài khoản đang đăng nhập được khôi phục sau khi tải trang.
- Hồ sơ người dùng hiển thị cả danh sách bài đã lưu và bài đang theo dõi.
- Menu tài khoản nhận thông báo khi bài đang theo dõi có bình luận mới hoặc lời giải mới được kiểm chứng; mở bảng thông báo sẽ đánh dấu đã đọc.
- Khách chưa đăng nhập được chuyển tới đăng nhập rồi quay lại đúng trang bài toán.

### Kiểm thử

- E2E kiểm tra thêm và bỏ bookmark.
- Kiểm tra thích bài toán bằng hai tài khoản và bộ đếm tổng.
- Kiểm tra thích lời giải đã kiểm chứng.
- Kiểm tra theo dõi, bỏ theo dõi và danh sách theo dõi.
- Gửi lặp thao tác để xác nhận không tạo bản ghi trùng.
- Schema E2E xác nhận hai migration 5.4 và tổng cộng 18 Entity.
- Toàn bộ E2E Auth, Problems, Comments, Solutions và Engagement đều đạt.
- Build frontend/API và smoke test Express cũ đều đạt sau migration.

## 5.5 Moderation và audit log

### API NestJS

- `GET /api/v1/moderation/stats`: số liệu tổng quan cho bàn biên tập.
- `GET /api/v1/moderation/problems`: danh sách bài toán theo trạng thái.
- `PATCH /api/v1/moderation/problems/:id`: xuất bản, từ chối hoặc đưa bài về chờ duyệt.
- `GET /api/v1/moderation/comments`: danh sách bình luận hiện/ẩn.
- `PATCH /api/v1/moderation/comments/:id/visibility`: ẩn hoặc hiện lại bình luận mà không xóa nội dung gốc.
- `GET /api/v1/moderation/reports`: danh sách báo cáo bình luận.
- `PATCH /api/v1/moderation/reports/:id`: xử lý hoặc bỏ qua báo cáo, có thể đồng thời ẩn bình luận.
- `GET /api/v1/moderation/audit-logs`: lịch sử hành động kiểm duyệt.

Tất cả endpoint trên yêu cầu phiên đăng nhập có vai trò `moderator` hoặc `admin`. Duyệt và đánh dấu nổi bật lời giải tiếp tục dùng API Solutions của mục 5.3, đồng thời đã được bổ sung audit log.

### Database

Migration `ModerationAudit1762605600000`:

- Tạo bảng `audit_logs`, liên kết người thực hiện và lưu hành động, loại đối tượng, ID đối tượng cùng chi tiết dạng JSON.
- Bổ sung người xử lý, ghi chú xử lý và khóa ngoại reviewer cho `comment_reports`.
- Nội dung bình luận bị ẩn vẫn được giữ nguyên để moderator có thể xem xét và khôi phục.

Backup trước migration: `backups/to_toan-20261103-162635.sql`. Backup local không được commit lên Git.

### Trang quản trị

- Duyệt bài toán, thống kê và quản lý bình luận đã chuyển từ Express sang `/api/v1/moderation`.
- Bình luận có thể ẩn và hiện lại trực tiếp.
- Có khu vực xử lý báo cáo riêng: ẩn bình luận và xác nhận xử lý, hoặc bỏ qua báo cáo.
- Có khu vực nhật ký quản trị hiển thị người thao tác, hành động, đối tượng và thời điểm.
- Quản lý video và tài khoản vẫn dùng Express trong giai đoạn chuyển tiếp; các endpoint cũ chưa bị xóa.

### Kiểm thử và trạng thái hoàn thành

- TypeScript check và NestJS build thành công.
- Schema E2E xác nhận 19 Entity và migration 5.5.
- `schema:log` xác nhận Entity và MySQL không còn sai khác.
- Moderation E2E xác nhận reader bị từ chối, moderator duyệt bài, xử lý báo cáo, ẩn bình luận nhưng giữ nội dung gốc và tạo audit log.

## Việc tiếp theo

Giai đoạn 5 đã hoàn thành. Bước kế tiếp trong lộ trình là giai đoạn 6.
