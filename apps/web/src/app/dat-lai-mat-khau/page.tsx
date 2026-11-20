import type { Metadata } from 'next';
import Link from 'next/link';
import { PasswordResetForm } from '@/components/password-reset-form';

export const metadata: Metadata = { title: 'Đặt lại mật khẩu' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <main className="auth-page page-shell"><section className="auth-intro"><span className="eyebrow">Tài khoản độc giả</span><h1>Mật khẩu mới.</h1><p>Sau khi đổi mật khẩu, mọi phiên đăng nhập cũ sẽ hết hiệu lực.</p></section><section className="auth-card"><header><span>Khôi phục tài khoản</span><h2>Đặt lại mật khẩu</h2></header>{token ? <PasswordResetForm token={token} /> : <p className="auth-message" role="alert">Liên kết đặt lại mật khẩu không hợp lệ.</p>}<footer><Link href="/dang-nhap">Trở lại đăng nhập</Link></footer></section></main>;
}
