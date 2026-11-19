'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DebouncedMathPreview, MarkdownTextarea } from './markdown-editor';

const categories = [
  { slug: 'so-hoc', name: 'Số học' }, { slug: 'hinh-hoc', name: 'Hình học' },
  { slug: 'dai-so', name: 'Đại số' }, { slug: 'to-hop', name: 'Tổ hợp' },
  { slug: 'logic', name: 'Logic' }, { slug: 'xac-suat', name: 'Xác suất' },
];
const difficulties = ['Dễ', 'Trung bình', 'Khó', 'Thử thách'];
type EditorState = { title: string; body: string; source: string; difficulty: string; categorySlugs: string[]; changeSummary: string };
type Revision = EditorState & { id: string; version: number; status: string; createdAt: string; editor: { name: string } };
const emptyState: EditorState = { title: '', body: '', source: '', difficulty: 'Trung bình', categorySlugs: [], changeSummary: '' };

export function ProblemEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('id')?.trim() ?? '';
  const [problemId, setProblemId] = useState(requestedId);
  const [problemSlug, setProblemSlug] = useState('');
  const [problemStatus, setProblemStatus] = useState('draft');
  const [form, setForm] = useState<EditorState>(emptyState);
  const [initialSnapshot, setInitialSnapshot] = useState(JSON.stringify(emptyState));
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'draft' | 'pending' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const dirty = JSON.stringify(form) !== initialSnapshot;
  const readOnly = problemStatus === 'published';

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const sessionResponse = await fetch('/api/v1/auth/me', { credentials: 'include' });
        if (sessionResponse.status === 401) { router.replace(`/dang-nhap?return=${encodeURIComponent(requestedId ? `/soan-bai?id=${requestedId}` : '/soan-bai')}`); return; }
        await readResponse(sessionResponse);
        if (cancelled) return;
        if (!requestedId) { setLoading(false); return; }
        if (!/^[1-9]\d*$/.test(requestedId)) throw new Error('Mã bài toán không hợp lệ.');
        const history = await request<{ revisions: Revision[] }>(`/api/v1/problems/${requestedId}/history`);
        if (!history.revisions.length) throw new Error('Bài toán chưa có phiên bản để chỉnh sửa.');
        const latest = history.revisions[0];
        const next = { title: latest.title, body: latest.body, source: latest.source ?? '', difficulty: latest.difficulty, categorySlugs: latest.categorySlugs, changeSummary: '' };
        if (cancelled) return;
        setForm(next); setInitialSnapshot(JSON.stringify(next)); setProblemStatus(latest.status); setRevisions(history.revisions);
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải bài toán.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    start();
    return () => { cancelled = true; };
  }, [requestedId, router]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const completion = useMemo(() => [form.title.length >= 5, form.body.length >= 10, form.categorySlugs.length > 0].filter(Boolean).length, [form]);

  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) { setForm((current) => ({ ...current, [key]: value })); setMessage(''); setError(''); }
  function toggleCategory(slug: string) { update('categorySlugs', form.categorySlugs.includes(slug) ? form.categorySlugs.filter((item) => item !== slug) : form.categorySlugs.length < 5 ? [...form.categorySlugs, slug] : form.categorySlugs); }

  async function save(event: FormEvent<HTMLFormElement>, status: 'draft' | 'pending') {
    event.preventDefault();
    setMessage(''); setError('');
    if (readOnly) { setError('Bài đã xuất bản chỉ có thể được sửa bởi moderator hoặc admin.'); return; }
    if (form.title.trim().length < 5 || form.body.trim().length < 10 || !form.categorySlugs.length) { setError('Hãy hoàn thiện tiêu đề, đề bài và chọn ít nhất một chuyên mục.'); return; }
    setSaving(status);
    const payload = { title: form.title.trim(), body: form.body.trim(), source: form.source.trim(), difficulty: form.difficulty, categorySlugs: form.categorySlugs, status, ...(problemId ? { changeSummary: form.changeSummary.trim() || (status === 'pending' ? 'Cập nhật và gửi duyệt' : 'Cập nhật bản nháp') } : {}) };
    try {
      const result = await request<{ problem: { id: string; slug: string; status: string } }>(problemId ? `/api/v1/problems/${problemId}` : '/api/v1/problems', { method: problemId ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setProblemId(result.problem.id); setProblemSlug(result.problem.slug); setProblemStatus(result.problem.status);
      const clean = { ...form, title: payload.title, body: payload.body, source: payload.source, changeSummary: '' };
      setForm(clean); setInitialSnapshot(JSON.stringify(clean));
      setMessage(status === 'pending' ? 'Đã gửi bài tới tòa soạn để duyệt.' : 'Đã lưu bản nháp.');
      router.replace(`/soan-bai?id=${result.problem.id}`);
      const history = await request<{ revisions: Revision[] }>(`/api/v1/problems/${result.problem.id}/history`);
      setRevisions(history.revisions);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu bài toán.'); }
    finally { setSaving(null); }
  }

  if (loading) return <div className="editor-loading"><span></span><p>Đang chuẩn bị bàn soạn…</p></div>;
  if (error && requestedId && !form.title) return <div className="editor-fatal"><h1>Không mở được bài toán</h1><p>{error}</p><Link className="outline-button" href="/ho-so#bai-dang">← Về hồ sơ</Link></div>;

  return <>
    <header className="editor-heading"><div><span className="eyebrow">{problemId ? 'Chỉnh sửa bài toán' : 'Bản thảo mới'}</span><h1>Bàn soạn bài</h1><p>Viết rõ giả thiết, yêu cầu và các ký hiệu cần thiết. Bạn có thể lưu nháp trước khi gửi tòa soạn.</p></div><aside><strong>{completion}/3</strong><span>mục tối thiểu đã hoàn thành</span>{problemId && <Status value={problemStatus} />}</aside></header>

    <form className="problem-editor-form" onSubmit={(event) => save(event, 'pending')}>
      <div className="editor-fields">
        <label><span>01 · Tiêu đề</span><input value={form.title} onChange={(event) => update('title', event.target.value)} minLength={5} maxLength={255} placeholder="Một tiêu đề ngắn, mô tả đúng trọng tâm" disabled={readOnly} required /><small>{form.title.length}/255 ký tự</small></label>
        <label><span>02 · Đề bài <em>Markdown + LaTeX</em></span><MarkdownTextarea value={form.body} onValueChange={(value) => update('body', value)} minLength={10} maxLength={30000} rows={18} placeholder={'Trình bày đầy đủ đề bài…\n\nDùng **in đậm**, danh sách và công thức $x^2 + y^2 = z^2$.'} disabled={readOnly} required /><small>{form.body.length.toLocaleString('vi-VN')}/30.000 ký tự</small></label>
        <label><span>03 · Nguồn tham khảo <em>không bắt buộc</em></span><input value={form.source} onChange={(event) => update('source', event.target.value)} maxLength={500} placeholder="https://… hoặc tên tài liệu" disabled={readOnly} /></label>
        <fieldset disabled={readOnly}><legend>04 · Chuyên mục <small>chọn từ 1 đến 5</small></legend><div className="editor-categories">{categories.map((category) => <label key={category.slug} className={form.categorySlugs.includes(category.slug) ? 'selected' : undefined}><input type="checkbox" checked={form.categorySlugs.includes(category.slug)} onChange={() => toggleCategory(category.slug)} disabled={!form.categorySlugs.includes(category.slug) && form.categorySlugs.length >= 5} /><span>{category.name}</span></label>)}</div></fieldset>
        <label><span>05 · Độ khó</span><select value={form.difficulty} onChange={(event) => update('difficulty', event.target.value)} disabled={readOnly}>{difficulties.map((difficulty) => <option key={difficulty}>{difficulty}</option>)}</select></label>
        {problemId && !readOnly && <label><span>Ghi chú thay đổi <em>không bắt buộc</em></span><input value={form.changeSummary} onChange={(event) => update('changeSummary', event.target.value)} maxLength={500} placeholder="Ví dụ: làm rõ giả thiết ở đoạn đầu" /></label>}
        {readOnly && <div className="editor-readonly"><strong>Bài đã được xuất bản</strong><p>Tài khoản thường không thể sửa bài đã xuất bản. Nếu cần đính chính, hãy liên hệ moderator.</p><Link href={`/bai-toan/${problemSlug || requestedId}`}>Xem bài đã xuất bản →</Link></div>}
        {!readOnly && <div className="editor-actions"><button className="outline-button" type="button" disabled={saving !== null} onClick={(event) => save(event as unknown as FormEvent<HTMLFormElement>, 'draft')}>{saving === 'draft' ? 'Đang lưu…' : 'Lưu bản nháp'}</button><button className="ink-button" type="submit" disabled={saving !== null}>{saving === 'pending' ? 'Đang gửi…' : 'Gửi tòa soạn duyệt →'}</button><span>{dirty ? 'Có thay đổi chưa lưu' : problemId ? 'Đã lưu' : 'Chưa có bản lưu'}</span></div>}
        {message && <p className="editor-message success" role="status">{message}</p>}{error && <p className="editor-message error" role="alert">{error}</p>}
      </div>

      <aside className="editor-preview"><div className="preview-sticky"><span className="eyebrow">Xem trước · cập nhật sau 400 ms</span><article><div><span>{form.categorySlugs.map((slug) => categories.find((item) => item.slug === slug)?.name).filter(Boolean).join(' · ') || 'Chưa chọn chuyên mục'}</span><span>{form.difficulty}</span></div><h2>{form.title || 'Tiêu đề bài toán'}</h2><DebouncedMathPreview content={form.body} empty="Nội dung đề bài sẽ xuất hiện tại đây." className="preview-body" />{form.source && <small>Nguồn: {form.source}</small>}</article>{problemId && <RevisionHistory revisions={revisions} />}</div></aside>
    </form>
  </>;
}

function RevisionHistory({ revisions }: { revisions: Revision[] }) { return <section className="revision-history"><h3>Lịch sử phiên bản</h3>{revisions.map((revision) => <details key={revision.id}><summary><span>v{revision.version} · {revision.changeSummary || statusLabel(revision.status)}</span><time>{formatDate(revision.createdAt)}</time></summary><p>{revision.editor.name} · {statusLabel(revision.status)}</p></details>)}</section>; }
function Status({ value }: { value: string }) { return <span className={`profile-status status-${value}`}>{statusLabel(value)}</span>; }
async function request<T>(path: string, init?: RequestInit): Promise<T> { return readResponse<T>(await fetch(path, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } })); }
async function readResponse<T>(response: Response): Promise<T> { const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message || 'Không thể kết nối tới máy chủ.'); return result as T; }
function statusLabel(value: string) { return ({ draft: 'Bản nháp', pending: 'Chờ duyệt', published: 'Đã xuất bản', rejected: 'Từ chối' } as Record<string, string>)[value] ?? value; }
function formatDate(value: string) { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
