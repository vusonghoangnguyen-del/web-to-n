'use client';

import Link from 'next/link';
import { WorkspaceTabs } from './workspace-tabs';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { DebouncedMathPreview, MarkdownTextarea } from './markdown-editor';

const categories = [
  { slug: 'so-hoc', name: 'Số học' }, { slug: 'hinh-hoc', name: 'Hình học' },
  { slug: 'dai-so', name: 'Đại số' }, { slug: 'to-hop', name: 'Tổ hợp' },
  { slug: 'logic', name: 'Logic' }, { slug: 'xac-suat', name: 'Xác suất' },
];
const difficulties = ['Dễ', 'Trung bình', 'Khó', 'Thử thách'];
type EditorState = { title: string; body: string; source: string; difficulty: string; categorySlugs: string[]; changeSummary: string; latexBuildId: string | null };
type Revision = EditorState & { latexProjectId: string | null; id: string; version: number; status: string; createdAt: string; editor: { name: string } };
type LatexProject = { id: string; title: string };
type LatexBuild = { id: string; status: string; createdAt: string; pdfUrl: string | null };
const emptyState: EditorState = { title: '', body: '', source: '', difficulty: 'Trung bình', categorySlugs: [], changeSummary: '', latexBuildId: null };

export function ProblemEditor({ initialProjectId = '', initialBuildId = '', initialTitle = '' }: { initialProjectId?: string; initialBuildId?: string; initialTitle?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('id')?.trim() ?? '';
  const requestedProjectId = initialProjectId || searchParams.get('latexProjectId')?.trim() || '';
  const requestedBuildId = initialBuildId || searchParams.get('latexBuildId')?.trim() || '';
  const [problemId, setProblemId] = useState(requestedId);
  const [problemSlug, setProblemSlug] = useState('');
  const [problemStatus, setProblemStatus] = useState('draft');
  const [form, setForm] = useState<EditorState>(emptyState);
  const [initialSnapshot, setInitialSnapshot] = useState(JSON.stringify(emptyState));
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [latexProjects, setLatexProjects] = useState<LatexProject[]>([]);
  const [latexProjectId, setLatexProjectId] = useState('');
  const [latexBuilds, setLatexBuilds] = useState<LatexBuild[]>([]);
  const [latexError, setLatexError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'draft' | 'pending' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sideTab, setSideTab] = useState('editor-preview');
  const [mobileView, setMobileView] = useState('editor-write');
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
        const projects = await request<{ projects: LatexProject[] }>('/api/v1/latex/projects').catch(() => {
          if (!cancelled) setLatexError('Không tải được danh sách dự án LaTeX. Hãy tải lại trang.');
          return { projects: [] };
        });
        if (!cancelled) setLatexProjects(projects.projects);
        if (!requestedId) {
          if (/^[1-9]\d*$/.test(requestedProjectId) && /^[1-9]\d*$/.test(requestedBuildId)) {
            setLatexProjectId(requestedProjectId);
            setForm({ ...emptyState, title: initialTitle.slice(0, 255), latexBuildId: requestedBuildId });
          } else if (initialTitle) {
            setForm({ ...emptyState, title: initialTitle.slice(0, 255) });
          }
          setLoading(false); return;
        }
        if (!/^[1-9]\d*$/.test(requestedId)) throw new Error('Mã bài viết không hợp lệ.');
        const history = await request<{ revisions: Revision[] }>(`/api/v1/problems/${requestedId}/history`);
        if (!history.revisions.length) throw new Error('Bài viết chưa có phiên bản để chỉnh sửa.');
        const latest = history.revisions[0];
        const next = { title: latest.title, body: latest.body, source: latest.source ?? '', difficulty: latest.difficulty, categorySlugs: latest.categorySlugs, changeSummary: '', latexBuildId: latest.latexBuildId ?? null };
        if (cancelled) return;
        setForm(next); setInitialSnapshot(JSON.stringify(next)); setProblemStatus(latest.status); setRevisions(history.revisions); setLatexProjectId(latest.latexProjectId ?? '');
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải bài viết.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    start();
    return () => { cancelled = true; };
  }, [requestedId, requestedProjectId, requestedBuildId, initialTitle, router]);

  useEffect(() => {
    let cancelled = false;
    if (!latexProjectId) { setLatexBuilds([]); return; }
    setLatexBuilds([]);
    setLatexError('');
    request<{ builds: LatexBuild[] }>(`/api/v1/latex/projects/${latexProjectId}/builds`)
      .then((result) => { if (!cancelled) setLatexBuilds(result.builds.filter((build) => build.status === 'success' && build.pdfUrl)); })
      .catch(() => { if (!cancelled) setLatexError('Không tải được các bản PDF của dự án.'); });
    return () => { cancelled = true; };
  }, [latexProjectId]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);


  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) { setForm((current) => ({ ...current, [key]: value })); setMessage(''); setError(''); }
  function toggleCategory(slug: string) { update('categorySlugs', form.categorySlugs.includes(slug) ? form.categorySlugs.filter((item) => item !== slug) : form.categorySlugs.length < 5 ? [...form.categorySlugs, slug] : form.categorySlugs); }

  async function save(event: FormEvent<HTMLFormElement>, status: 'draft' | 'pending') {
    event.preventDefault();
    setMessage(''); setError('');
    if (readOnly) { setError('Bài đã xuất bản chỉ có thể được sửa bởi moderator hoặc admin.'); return; }
    if (form.title.trim().length < 5 || form.body.trim().length < 10) {
      setMobileView('editor-write');
      setError(form.title.trim().length < 5 ? 'Tiêu đề cần ít nhất 5 ký tự.' : 'Nội dung cần ít nhất 10 ký tự.');
      return;
    }
    if (!form.categorySlugs.length) {
      setSideTab('editor-info'); setMobileView('editor-info');
      setError('Hãy chọn ít nhất một chuyên mục trong Thông tin.');
      return;
    }
    setSaving(status);
    const payload = { title: form.title.trim(), body: form.body.trim(), source: form.source.trim(), difficulty: form.difficulty, categorySlugs: form.categorySlugs, latexBuildId: form.latexBuildId, status, ...(problemId ? { changeSummary: form.changeSummary.trim() || (status === 'pending' ? 'Cập nhật và gửi duyệt' : 'Cập nhật bản nháp') } : {}) };
    try {
      const result = await request<{ problem: { id: string; slug: string; status: string } }>(problemId ? `/api/v1/problems/${problemId}` : '/api/v1/problems', { method: problemId ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setProblemId(result.problem.id); setProblemSlug(result.problem.slug); setProblemStatus(result.problem.status);
      const clean = { ...form, title: payload.title, body: payload.body, source: payload.source, changeSummary: '' };
      setForm(clean); setInitialSnapshot(JSON.stringify(clean));
      setMessage(status === 'pending' ? 'Đã gửi bài tới tòa soạn để duyệt.' : 'Đã lưu bản nháp.');
      router.replace(`/soan-bai?id=${result.problem.id}`);
      const history = await request<{ revisions: Revision[] }>(`/api/v1/problems/${result.problem.id}/history`);
      setRevisions(history.revisions);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu bài viết.'); }
    finally { setSaving(null); }
  }

  if (loading) return <div className="editor-loading"><span></span><p>Đang chuẩn bị bàn soạn…</p></div>;
  if (error && requestedId && !form.title) return <div className="editor-fatal"><h1>Không mở được bài viết</h1><p>{error}</p><Link className="outline-button" href="/ho-so#bai-dang">← Về hồ sơ</Link></div>;

  return <>
    <header className="editor-heading"><div><h1>{problemId ? 'Chỉnh sửa bài viết' : 'Soạn bài viết'}</h1><p>{dirty ? 'Có thay đổi chưa lưu' : problemId ? 'Đã lưu' : 'Bản nháp mới'}</p></div>{problemId && <Status value={problemStatus} />}</header>
    <form id="problem-editor-form" className="catalog-editor-form" noValidate onSubmit={(event) => save(event, 'pending')}>
              {readOnly && <div className="editor-readonly"><strong>Bài đã được xuất bản</strong><p>Tài khoản thường không thể sửa bài đã xuất bản. Nếu cần đính chính, hãy liên hệ moderator.</p><Link href={`/bai-toan/${problemSlug || requestedId}`}>Xem bài đã xuất bản →</Link></div>}
              {!readOnly && <div className="editor-actions"><button className="outline-button" type="button" disabled={saving !== null} onClick={(event) => save(event as unknown as FormEvent<HTMLFormElement>, 'draft')}>{saving === 'draft' ? 'Đang lưu…' : 'Lưu bản nháp'}</button><button className="ink-button" type="submit" disabled={saving !== null}>{saving === 'pending' ? 'Đang gửi…' : 'Gửi tòa soạn duyệt →'}</button></div>}
              {message && <p className="editor-message success" role="status">{message}</p>}{error && <p className="editor-message error" role="alert">{error}</p>}
      <div className="editor-mobile-switch" role="group" aria-label="Chế độ soạn bài">{[{id:'editor-write',label:'Nội dung'},{id:'editor-info',label:'Thông tin'},{id:'editor-preview',label:'Xem trước'}].map((view) => <button type="button" key={view.id} aria-pressed={mobileView === view.id} onClick={() => { setMobileView(view.id); if(view.id !== 'editor-write') setSideTab(view.id); }}>{view.label}</button>)}</div>
      <div className="problem-editor-form" data-mobile-view={mobileView}><div className="editor-fields">        <label><span>Tiêu đề bài viết</span><input value={form.title} onChange={(event) => update('title', event.target.value)} minLength={5} maxLength={255} placeholder="Một tiêu đề ngắn, mô tả đúng trọng tâm" disabled={readOnly} required /><small>{form.title.length}/255 ký tự</small></label>        <label><span>Nội dung hoặc phần giới thiệu <em>Markdown + LaTeX</em></span><MarkdownTextarea value={form.body} onValueChange={(value) => update('body', value)} minLength={10} maxLength={30000} rows={18} placeholder={'Trình bày nội dung bài viết hoặc tóm tắt tài liệu PDF…\n\nDùng **in đậm**, danh sách và công thức $x^2 + y^2 = z^2$.'} disabled={readOnly} required /><small>{form.body.length.toLocaleString('vi-VN')}/30.000 ký tự</small></label></div>
      <WorkspaceTabs className="editor-side-tabs" activeTab={sideTab} onTabChange={setSideTab} tabs={[{id:'editor-preview',label:'Xem trước'},{id:'editor-info',label:'Thông tin'},{id:'editor-history',label:'Lịch sử'}]}>
        <section id="editor-preview" className="editor-preview"><article><div><span>{form.categorySlugs.map((slug) => categories.find((item) => item.slug === slug)?.name).filter(Boolean).join(' · ') || 'Chưa chọn chuyên mục'}</span><span>{form.difficulty}</span></div><h2>{form.title || 'Tiêu đề bài viết'}</h2><DebouncedMathPreview content={form.body} empty="Nội dung bài viết sẽ xuất hiện tại đây." className="preview-body" />{form.latexBuildId && latexProjectId && <p className="preview-pdf-link"><a href={`/api/v1/latex/projects/${latexProjectId}/builds/${form.latexBuildId}/pdf`} target="_blank" rel="noopener noreferrer">Xem bản PDF sẽ đính kèm ↗</a></p>}{form.source && <small>Nguồn: {form.source}</small>}</article></section>
        <section id="editor-info" className="editor-metadata"><h2>Thông tin bài viết</h2>        <label><span>Nguồn tham khảo <em>không bắt buộc</em></span><input value={form.source} onChange={(event) => update('source', event.target.value)} maxLength={500} placeholder="https://… hoặc tên tài liệu" disabled={readOnly} /></label>
        <div className="editor-latex-attachment"><strong>PDF từ Dự án LaTeX <em>không bắt buộc</em></strong><p>Biên dịch dự án trước, rồi chọn đúng bản PDF muốn xuất bản. Nội dung phía trên là phần giới thiệu và văn bản dự phòng.</p><div><select aria-label="Dự án LaTeX" value={latexProjectId} onChange={(event) => { setLatexProjectId(event.target.value); update('latexBuildId', null); }} disabled={readOnly}><option value="">Chọn dự án LaTeX</option>{latexProjectId && !latexProjects.some((project) => project.id === latexProjectId) && <option value={latexProjectId}>Dự án đã chọn (#{latexProjectId})</option>}{latexProjects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><select aria-label="Bản PDF đã biên dịch" value={form.latexBuildId ?? ''} onChange={(event) => update('latexBuildId', event.target.value || null)} disabled={readOnly || !latexProjectId}><option value="">Không gắn PDF</option>{form.latexBuildId && !latexBuilds.some((build) => build.id === form.latexBuildId) && <option value={form.latexBuildId}>Bản PDF đã chọn (#{form.latexBuildId})</option>}{latexBuilds.map((build) => <option key={build.id} value={build.id}>Bản #{build.id} · {formatDate(build.createdAt)}</option>)}</select></div>{latexError && <p role="alert">{latexError}</p>}<Link href="/latex" target="_blank" rel="noopener noreferrer">Mở Dự án LaTeX ↗</Link></div>
        <fieldset disabled={readOnly}><legend>Chuyên mục <small>chọn từ 1 đến 5</small></legend><div className="editor-categories">{categories.map((category) => <label key={category.slug} className={form.categorySlugs.includes(category.slug) ? 'selected' : undefined}><input type="checkbox" checked={form.categorySlugs.includes(category.slug)} onChange={() => toggleCategory(category.slug)} disabled={!form.categorySlugs.includes(category.slug) && form.categorySlugs.length >= 5} /><span>{category.name}</span></label>)}</div></fieldset>
        <label><span>Độ khó</span><select value={form.difficulty} onChange={(event) => update('difficulty', event.target.value)} disabled={readOnly}>{difficulties.map((difficulty) => <option key={difficulty}>{difficulty}</option>)}</select></label>
        {problemId && !readOnly && <label><span>Ghi chú thay đổi <em>không bắt buộc</em></span><input value={form.changeSummary} onChange={(event) => update('changeSummary', event.target.value)} maxLength={500} placeholder="Ví dụ: làm rõ giả thiết ở đoạn đầu" /></label>}</section>
        <section id="editor-history">{problemId ? <RevisionHistory revisions={revisions} /> : <p>Chưa có phiên bản đã lưu.</p>}</section>
      </WorkspaceTabs></div>
    </form>
  </>;
}

function RevisionHistory({ revisions }: { revisions: Revision[] }) { return <section className="revision-history"><h3>Lịch sử phiên bản</h3>{revisions.map((revision) => <details key={revision.id}><summary><span>v{revision.version} · {revision.changeSummary || statusLabel(revision.status)}</span><time>{formatDate(revision.createdAt)}</time></summary><p>{revision.editor.name} · {statusLabel(revision.status)}</p></details>)}</section>; }
function Status({ value }: { value: string }) { return <span className={`profile-status status-${value}`}>{statusLabel(value)}</span>; }
async function request<T>(path: string, init?: RequestInit): Promise<T> { return readResponse<T>(await fetch(path, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } })); }
async function readResponse<T>(response: Response): Promise<T> { const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message || 'Không thể kết nối tới máy chủ.'); return result as T; }
function statusLabel(value: string) { return ({ draft: 'Bản nháp', pending: 'Chờ duyệt', published: 'Đã xuất bản', rejected: 'Từ chối' } as Record<string, string>)[value] ?? value; }
function formatDate(value: string) { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
