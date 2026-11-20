import type { Metadata } from 'next';
import Link from 'next/link';
import { ResendVerificationForm } from '@/components/resend-verification-form';

export const metadata: Metadata = { title: 'Kiểm tra email', description: 'Kiểm tra hộp thư và xác minh tài khoản Tờ Toán.' };

export default function CheckEmailPage() {
  return <div className="verification-page page-shell"><section className="verification-card"><h1>Xác minh tài khoản</h1><p>Hãy mở liên kết xác minh để hoàn tất đăng ký. Nếu hệ thống đã cấu hình SMTP, liên kết nằm trong email của bạn.</p><div className="verification-note"><strong>Đang chạy trên máy local?</strong><p>Chế độ mặc định không gửi email ra Internet. Mở file HTML mới nhất trong thư mục <code>storage/mail-preview</code> của dự án và bấm liên kết xác minh. Nếu đã cấu hình SMTP mà vẫn chưa thấy thư, hãy kiểm tra thư rác hoặc gửi lại bên dưới.</p></div><ResendVerificationForm /><Link className="verification-back" href="/dang-nhap">← Quay lại đăng nhập</Link></section></div>;
}
