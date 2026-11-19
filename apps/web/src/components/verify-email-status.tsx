'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Status = 'working' | 'success' | 'error';

export function VerifyEmailStatus({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>('working');
  const [message, setMessage] = useState('Đang kiểm tra liên kết xác minh…');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Liên kết xác minh không có token.');
      return;
    }
    fetch('/api/v1/auth/email/verify', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message || 'Không thể xác minh email.');
        sessionStorage.removeItem('pendingVerificationEmail');
        sessionStorage.removeItem('verificationEmailSentAt');
        window.dispatchEvent(new Event('auth-changed'));
        setStatus('success');
        setMessage(`Email đã được xác minh. Chào ${result.user.name}! Tài khoản Reader của bạn đã sẵn sàng.`);
        history.replaceState(null, '', '/xac-minh-email');
      })
      .catch((error) => {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Không thể xác minh email.');
      });
  }, [token]);

  return <div className={`verify-status ${status}`}><span className="verification-mark" aria-hidden="true">{status === 'working' ? '…' : status === 'success' ? '✓' : '!'}</span><p role="status">{message}</p>{status === 'success' && <Link className="ink-button" href="/">Về trang chủ →</Link>}{status === 'error' && <div><Link className="outline-button" href="/kiem-tra-email">Gửi lại email</Link><Link className="plain-button" href="/dang-nhap">Đăng nhập</Link></div>}</div>;
}
