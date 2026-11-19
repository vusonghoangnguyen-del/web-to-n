import type { Metadata } from 'next';
import Link from 'next/link';
import { ResendVerificationForm } from '@/components/resend-verification-form';

export const metadata: Metadata = { title: 'Kiểm tra email', description: 'Kiểm tra hộp thư và xác minh tài khoản Tờ Toán.' };

export default function CheckEmailPage() {
  return <main className="verification-page page-shell"><section className="verification-card"><div className="verification-mark" aria-hidden="true">✉</div><span className="eyebrow">Còn một bước nữa</span><h1>Kiểm tra email<br />của bạn.</h1><p>Chúng tôi đã gửi một liên kết xác minh tới email đăng ký. Hãy mở email và bấm vào liên kết để hoàn tất kích hoạt tài khoản Reader.</p><div className="verification-note"><strong>Chưa thấy email?</strong><p>Kiểm tra thư rác hoặc nhập lại email bên dưới để nhận một liên kết mới.</p></div><ResendVerificationForm /><Link className="verification-back" href="/dang-nhap">← Quay lại đăng nhập</Link></section></main>;
}
