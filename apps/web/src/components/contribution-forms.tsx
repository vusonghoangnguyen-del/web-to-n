'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { DebouncedMathPreview, MarkdownTextarea } from './markdown-editor';

export function ContributionForms({ problemId, kind }: { problemId: string; kind?: 'solution' | 'comment' }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((response) => setAuthenticated(response.ok))
      .catch(() => setAuthenticated(false))
      .finally(() => setSessionChecked(true));
  }, []);

  if (!sessionChecked) return <p className="account-hint">Đang kiểm tra tài khoản…</p>;
  if (!authenticated) {
    return <p className="account-hint">Bạn cần <Link href={`/dang-nhap?return=${encodeURIComponent(pathname)}`}>đăng nhập</Link> để gửi lời giải hoặc tham gia thảo luận.</p>;
  }

  return <div className={kind ? 'contribution-single' : 'contribution-grid'}>{kind !== 'comment' && <SubmissionForm problemId={problemId} kind="solution" onSuccess={() => router.refresh()} />}{kind !== 'solution' && <SubmissionForm problemId={problemId} kind="comment" onSuccess={() => router.refresh()} />}</div>;
}

function SubmissionForm({ problemId, kind, onSuccess }: { problemId: string; kind: 'solution' | 'comment'; onSuccess: () => void }) {
  const isSolution = kind === 'solution';
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/problems/${problemId}/${isSolution ? 'solutions' : 'comments'}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: value.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message || 'Không thể gửi nội dung.');
      setValue('');
      setMessage(isSolution ? 'Đã gửi lời giải tới tòa soạn để kiểm chứng.' : 'Đã đăng bình luận.');
      onSuccess();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể gửi nội dung.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="contribution-form" onSubmit={submit}>
      <span className="eyebrow">{isSolution ? 'Bài làm của bạn' : 'Cùng trao đổi'}</span>
      <h3>{isSolution ? 'Gửi một lời giải' : 'Thêm bình luận'}</h3>
      <label htmlFor={`${kind}-content`}>{isSolution ? 'Trình bày đầy đủ các bước' : 'Nội dung bình luận'}</label>
      <MarkdownTextarea id={`${kind}-content`} value={value} onValueChange={setValue} minLength={isSolution ? 20 : 2} maxLength={isSolution ? 10000 : 2000} rows={isSolution ? 10 : 6} placeholder={isSolution ? 'Trình bày bằng Markdown và đặt công thức trong $...$ hoặc $$...$$.' : 'Viết bình luận; bạn có thể dùng công thức $x^2$.'} required />
      <details className="contribution-preview" open={isSolution}><summary>Xem trước nội dung</summary><DebouncedMathPreview content={value} empty="Nội dung xem trước sẽ xuất hiện ở đây." /></details>
      <div><small>{isSolution ? '20–10.000 ký tự · Lời giải sẽ được duyệt trước khi công khai.' : '2–2.000 ký tự.'}</small><button className="ink-button" type="submit" disabled={submitting}>{submitting ? 'Đang gửi…' : 'Gửi →'}</button></div>
      <p role="status">{message}</p>
    </form>
  );
}
