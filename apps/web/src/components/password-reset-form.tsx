'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

export function PasswordResetForm({ token }: { token?: string }) {
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const data = new FormData(event.currentTarget);
    const payload = token
      ? { token, password: String(data.get('password') || ''), passwordConfirmation: String(data.get('passwordConfirmation') || '') }
      : { email: String(data.get('email') || '') };
    try {
      const response = await fetch(token ? '/api/v1/auth/password/reset' : '/api/v1/auth/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { message?: string | string[] };
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message || 'Không thể xử lý yêu cầu.');
      setSuccess(true);
      setMessage(typeof result.message === 'string' ? result.message : 'Yêu cầu đã được xử lý.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể kết nối máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  return <form className="auth-form" onSubmit={submit}>
    {!success && (token
      ? <><label>Mật khẩu mới<input name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label><label>Nhập lại mật khẩu<input name="passwordConfirmation" type="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label></>
      : <label>Email đăng ký<input name="email" type="email" maxLength={255} autoComplete="email" required /></label>)}
    {!success && <button className="ink-button" type="submit" disabled={busy}>{busy ? 'Đang xử lý…' : token ? 'Đổi mật khẩu →' : 'Gửi liên kết →'}</button>}
    <p className="auth-message" role="status">{message}</p>
    {success && token && <Link href="/dang-nhap">Trở lại đăng nhập →</Link>}
  </form>;
}
