'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { MathContent } from './math-content';
import { WorkspaceTabs } from './workspace-tabs';
import { RecordBrowser } from './record-browser';

type SessionUser = { id: string; name: string; username: string; role: string };
type Stats = { pendingProblems: number; publishedProblems: number; users: number; pendingSolutions: number; pendingReports: number };
type Problem = { id: string; title: string; content: string; source: string | null; difficulty: string; status: string; createdAt: string; categories: string; author: { name: string; email: string } };
type Solution = { id: string; content: string; status: string; reviewNote: string | null; isFeatured: boolean; createdAt: string; author: { name: string; email?: string }; problem: { id: string; slug: string; title: string } };
type Comment = { id: string; content: string; status: string; createdAt: string; author: { name: string }; problem: { id: string; title: string } };
type Report = { id: string; reason: string; details: string | null; status: string; createdAt: string; reporter: { name: string }; reviewer: { name: string } | null; comment: { content: string; author: { name: string }; problem: { id: string; title: string } } };
type Audit = { id: string; action: string; targetType: string; targetId: string; details: unknown; createdAt: string; actor: { name: string; username: string } | null };

const emptyStats: Stats = { pendingProblems: 0, publishedProblems: 0, users: 0, pendingSolutions: 0, pendingReports: 0 };

export function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [stats, setStats] = useState(emptyStats);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [problemStatus, setProblemStatus] = useState('pending');
  const [solutionStatus, setSolutionStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const request = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } });
    if (response.status === 401) { router.replace('/dang-nhap?return=/admin'); throw new Error('Phiên đăng nhập đã hết hạn.'); }
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || `Không thể hoàn tất yêu cầu (HTTP ${response.status}).`);
    return data as T;
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true); setMessage('');
    try {
      const session = await request<{ user: SessionUser }>('/api/v1/auth/me');
      if (!['moderator', 'admin'].includes(session.user.role)) { setUser(session.user); throw new Error('Tài khoản này không có quyền mở bàn biên tập.'); }
      setUser(session.user);
      const [statsData, problemData, solutionData, commentData, reportData, auditData] = await Promise.all([
        request<{ stats: Stats }>('/api/v1/moderation/stats'),
        request<{ problems: Problem[] }>(`/api/v1/moderation/problems?status=${problemStatus}&limit=100`),
        request<{ solutions: Solution[] }>(`/api/v1/solutions/moderation?status=${solutionStatus}&limit=100`),
        request<{ comments: Comment[] }>('/api/v1/moderation/comments?status=all&limit=100'),
        request<{ reports: Report[] }>('/api/v1/moderation/reports?status=all&limit=100'),
        request<{ auditLogs: Audit[] }>('/api/v1/moderation/audit-logs?limit=50'),
      ]);
      setStats(statsData.stats); setProblems(problemData.problems); setSolutions(solutionData.solutions);
      setComments(commentData.comments); setReports(reportData.reports); setAudits(auditData.auditLogs);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể tải bàn biên tập.'); }
    finally { setLoading(false); }
  }, [problemStatus, request, solutionStatus]);

  useEffect(() => { void load(); }, [load]);

  async function mutate(key: string, url: string, body: unknown, success: string) {
    setBusy(key); setMessage('');
    try { await request(url, { method: 'PATCH', body: JSON.stringify(body) }); await load(); setMessage(success); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Thao tác thất bại.'); return false; }
    finally { setBusy(''); }
  }

  function reviewProblem(problem: Problem, status: string, note: string) {
    return mutate(`problem-${problem.id}`, `/api/v1/moderation/problems/${problem.id}`, { status, reviewNote: note.trim() }, 'Đã cập nhật trạng thái bài viết.');
  }

  function reviewSolution(solution: Solution, status: string, note: string) {
    return mutate(`solution-${solution.id}`, `/api/v1/solutions/${solution.id}/review`, { status, reviewNote: note.trim() }, 'Đã cập nhật trạng thái lời giải.');
  }

  if (loading && !user) return <section className="admin-gate"><span /><p>Đang mở bàn biên tập…</p></section>;
  if (!user || !['moderator', 'admin'].includes(user.role)) return <section className="admin-denied page-shell"><span>!</span><h1>Không có quyền truy cập.</h1><p>{message || 'Chỉ điều hành viên và admin được mở trang này.'}</p><Link className="ink-button" href="/">Về trang chính</Link></section>;

  return <div className="admin-page">
    <section className="admin-hero page-shell"><div><h1>Bàn biên tập</h1><p>{user.name} · {roleLabel(user.role)}</p></div></section>

    <section className="admin-stats page-shell" aria-label="Thống kê"><Stat number={stats.pendingProblems} label="Bài chờ duyệt"/><Stat number={stats.pendingSolutions} label="Lời giải chờ duyệt"/><Stat number={stats.pendingReports} label="Báo cáo mới"/><Stat number={stats.users} label="Tài khoản"/><Stat number={stats.publishedProblems} label="Bài đã xuất bản"/></section>
    {message && <p className="admin-message page-shell" role="status">{message}</p>}

    <WorkspaceTabs className="admin-workspace page-shell" syncHash tabs={[{id:"duyet-bai",label:"Bài viết ("+stats.pendingProblems+")"},{id:"duyet-loi-giai",label:"Lời giải ("+stats.pendingSolutions+")"},{id:"thao-luan",label:"Thảo luận"},{id:"bao-cao",label:"Báo cáo ("+stats.pendingReports+")"},{id:"nhat-ky",label:"Nhật ký"}]}><AdminSection id="duyet-bai" number="01" title="Duyệt bài viết" controls={<select value={problemStatus} onChange={(event) => setProblemStatus(event.target.value)}><option value="pending">Chờ duyệt</option><option value="published">Đã xuất bản</option><option value="rejected">Đã từ chối</option><option value="all">Tất cả</option></select>}>
      {problems.length ? <RecordBrowser items={problems.map((problem) => ({id:problem.id,title:problem.title,subtitle:problem.author.name + " · " + statusLabel(problem.status)}))}>{problems.map((problem, index) => <article className="moderation-card" key={problem.id}>
        <span className="moderation-number">{String(index + 1).padStart(2, '0')}</span>
        <div className="moderation-copy"><div className="moderation-meta"><Status value={problem.status}/><span>{problem.categories || 'Chưa phân loại'}</span><span>{problem.difficulty}</span><time>{date(problem.createdAt)}</time></div><h3>{problem.title}</h3><MathContent content={problem.content}/><small>Gửi bởi <strong>{problem.author.name}</strong> · {problem.author.email}</small></div>
        <div className="moderation-actions"><ReviewActions kind="problem" currentStatus={problem.status} busy={busy === `problem-${problem.id}`} onReview={(status, note) => reviewProblem(problem, status, note)} /></div>
      </article>)}</RecordBrowser> : <Empty text="Không có bài viết trong nhóm trạng thái này."/>}
    </AdminSection>

    <AdminSection id="duyet-loi-giai" number="02" title="Duyệt lời giải" controls={<select value={solutionStatus} onChange={(event) => setSolutionStatus(event.target.value)}><option value="pending">Chờ duyệt</option><option value="verified">Đã kiểm chứng</option><option value="rejected">Đã từ chối</option><option value="all">Tất cả</option></select>}>
      {solutions.length ? <RecordBrowser items={solutions.map((solution) => ({id:solution.id,title:solution.problem.title,subtitle:solution.author.name + " · " + statusLabel(solution.status)}))}>{solutions.map((solution) => <article className="solution-review-card" key={solution.id}>
        <div><div className="moderation-meta"><Status value={solution.status}/>{solution.isFeatured && <span>★ Nổi bật</span>}<time>{date(solution.createdAt)}</time></div><h3><Link href={`/bai-toan/${encodeURIComponent(solution.problem.slug || solution.problem.id)}`}>{solution.problem.title}</Link></h3><small>Lời giải của <strong>{solution.author.name}</strong>{solution.author.email ? ` · ${solution.author.email}` : ''}</small><MathContent content={solution.content}/>{solution.reviewNote && <em>Ghi chú: {solution.reviewNote}</em>}</div>
        <div className="moderation-actions"><ReviewActions kind="solution" currentStatus={solution.status} busy={busy === `solution-${solution.id}`} onReview={(status, note) => reviewSolution(solution, status, note)} />{solution.status === 'verified' && <button disabled={busy === `feature-${solution.id}`} className="outline-button" onClick={() => void mutate(`feature-${solution.id}`, `/api/v1/solutions/${solution.id}/featured`, { featured: !solution.isFeatured }, solution.isFeatured ? 'Đã bỏ đánh dấu nổi bật.' : 'Đã đánh dấu lời giải nổi bật.')}>{solution.isFeatured ? 'Bỏ nổi bật' : 'Đánh dấu nổi bật'}</button>}</div>
      </article>)}</RecordBrowser> : <Empty text="Không có lời giải trong nhóm trạng thái này."/>}
    </AdminSection>

    <AdminSection id="thao-luan" number="03" title="Quản lý thảo luận">
      {comments.length ? comments.map((comment) => <article className="admin-row" key={comment.id}><div><small>{comment.author.name} · {date(comment.createdAt)} · <Link href={`/bai-toan/${comment.problem.id}#thao-luan`}>{comment.problem.title}</Link></small><MathContent content={comment.content}/></div><button className={`outline-button ${comment.status === 'hidden' ? '' : 'danger'}`} disabled={busy === `comment-${comment.id}`} onClick={() => void mutate(`comment-${comment.id}`, `/api/v1/moderation/comments/${comment.id}/visibility`, { hidden: comment.status !== 'hidden' }, comment.status === 'hidden' ? 'Đã hiện lại bình luận.' : 'Đã ẩn bình luận.')}>{comment.status === 'hidden' ? 'Hiện lại' : 'Ẩn bình luận'}</button></article>) : <Empty text="Chưa có bình luận nào."/>}
    </AdminSection>

    <AdminSection id="bao-cao" number="04" title="Báo cáo nội dung">
      {reports.length ? reports.map((report) => <article className="admin-row" key={report.id}><div><div className="moderation-meta"><Status value={report.status}/><span>{report.reason}</span><time>{date(report.createdAt)}</time></div><strong>{report.comment.problem.title}</strong><MathContent content={report.comment.content}/><small>Báo cáo bởi {report.reporter.name}{report.details ? ` · ${report.details}` : ''}</small></div><div className="moderation-actions">{report.status === 'pending' ? <><button className="ink-button" disabled={busy === `report-${report.id}`} onClick={() => void mutate(`report-${report.id}`, `/api/v1/moderation/reports/${report.id}`, { status: 'reviewed', hideComment: true }, 'Đã ẩn bình luận và xử lý báo cáo.')}>Ẩn &amp; xử lý</button><button className="outline-button" disabled={busy === `report-${report.id}`} onClick={() => void mutate(`report-${report.id}`, `/api/v1/moderation/reports/${report.id}`, { status: 'dismissed', hideComment: false }, 'Đã bỏ qua báo cáo.')}>Bỏ qua</button></> : <small>{report.reviewer ? `Xử lý bởi ${report.reviewer.name}` : 'Đã xử lý'}</small>}</div></article>) : <Empty text="Chưa có báo cáo nào."/>}
    </AdminSection>

    <AdminSection id="nhat-ky" number="05" title="Nhật ký kiểm duyệt">
      {audits.length ? audits.map((audit) => <article className="admin-row audit-row" key={audit.id}><div><strong>{actionLabel(audit.action)}</strong><p>{audit.targetType} #{audit.targetId}</p></div><small>{audit.actor?.name || 'Tài khoản đã xóa'} · {date(audit.createdAt)}</small></article>) : <Empty text="Chưa có hành động kiểm duyệt nào."/>}
    </AdminSection>
    </WorkspaceTabs>
  </div>;
}

function ReviewActions({ kind, currentStatus, busy, onReview }: {
  kind: 'problem' | 'solution';
  currentStatus: string;
  busy: boolean;
  onReview: (status: string, note: string) => Promise<boolean>;
}) {
  const [decision, setDecision] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  function choose(status: string) {
    setDecision(status);
    setNote('');
    setError('');
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision) return;
    if (decision === 'rejected' && !note.trim()) {
      setError('Vui lòng nhập lý do từ chối.');
      return;
    }
    if (await onReview(decision, note)) setDecision(null);
    else setError('Không thể lưu quyết định. Xem thông báo phía trên.');
  }

  return <>
    <button type="button" disabled={busy} className="ink-button" onClick={() => choose(kind === 'problem' ? 'published' : 'verified')}>{kind === 'problem' ? 'Xuất bản' : 'Kiểm chứng'}</button>
    <button type="button" disabled={busy} className="outline-button danger" onClick={() => choose('rejected')}>Từ chối</button>
    {kind === 'problem' && currentStatus !== 'pending' && <button type="button" disabled={busy} className="plain-button" onClick={() => choose('pending')}>Đưa về chờ duyệt</button>}
    {decision && <form className="review-form" onSubmit={(event) => void submit(event)}>
      <label>{decision === 'rejected' ? 'Lý do từ chối' : 'Ghi chú kiểm duyệt (không bắt buộc)'}
        <textarea value={note} onChange={(event) => { setNote(event.target.value); setError(''); }} maxLength={500} required={decision === 'rejected'} rows={4} />
      </label>
      {error && <p className="review-error" role="alert">{error}</p>}
      <button type="submit" className="ink-button" disabled={busy}>{busy ? 'Đang lưu…' : 'Xác nhận'}</button>
      <button type="button" className="plain-button" disabled={busy} onClick={() => setDecision(null)}>Hủy</button>
    </form>}
  </>;
}

function AdminSection({ id, number, title, controls, children }: { id: string; number: string; title: string; controls?: React.ReactNode; children: React.ReactNode }) { return <section className="admin-section page-shell" id={id}><header><span>{number}</span><h2>{title}</h2>{controls && <label>Trạng thái {controls}</label>}</header><div>{children}</div></section>; }
function Stat({ number, label }: { number: number; label: string }) { return <article><strong>{number.toLocaleString('vi-VN')}</strong><span>{label}</span></article>; }
function Status({ value }: { value: string }) { return <span className={`status-chip status-${value}`}>{statusLabel(value)}</span>; }
function Empty({ text }: { text: string }) { return <p className="admin-empty">{text}</p>; }
function date(value: string) { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function roleLabel(value: string) { return value === 'admin' ? 'Admin' : 'Điều hành viên'; }
function statusLabel(value: string) { return ({ pending: 'Chờ duyệt', published: 'Đã xuất bản', rejected: 'Đã từ chối', verified: 'Đã kiểm chứng', hidden: 'Đã ẩn', visible: 'Hiển thị', reviewed: 'Đã xử lý', dismissed: 'Bỏ qua' } as Record<string, string>)[value] || value; }
function actionLabel(value: string) { return ({ 'problem.review': 'Kiểm duyệt bài viết', 'solution.review': 'Kiểm duyệt lời giải', 'solution.feature': 'Đánh dấu lời giải nổi bật', 'comment.hide': 'Ẩn bình luận', 'comment.restore': 'Hiện lại bình luận', 'comment-report.resolve': 'Xử lý báo cáo' } as Record<string, string>)[value] || value; }
