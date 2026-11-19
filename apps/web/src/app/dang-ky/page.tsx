import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';

export const metadata: Metadata = { title: 'Đăng ký', description: 'Tạo tài khoản độc giả Tờ Toán và xác minh địa chỉ email.' };

export default function RegisterPage() {
  return <main className="auth-page page-shell"><section className="auth-intro register"><span className="eyebrow">Tham gia cộng đồng</span><h1>Mỗi lời giải<br />là một góc nhìn.</h1><p>Tài khoản mới có vai trò độc giả. Sau khi xác minh email, bạn có thể bình luận, gửi lời giải và đăng bài toán.</p><ol><li>Nhập thông tin tài khoản</li><li>Mở email xác minh</li><li>Bấm liên kết để đăng nhập tự động</li></ol></section><section className="auth-card"><header><span>Tạo tài khoản Reader</span><h2>Đăng ký</h2></header><Suspense fallback={<p>Đang tải biểu mẫu…</p>}><AuthForm mode="register" /></Suspense><footer>Đã có tài khoản? <Link href="/dang-nhap">Đăng nhập</Link></footer></section></main>;
}
