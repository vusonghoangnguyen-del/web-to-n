import type { Metadata } from 'next';
import Link from 'next/link';
import { PasswordResetForm } from '@/components/password-reset-form';

export const metadata: Metadata = { title: 'Quên mật khẩu' };

export default function ForgotPasswordPage() {
  return <main className="auth-page page-shell"><section className="auth-intro"><span className="eyebrow">Tài khoản độc giả</span><h1>Đặt lại mật khẩu.</h1><p>Nhập email đăng ký. Nếu tài khoản hợp lệ, chúng tôi sẽ gửi một liên kết có hiệu lực 30 phút.</p></section><section className="auth-card"><header><span>Khôi phục tài khoản</span><h2>Quên mật khẩu</h2></header><PasswordResetForm /><footer>Đã nhớ mật khẩu? <Link href="/dang-nhap">Đăng nhập</Link></footer></section></main>;
}
