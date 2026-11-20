'use client';

import Link from 'next/link';
import { WorkspaceTabs } from './workspace-tabs';
import { MathContent } from './math-content';
import { summarizeProblemBody } from '@/lib/problem-summary';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

type User = { id: string; username: string; name: string; email: string; role: string; status: string; emailVerified: boolean };
type Problem = { id: string; slug: string; title: string; body: string; difficulty: string; status: string; publishedAt: string | null; createdAt: string; updatedAt: string; categories: Array<{ name: string; slug: string }>; commentCount: number };
type SavedProblem = Omit<Problem, 'status' | 'createdAt' | 'updatedAt' | 'commentCount'> & { savedAt: string; author: { name: string; username: string } };
type Solution = { id: string; problemId: string; content: string; status: string; edited: boolean; reviewNote: string | null; createdAt: string; updatedAt: string; problem: { id: string; slug: string; title: string; status: string } };
type Notification = { id: string; type: string; message: string; read: boolean; createdAt: string; problem: { id: string; title: string }; actor: { id: string; name: string } | null };
type ProfileData = { user: User; problems: Problem[]; solutions: Solution[]; bookmarks: SavedProblem[]; follows: SavedProblem[]; notifications: Notification[]; unreadCount: number };

export function ProfileDashboard() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const sessionResponse = await fetch('/api/v1/auth/me', { credentials: 'include' });
      if (sessionResponse.status === 401) { router.replace('/dang-nhap?return=/ho-so'); return; }
      const session = await readResponse<{ user: User }>(sessionResponse);
      const [problems, solutions, bookmarks, follows, notifications] = await Promise.all([
        request<{ problems: Problem[] }>('/api/v1/problems/mine?page=1&limit=50'),
        request<{ solutions: Solution[] }>('/api/v1/solutions/mine?page=1&limit=100'),
        request<{ bookmarks: SavedProblem[] }>('/api/v1/bookmarks'),
        request<{ follows: SavedProblem[] }>('/api/v1/follows'),
        request<{ notifications: Notification[]; unreadCount: number }>('/api/v1/notifications'),
      ]);
      setData({ user: session.user, problems: problems.problems, solutions: solutions.solutions, bookmarks: bookmarks.bookmarks, follows: follows.follows, notifications: notifications.notifications, unreadCount: notifications.unreadCount });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải hồ sơ.');
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function removeSaved(kind: 'bookmark' | 'follow', problemId: string) {
    setBusy(`${kind}-${problemId}`);
    setError('');
    try {
      const path = kind === 'bookmark' ? `/api/v1/bookmarks/${problemId}` : `/api/v1/follows/problems/${problemId}`;
      await request(path, { method: 'DELETE' });
      setData((current) => current ? { ...current, [kind === 'bookmark' ? 'bookmarks' : 'follows']: current[kind === 'bookmark' ? 'bookmarks' : 'follows'].filter((problem) => problem.id !== problemId) } : current);
      window.dispatchEvent(new Event('auth-changed'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật hồ sơ.');
    } finally { setBusy(''); }
  }

  async function markNotificationsRead() {
    setBusy('notifications');
    try {
      await request('/api/v1/notifications/read', { method: 'PATCH' });
      setData((current) => current ? { ...current, unreadCount: 0, notifications: current.notifications.map((item) => ({ ...item, read: true })) } : current);
      window.dispatchEvent(new Event('auth-changed'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đánh dấu thông báo.');
    } finally { setBusy(''); }
  }

  async function logoutEverywhere() {
    if (!window.confirm('Đăng xuất tài khoản trên tất cả thiết bị?')) return;
    setBusy('logout-all');
    try {
      await request('/api/v1/auth/logout-all', { method: 'POST' });
      window.dispatchEvent(new Event('auth-changed'));
      router.replace('/dang-nhap');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng xuất tất cả thiết bị.');
      setBusy('');
    }
  }

  if (!data && !error) return <ProfileLoading />;
  if (!data) return <div className="profile-error"><h1>Chưa tải được hồ sơ</h1><p>{error}</p><button className="outline-button" type="button" onClick={load}>Thử lại</button></div>;

  return <>
    <header className="profile-hero">
      <div className="profile-identity"><span className="profile-avatar" aria-hidden="true">{data.user.name.slice(0, 1).toUpperCase()}</span><div><span className="eyebrow">Hồ sơ cá nhân</span><h1>{data.user.name}</h1><p>@{data.user.username} · {roleLabel(data.user.role)} · {data.user.email}</p></div></div>
      <Link className="ink-button" href="/soan-bai">+ Soạn bài</Link>
    </header>

    {error && <p className="profile-inline-error" role="alert">{error}</p>}
    <WorkspaceTabs className="profile-workspace" initialTab="da-luu" syncHash tabs={[{id:"da-luu",label:"Đã lưu ("+data.bookmarks.length+")"},{id:"bai-dang",label:"Bài đăng ("+data.problems.length+")"},{id:"loi-giai",label:"Lời giải ("+data.solutions.length+")"},{id:"dang-theo-doi",label:"Theo dõi ("+data.follows.length+")"},{id:"thong-bao",label:"Thông báo ("+data.unreadCount+")"},{id:"bao-mat",label:"Phiên đăng nhập"}]}><ProfileSection id="bai-dang" number="01" title="Bài viết của tôi" note={`${data.problems.length} bài`}>
      {data.problems.length ? <div className="profile-card-grid">{data.problems.map((problem) => <article className="profile-content-card" key={problem.id}><div><Status value={problem.status} /><span>{problem.difficulty}</span></div><h3>{problem.status === 'published' ? <Link href={`/bai-toan/${problem.slug}`}>{problem.title}</Link> : problem.title}</h3><MathContent content={summarizeProblemBody(problem.body, 150)} />{problem.status !== 'published' && <Link className="profile-edit-link" href={`/soan-bai?id=${problem.id}`}>Sửa bài →</Link>}<footer><span>{problem.categories.map((category) => category.name).join(' · ') || 'Chưa phân loại'}</span><time>{formatDate(problem.updatedAt)}</time></footer></article>)}</div> : <Empty copy="Bạn chưa đăng bài viết nào." action="/soan-bai" actionLabel="Soạn bài đầu tiên" />}
    </ProfileSection>

    <ProfileSection id="loi-giai" number="02" title="Lời giải của tôi" note={`${data.solutions.length} lời giải`}>
      {data.solutions.length ? <div className="profile-list">{data.solutions.map((solution) => <article className="profile-list-row" key={solution.id}><div><Status value={solution.status} /><time>{formatDate(solution.updatedAt)}</time></div><h3><Link href={`/bai-toan/${solution.problem.slug}#loi-giai`}>{solution.problem.title}</Link></h3><MathContent content={summarizeProblemBody(solution.content, 210)} />{solution.reviewNote && <small>Ghi chú kiểm duyệt: {solution.reviewNote}</small>}</article>)}</div> : <Empty copy="Bạn chưa gửi lời giải nào." action="/bai-toan" actionLabel="Chọn một bài toán" />}
    </ProfileSection>

    <ProfileSection id="da-luu" number="03" title="Đã lưu để đọc" note={`${data.bookmarks.length} bài`}>
      <SavedList items={data.bookmarks} empty="Chưa có bài toán nào được lưu." actionLabel="Bỏ lưu" busy={busy} onRemove={(id) => removeSaved('bookmark', id)} />
    </ProfileSection>

    <ProfileSection id="dang-theo-doi" number="04" title="Đang theo dõi" note={`${data.follows.length} bài`}>
      <SavedList items={data.follows} empty="Bạn chưa theo dõi bài toán nào." actionLabel="Bỏ theo dõi" busy={busy} onRemove={(id) => removeSaved('follow', id)} />
    </ProfileSection>

    <ProfileSection id="thong-bao" number="05" title="Thông báo" note={`${data.unreadCount} chưa đọc`} action={data.unreadCount ? <button className="outline-button" type="button" disabled={busy === 'notifications'} onClick={markNotificationsRead}>Đánh dấu đã đọc</button> : undefined}>
      {data.notifications.length ? <div className="notification-list">{data.notifications.map((notification) => <Link className={notification.read ? 'read' : 'unread'} href={`/bai-toan/${notification.problem.id}#thao-luan`} key={notification.id}><span aria-hidden="true">{notification.read ? '○' : '●'}</span><div><strong>{notification.message}</strong><small>{notification.actor ? `${notification.actor.name} · ` : ''}{formatDateTime(notification.createdAt)}</small></div><b>→</b></Link>)}</div> : <Empty copy="Bạn chưa có thông báo nào." />}
    </ProfileSection>

    <section id="bao-mat" className="profile-security"><div><span className="eyebrow">Bảo mật</span><h2>Phiên đăng nhập</h2><p>Nếu bạn nghi ngờ tài khoản đang mở ở thiết bị khác, hãy thu hồi toàn bộ phiên hiện tại.</p></div><button className="outline-button danger" type="button" disabled={busy === 'logout-all'} onClick={logoutEverywhere}>Đăng xuất mọi thiết bị</button></section>
    </WorkspaceTabs>
  </>;
}

function ProfileSection({ id, number, title, note, action, children }: { id: string; number: string; title: string; note: string; action?: ReactNode; children: ReactNode }) { return <section className="profile-section" id={id}><header><span>{number}</span><div><h2>{title}</h2><small>{note}</small></div>{action}</header>{children}</section>; }
function Status({ value }: { value: string }) { return <span className={`profile-status status-${value}`}>{statusLabel(value)}</span>; }
function SavedList({ items, empty, actionLabel, busy, onRemove }: { items: SavedProblem[]; empty: string; actionLabel: string; busy: string; onRemove: (id: string) => void }) { return items.length ? <div className="saved-problem-list">{items.map((problem) => <article key={problem.id}><div><span className="rubric">{problem.categories.map((category) => category.name).join(' · ') || 'Bài toán'}</span><h3><Link href={`/bai-toan/${problem.slug}`}>{problem.title}</Link></h3><MathContent content={summarizeProblemBody(problem.body, 160)} /><small>Bởi {problem.author.name} · Lưu {formatDate(problem.savedAt)}</small></div><button type="button" disabled={busy.endsWith(problem.id)} onClick={() => onRemove(problem.id)}>{actionLabel}</button></article>)}</div> : <Empty copy={empty} action="/bai-toan" actionLabel="Khám phá kho bài" />; }
function Empty({ copy, action, actionLabel }: { copy: string; action?: string; actionLabel?: string }) { return <div className="profile-empty"><span aria-hidden="true">∅</span><p>{copy}</p>{action && <Link className="outline-button" href={action}>{actionLabel} →</Link>}</div>; }
function ProfileLoading() { return <div className="profile-loading" aria-live="polite"><span></span><p>Đang tải hồ sơ…</p></div>; }
async function request<T = unknown>(path: string, init?: RequestInit): Promise<T> { return readResponse<T>(await fetch(path, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } })); }
async function readResponse<T>(response: Response): Promise<T> { const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message || 'Không thể kết nối tới máy chủ.'); return result as T; }
function statusLabel(value: string) { return ({ draft: 'Bản nháp', pending: 'Chờ duyệt', published: 'Đã xuất bản', rejected: 'Từ chối', verified: 'Đã kiểm chứng', withdrawn: 'Đã rút' } as Record<string, string>)[value] ?? value; }
function roleLabel(value: string) { return ({ reader: 'Reader', editor: 'Biên tập viên', moderator: 'Điều hành viên', admin: 'Admin' } as Record<string, string>)[value] ?? value; }
function formatDate(value: string) { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
