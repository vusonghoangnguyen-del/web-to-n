'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';

type Mode = 'login' | 'register';

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const isRegister = mode === 'register';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setUnverifiedEmail('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const payload = isRegister
      ? {
          username: String(form.get('username') ?? '').trim().toLowerCase(),
          email,
          password: String(form.get('password') ?? ''),
          passwordConfirmation: String(form.get('passwordConfirmation') ?? ''),
          acceptTerms: form.get('acceptTerms') === 'on',
        }
      : { email, password: String(form.get('password') ?? '') };

    if (isRegister && payload.password !== payload.passwordConfirmation) {
      setMessage('Mật khẩu nhập lại không khớp.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/v1/auth/${isRegister ? 'register' : 'login'}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (!isRegister && response.status === 403) {
          sessionStorage.setItem('pendingVerificationEmail', email);
          setUnverifiedEmail(email);
        }
        throw new Error(readMessage(result, isRegister ? 'Không thể tạo tài khoản.' : 'Không thể đăng nhập.'));
      }

      if (isRegister) {
        sessionStorage.setItem('pendingVerificationEmail', email);
        sessionStorage.setItem('verificationEmailSentAt', String(Date.now()));
        router.push('/kiem-tra-email');
        return;
      }

      window.dispatchEvent(new Event('auth-changed'));
      const home = ['admin', 'moderator'].includes(result?.user?.role) ? '/admin' : '/';
      router.push(safeReturnPath(searchParams.get('return'), home));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể kết nối tới máy chủ.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" method="post" action={isRegister ? '/api/v1/auth/register' : '/auth/submit'} onSubmit={submit}>
      {!isRegister && searchParams.get('return') && <input type="hidden" name="return" value={searchParams.get('return') ?? ''} />}
      {isRegister && <label>Tên đăng nhập<input name="username" type="text" minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]+" autoComplete="username" placeholder="nguyen_minh" required /><small>3–30 chữ cái, số hoặc dấu gạch dưới.</small></label>}
      <label>Email<input name="email" type="email" maxLength={255} autoComplete="email" placeholder="ban@vidu.vn" required /></label>
      <label>Mật khẩu<input name="password" type="password" minLength={isRegister ? 8 : undefined} maxLength={128} autoComplete={isRegister ? 'new-password' : 'current-password'} required />{isRegister && <small>Tối thiểu 8 ký tự.</small>}</label>
      {isRegister && <label>Nhập lại mật khẩu<input name="passwordConfirmation" type="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label>}
      {isRegister && <label className="terms-check"><input name="acceptTerms" type="checkbox" required /><span>Tôi đồng ý với điều khoản sử dụng và quy tắc cộng đồng.</span></label>}
      <button className="ink-button" type="submit" disabled={submitting}>{submitting ? 'Đang xử lý…' : isRegister ? 'Tạo tài khoản →' : 'Đăng nhập →'}</button>
      <p className="auth-message" role="status">{message}</p>
      {unverifiedEmail && <Link className="auth-resend-link" href="/kiem-tra-email">Gửi lại email xác minh →</Link>}
    </form>
  );
}

function readMessage(result: { message?: string | string[] }, fallback: string): string {
  if (Array.isArray(result.message)) return result.message.join(' ');
  return result.message || fallback;
}

function safeReturnPath(value: string | null, defaultPath: string): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : defaultPath;
}
