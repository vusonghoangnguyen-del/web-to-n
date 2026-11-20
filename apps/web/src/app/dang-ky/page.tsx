import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';

export const metadata: Metadata = { title: 'Đăng ký', description: 'Tạo tài khoản độc giả Tờ Toán và xác minh địa chỉ email.' };

export default function RegisterPage() {
  return <div className="auth-page page-shell"><section className="auth-card"><header><h1>Tạo tài khoản</h1></header><Suspense fallback={<p>Đang tải biểu mẫu…</p>}><AuthForm mode="register" /></Suspense><footer>Đã có tài khoản? <Link href="/dang-nhap">Đăng nhập</Link></footer></section></div>;
}
