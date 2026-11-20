import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';

export const metadata: Metadata = { title: 'Đăng nhập', description: 'Đăng nhập tài khoản Tờ Toán để gửi bài, lời giải và tham gia thảo luận.' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; password?: string }> }) {
  const params = await searchParams;
  if ('password' in params) {
    const { redirect } = await import('next/navigation');
    redirect('/dang-nhap');
  }
  return <div className="auth-page page-shell"><section className="auth-card"><header><h1>Đăng nhập</h1></header>{params.error && <p className="auth-message" role="alert">{params.error === 'unverified' ? 'Bạn cần xác minh email trước khi đăng nhập.' : params.error === 'unavailable' ? 'Máy chủ đang bận, vui lòng thử lại.' : 'Email hoặc mật khẩu không đúng.'}</p>}<Suspense fallback={<p>Đang tải biểu mẫu…</p>}><AuthForm mode="login" /></Suspense><footer>Chưa có tài khoản? <Link href="/dang-ky">Đăng ký miễn phí</Link></footer></section></div>;
}
