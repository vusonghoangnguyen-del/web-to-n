'use client';
import { WorkspaceTabs } from './workspace-tabs';
import Link from 'next/link';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Suspense } from 'react';
import { LatexBuildPanel, type Build, type BuildCommands } from './latex-build-panel';
import { LatexProjectFiles, LatexProjectData } from './latex-project-files';
import { ProblemEditor } from './problem-editor';

type Compiler = 'pdflatex' | 'xelatex' | 'lualatex';
type User = { id: string; name: string };
type Summary = { id: string; title: string; compiler: Compiler; updatedAt: string };
type Project = LatexProjectData;
type LocalDraft = { id: string; title: string; compiler: Compiler; source: string };

const endpoint = '/api/v1/latex/projects';
const starter = String.raw`\documentclass[12pt]{article}
\usepackage{fontspec}
\setmainfont{TeX Gyre Termes}
\usepackage{amsmath,amssymb}
\title{Bản thảo toán học}
\author{Tờ Toán}
\begin{document}
\maketitle
\section{Giới thiệu}
Viết bài báo toán học của bạn ở đây.
\section{Một công thức}
Ta có công thức \[ e^{i\pi}+1=0. \]
\end{document}
`;

export function LatexWorkspace() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Summary[]>([]);
  const [active, setActive] = useState<Project | null>(null);
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const buildCommands = useRef<BuildCommands>(null);
  const [buildBusy, setBuildBusy] = useState(false);
  const [selectedBuild, setSelectedBuild] = useState<Build | null>(null);
  const [submission, setSubmission] = useState<{ projectId: string; buildId: string } | null>(null);
  const current = useRef<Project | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const saving = useRef(new Map<string, Promise<void>>());
  const auxFlush = useRef<(() => Promise<boolean>) | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await api<{ user: User }>('/api/v1/auth/me');
        if (!mounted) return;
        setUser(me.user);
        const list = await api<{ projects: Summary[] }>(endpoint);
        if (!mounted) return;
        setProjects(list.projects);
        if (list.projects[0]) {
          const detail = await api<{ project: Project }>(`${endpoint}/${list.projects[0].id}`);
          if (mounted) { current.current = detail.project; setActive(detail.project); }
        }
        const local = readLocalArray(`to-toan:latex-projects:${me.user.id}`);
        const ids = new Set(readLocalArray(`to-toan:latex-imported:${me.user.id}`));
        if (mounted) setDrafts(local.filter((item): item is LocalDraft => isDraft(item) && !ids.has(item.id)));
      } catch (cause) {
        if (mounted && cause instanceof ApiError && cause.status === 401) router.replace('/dang-nhap?return=/latex');
        else if (mounted) setError(message(cause));
      } finally { if (mounted) setReady(true); }
    })();
    return () => { mounted = false; };
  }, [router]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || timers.current.size || saving.current.size) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function select(id: string) {
    if (current.current?.id === id) return;
    setBusy(true); setError(''); setDeleteId('');
    try {
      if (!await flushAll()) return;
      const result = await api<{ project: Project }>(`${endpoint}/${id}`);
      current.current = result.project; setActive(result.project); setDirty(timers.current.has(id) || saving.current.has(id)); setSubmission(null);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  async function create(title = `Dự án ${projects.length + 1}`, compiler: Compiler = 'xelatex', source = starter) {
    setBusy(true); setError('');
    try {
      if (!await flushAll()) return null;
      const { project } = await api<{ project: Project }>(endpoint, 'POST', { title, compiler, source });
      setProjects((items) => [project, ...items]);
      current.current = project; setActive(project); setDirty(false); setDeleteId('');
      return project;
    } catch (cause) { setError(message(cause)); return null; }
    finally { setBusy(false); }
  }

  function edit(change: { title?: string; compiler?: Compiler; source?: string }) {
    const old = current.current;
    if (!old) return;
    const next: Project = {
      ...old, title: change.title ?? old.title, compiler: change.compiler ?? old.compiler,
      mainFile: change.source === undefined ? old.mainFile : { ...old.mainFile, content: change.source },
      updatedAt: new Date().toISOString(),
    };
    current.current = next; setActive(next); setDirty(true); setError('');
    setProjects((items) => items.map((item) => item.id === next.id ? { id: next.id, title: next.title, compiler: next.compiler, updatedAt: next.updatedAt } : item));
    const timer = timers.current.get(next.id);
    if (timer) clearTimeout(timer);
    timers.current.set(next.id, setTimeout(() => { timers.current.delete(next.id); void save(next); }, 600));
  }

  async function flushCurrent(): Promise<boolean> {
    const snapshot = current.current;
    if (!snapshot) return true;
    const timer = timers.current.get(snapshot.id);
    if (timer) { clearTimeout(timer); timers.current.delete(snapshot.id); }
    if (timer || dirty) return save(snapshot);
    try { await saving.current.get(snapshot.id); return true; }
    catch (cause) { setError(`Chưa lưu được: ${message(cause)}`); return false; }
  }

  async function flushAll(): Promise<boolean> {
    if (auxFlush.current && !await auxFlush.current()) return false;
    return flushCurrent();
  }

  function refresh(project: Project) {
    current.current = project;
    setActive(project);
    setProjects((items) => items.map((item) => item.id === project.id ? project : item));
  }

  async function importZip(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError('');
    try {
      if (!await flushAll()) return;
      const body = new FormData();
      body.set('file', file);
      const response = await fetch(`${endpoint}/import-zip`, { method: 'POST', credentials: 'include', body });
      const result = await response.json();
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message || `HTTP ${response.status}`);
      const project: Project = result.project;
      setProjects((items) => [project, ...items]);
      current.current = project; setActive(project); setDirty(false); setDeleteId('');
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  async function save(snapshot: Project): Promise<boolean> {
    const previous = saving.current.get(snapshot.id) ?? Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      if (!snapshot.title.trim()) throw new Error('Tên dự án không được để trống.');
      await api(`${endpoint}/${snapshot.id}`, 'PATCH', { title: snapshot.title, compiler: snapshot.compiler });
      await api(`${endpoint}/${snapshot.id}/files/${snapshot.mainFile.id}`, 'PUT', { content: snapshot.mainFile.content });
    });
    saving.current.set(snapshot.id, operation);
    try {
      await operation;
      if (current.current?.id === snapshot.id && current.current.title === snapshot.title && current.current.compiler === snapshot.compiler && current.current.mainFile.content === snapshot.mainFile.content && !timers.current.has(snapshot.id)) setDirty(false);
      return true;
    } catch (cause) { if (current.current?.id === snapshot.id) setError(`Chưa lưu được: ${message(cause)}`); return false; }
    finally { if (saving.current.get(snapshot.id) === operation) saving.current.delete(snapshot.id); }
  }

  async function remove() {
    if (!active) return;
    if (deleteId !== active.id) { setDeleteId(active.id); return; }
    setBusy(true); setError('');
    try {
      const timer = timers.current.get(active.id);
      if (timer) { clearTimeout(timer); timers.current.delete(active.id); }
      await saving.current.get(active.id)?.catch(() => {});
      await api(`${endpoint}/${active.id}`, 'DELETE');
      const remaining = projects.filter((item) => item.id !== active.id);
      setProjects(remaining); current.current = null; setActive(null); setDirty(false); setDeleteId('');
      if (remaining[0]) await select(remaining[0].id);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  async function importLocal() {
    if (!user) return;
    setBusy(true); setError('');
    const key = `to-toan:latex-imported:${user.id}`;
    const imported = new Set(readLocalArray(key).filter((id): id is string => typeof id === 'string'));
    try {
      for (const draft of drafts) {
        const project = await create(draft.title.slice(0, 120) || 'Dự án LaTeX', draft.compiler, draft.source);
        if (!project) break;
        imported.add(draft.id); localStorage.setItem(key, JSON.stringify([...imported]));
        setDrafts((items) => items.filter((item) => item.id !== draft.id));
      }
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  function download() {
    if (!active) return;
    const url = URL.createObjectURL(new Blob([active.mainFile.content], { type: 'application/x-tex;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${fileName(active.title)}.tex`; anchor.click(); URL.revokeObjectURL(url);
  }

  async function downloadZip() {
    const project = current.current;
    if (!project || !await flushAll()) return;
    try {
      const response = await fetch(`${endpoint}/${project.id}/export`, { credentials: 'include' });
      if (!response.ok) throw new Error(`Không tải được ZIP (${response.status}).`);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${fileName(project.title)}.zip`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) { setError(message(cause)); }
  }

  async function importTex(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_000_000) { setError('Tệp .tex không được vượt quá 1 MB.'); return; }
    try { edit({ source: await file.text() }); }
    catch { setError('Không đọc được tệp .tex.'); }
  }

  async function openSubmission() {
    if (!active) return;
    setError('');
    if (!await flushAll()) { setError('Chưa lưu được bản thảo. Hãy thử lại trước khi gửi bài.'); return; }
    if (selectedBuild) {
      if (selectedBuild.status !== 'success' || !selectedBuild.pdfUrl) { setError('Bản đang xem chưa có PDF thành công.'); return; }
      setSubmission({ projectId: active.id, buildId: selectedBuild.id }); return;
    }
    try {
      const { builds } = await api<{ builds: { id: string; status: string; pdfUrl: string | null }[] }>(`${endpoint}/${active.id}/builds`);
      const latest = builds.find((build) => build.status === 'success' && build.pdfUrl);
      if (!latest) { setError('Hãy biên dịch PDF thành công trước khi gửi bài.'); return; }
      setSubmission({ projectId: active.id, buildId: latest.id });
    } catch (cause) { setError(message(cause)); }
  }

  if (!ready) return <section className="latex-loading"><Link href="/">← Về trang chủ</Link><p>Đang mở không gian LaTeX…</p></section>;
  return <div className="latex-page latex-ide">
    <header className="workbench-header">
      <div className="workbench-identity"><Link className="workbench-home" href="/" onClick={async (event) => { event.preventDefault(); if (await flushAll()) router.push('/'); }}>← Về trang chủ</Link><Link className="workbench-wordmark" href="/" onClick={async (event) => { event.preventDefault(); if (await flushAll()) router.push('/'); }}>TỜ TOÁN</Link></div>
      <div className="workbench-context"><label className="visually-hidden" htmlFor="active-latex-project">Chọn dự án</label><select id="active-latex-project" value={active?.id ?? ''} onChange={(event) => {setSelectedBuild(null);void select(event.target.value);}} disabled={!projects.length}>{!projects.length && <option value="">Chưa có dự án</option>}{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><span role="status">{active ? dirty ? 'Đang lưu…' : 'Đã lưu' : 'Soạn thảo LaTeX'}</span></div>
      <div className="workbench-commands"><details className="workbench-menu" onKeyDown={(event) => {if(event.key === 'Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}><summary>Dự án ▾{drafts.length>0 && ' ('+drafts.length+')'}</summary><div className="workbench-menu-items">
        <button type="button" disabled={busy || !user} onClick={() => void create()}>Dự án mới</button>
        <label>Nhập ZIP<input type="file" accept=".zip,application/zip" onChange={(event) => {void importZip(event.target.files?.[0]);event.target.value='';}} /></label>
        {active && <><button type="button" onClick={() => settingsDialog.current?.showModal()}>Cài đặt dự án</button><label>Nhập main.tex<input type="file" accept=".tex,text/plain" onChange={(event) => {void importTex(event.target.files?.[0]);event.target.value='';}} /></label><button type="button" onClick={download}>Tải .tex</button><button type="button" onClick={() => void downloadZip()}>Tải ZIP</button><button className="danger-text" type="button" disabled={busy} onClick={() => void remove()}>{deleteId === active.id ? 'Xác nhận xóa dự án' : 'Xóa dự án'}</button></>}
        {drafts.length>0 && <button type="button" disabled={busy} onClick={() => void importLocal()}>Nhập bản nháp ({drafts.length})</button>}
      </div></details>
      <button className="ink-button workbench-compile" type="button" disabled={!active || buildBusy || selectedBuild?.status==='queued' || selectedBuild?.status==='compiling'} onClick={() => void buildCommands.current?.compile()}>{buildBusy ? 'Đang gửi…' : selectedBuild?.status==='queued' || selectedBuild?.status==='compiling' ? 'Đang biên dịch…' : 'Biên dịch PDF'}</button>
      <button className="outline-button workbench-submit" type="button" disabled={!active || !selectedBuild?.pdfUrl || selectedBuild.status!=='success'} onClick={() => void openSubmission()}>Gửi PDF duyệt</button>
      </div>
    </header>
    {error && <p className="latex-error workbench-error" role="alert">{error}</p>}
    {active ? <WorkspaceTabs key={active.id} className="latex-workbench-tabs" tabs={[{id:'ma-nguon',label:'Mã nguồn'},{id:'ban-bien-dich',label:'Bản PDF'}]}><div id="ma-nguon"><LatexProjectFiles key={active.id} project={active} mainSource={active.mainFile.content} onMainEdit={(source) => edit({source})} beforeChange={flushCurrent} onRefresh={refresh} registerFlush={(flush) => {auxFlush.current=flush;}} /></div><div id="ban-bien-dich"><LatexBuildPanel key={active.id} projectId={active.id} flush={flushAll} controlsRef={buildCommands} onBusyChange={setBuildBusy} onSelectionChange={setSelectedBuild} onSubmit={(buildId) => setSubmission({projectId:active.id,buildId})} /></div></WorkspaceTabs> : <div className="workbench-empty"><h1>Soạn thảo LaTeX</h1><p>Chưa có dự án. Tạo dự án hoặc nhập tệp ZIP để bắt đầu.</p><button className="ink-button" type="button" disabled={busy || !user} onClick={() => void create()}>Dự án mới</button></div>}
    <dialog ref={settingsDialog} className="workbench-dialog"><header><h2>Cài đặt dự án</h2><button type="button" onClick={() => settingsDialog.current?.close()} aria-label="Đóng cài đặt">✕</button></header>{active && <><label>Tên dự án<input value={active.title} maxLength={120} onChange={(event) => edit({title:event.target.value})} /></label><label>Trình biên dịch<select value={active.compiler} onChange={(event) => edit({compiler:event.target.value as Compiler})}><option value="pdflatex">pdfLaTeX</option><option value="xelatex">XeLaTeX</option><option value="lualatex">LuaLaTeX</option></select></label><p>{dirty ? 'Đang lưu…' : 'Đã lưu'}</p></>}<button className="ink-button" type="button" onClick={() => settingsDialog.current?.close()}>Xong</button></dialog>
    {submission && active?.id === submission.projectId && <div className="latex-submission-overlay"><section className="latex-submission-sheet" role="dialog" aria-modal="true" aria-label="Gửi bài tới tòa soạn"><button className="latex-submission-close" type="button" onClick={() => setSubmission(null)}>← Quay lại bản thảo</button><Suspense fallback={<p>Đang mở biểu mẫu gửi bài…</p>}><ProblemEditor key={submission.projectId+':'+submission.buildId} initialProjectId={submission.projectId} initialBuildId={submission.buildId} initialTitle={active.title}/></Suspense></section></div>}
  </div>;
}

class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }
async function api<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(url, { method, credentials: 'include', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (response.status === 204) return undefined as T;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(Array.isArray(result.message) ? result.message.join(' ') : result.message || `HTTP ${response.status}`, response.status);
  return result as T;
}
function isDraft(value: unknown): value is LocalDraft {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && typeof item.title === 'string' && typeof item.source === 'string' && ['pdflatex', 'xelatex', 'lualatex'].includes(String(item.compiler));
}
function readLocalArray(key: string): unknown[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function message(value: unknown) { return value instanceof Error ? value.message : 'Không thể kết nối máy chủ.'; }
function fileName(value: string) { return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'main'; }
function relative(value: string) { const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000)); return minutes < 1 ? 'vừa xong' : minutes < 60 ? `${minutes} phút trước` : new Intl.DateTimeFormat('vi-VN').format(new Date(value)); }
