'use client';

import { FormEvent, useState } from 'react';

export function NewsletterForm() {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = new FormData(form).get('email');
    setSubmitting(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/community/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(result.message || 'Không thể đăng ký nhận tin.');
      form.reset();
      setMessage('Đã ghi nhận email. Chúng tôi sẽ thông báo khi bản tin ra mắt.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể đăng ký nhận tin.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="newsletter-email">Email đăng ký</label>
      <div>
        <input id="newsletter-email" name="email" type="email" required placeholder="ban@vidu.vn" />
        <button type="submit" disabled={submitting}>{submitting ? 'Đang gửi…' : 'Đăng ký →'}</button>
      </div>
      <p role="status" aria-live="polite">{message}</p>
    </form>
  );
}
