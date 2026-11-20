import type { Metadata } from 'next';
import Link from 'next/link';
import { PasswordResetForm } from '@/components/password-reset-form';

export const metadata: Metadata = { title: 'Đặt lại mật khẩu' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <div className="auth-page page-shell"><section className="auth-card"><header><h1>Đặt lại mật khẩu</h1></header><p>Sau khi đổi mật khẩu, các phiên đăng nhập cũ sẽ hết hiệu lực.</p>{token ? <PasswordResetForm token={token} /> : <p className="auth-message" role="alert">Liên kết đặt lại mật khẩu không hợp lệ.</p>}<footer><Link href="/dang-nhap">Trở lại đăng nhập</Link></footer></section></div>;
}
