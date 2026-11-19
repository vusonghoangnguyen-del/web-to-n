'use client';

import { FormEvent, useEffect, useState } from 'react';

export function ResendVerificationForm() {
  const [email, setEmail] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setEmail(sessionStorage.getItem('pendingVerificationEmail') ?? '');
    const sentAt = Number(sessionStorage.getItem('verificationEmailSentAt') ?? 0);
    const update = () => setRemaining(Math.max(0, 60 - Math.floor((Date.now() - sentAt) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('Đang gửi email…');
    try {
      const normalized = email.trim().toLowerCase();
      const response = await fetch('/api/v1/auth/email/resend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readMessage(result, 'Không thể gửi lại email xác minh.'));
      sessionStorage.setItem('pendingVerificationEmail', normalized);
      sessionStorage.setItem('verificationEmailSentAt', String(Date.now()));
      setRemaining(60);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể gửi lại email xác minh.');
    }
  }

  return <form className="resend-verification-form" onSubmit={submit}><label>Email đăng ký<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={255} autoComplete="email" required /></label><button className="ink-button" type="submit" disabled={remaining > 0}>{remaining > 0 ? `Có thể gửi lại sau ${remaining}s` : 'Gửi lại email xác minh'}</button><p role="status">{message}</p></form>;
}

function readMessage(result: { message?: string | string[] }, fallback: string) { return Array.isArray(result.message) ? result.message.join(' ') : result.message || fallback; }
