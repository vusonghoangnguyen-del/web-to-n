import type { Metadata } from 'next';
import Link from 'next/link';
import { PasswordResetForm } from '@/components/password-reset-form';

export const metadata: Metadata = { title: 'Quên mật khẩu' };

export default function ForgotPasswordPage() {
  return <div className="auth-page page-shell"><section className="auth-card"><header><h1>Quên mật khẩu</h1></header><p>Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu.</p><PasswordResetForm /><footer>Đã nhớ mật khẩu? <Link href="/dang-nhap">Đăng nhập</Link></footer></section></div>;
}
