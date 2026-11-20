'use client';

import { useEffect, useRef, useState } from 'react';


export type LatexFileSummary = { id: string; path: string; mimeType: string; sizeBytes: number; updatedAt: string };
export type LatexProjectData = { id: string; title: string; compiler: 'pdflatex' | 'xelatex' | 'lualatex'; updatedAt: string; mainFile: { id: string; path: string; content: string }; files: LatexFileSummary[] };

export function LatexProjectFiles({ project, mainSource, onMainEdit, beforeChange, onRefresh, registerFlush }: {
  project: LatexProjectData;
  mainSource: string;
  onMainEdit: (source: string) => void;
  beforeChange: () => Promise<boolean>;
  onRefresh: (project: LatexProjectData) => void;
  registerFlush: (flush: (() => Promise<boolean>) | null) => void;
}) {
  const fileDialog = useRef<HTMLDialogElement>(null);
  const [fileAction,setFileAction] = useState<'create' | 'upload'>('create');
  const [selectedId, setSelectedId] = useState(project.mainFile.id);
  const [source, setSource] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newPath, setNewPath] = useState('');
  const [uploadPath, setUploadPath] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const latest = useRef({ selectedId, source, dirty });
  const lineNumbers = useRef<HTMLPreElement>(null);
  const pending = useRef<Promise<boolean> | null>(null);
  const selected = project.files.find((item) => item.id === selectedId) || project.files[0];
  const isMain = selected?.id === project.mainFile.id;
  const isText = Boolean(selected?.mimeType.startsWith('text/'));
  const base = `/api/v1/latex/projects/${project.id}`;

  latest.current = { selectedId, source, dirty };

  async function flush(): Promise<boolean> {
    if (pending.current) await pending.current;
    const snapshot = latest.current;
    if (!snapshot.dirty || snapshot.selectedId === project.mainFile.id) return true;
    const operation = (async () => {
      try {
        await json(`${base}/files/${snapshot.selectedId}`, 'PUT', { content: snapshot.source });
        if (latest.current.selectedId === snapshot.selectedId && latest.current.source === snapshot.source) {
          latest.current.dirty = false;
          setDirty(false);
        }
        return true;
      } catch (cause) { setError(`Chưa lưu được tệp: ${text(cause)}`); return false; }
    })();
    pending.current = operation;
    try { return await operation; }
    finally { if (pending.current === operation) pending.current = null; }
  }

  useEffect(() => { registerFlush(flush); return () => registerFlush(null); });
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => { void flush(); }, 800);
    return () => clearTimeout(timer);
  }, [dirty, source, selectedId]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || pending.current) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function select(file: LatexFileSummary) {
    if (file.id === selectedId) return;
    setBusy(true); setError(''); setConfirmDelete(false);
    try {
      if (!await flush()) return;
      let content = '';
      if (file.id !== project.mainFile.id && file.mimeType.startsWith('text/')) {
        const response = await fetch(`${base}/files/${file.id}/raw`, { credentials: 'include' });
        if (!response.ok) throw new Error(`Không đọc được tệp (${response.status}).`);
        content = await response.text();
      }
      latest.current = { selectedId: file.id, source: content, dirty: false };
      setSelectedId(file.id); setSource(content); setDirty(false);
    } catch (cause) { setError(text(cause)); }
    finally { setBusy(false); }
  }

  async function addText() {
    if (!newPath.trim()) { setError('Nhập đường dẫn tệp, ví dụ chapters/intro.tex.'); return; }
    setBusy(true); setError('');
    try {
      if (!await flush() || !await beforeChange()) return;
      const { project: updated } = await json<{ project: LatexProjectData }>(`${base}/files`, 'POST', { path: newPath.trim(), content: '' });
      onRefresh(updated);
      const file = updated.files.find((item) => item.path === newPath.trim());
      if (file) { latest.current = { selectedId: file.id, source: '', dirty: false }; setSelectedId(file.id); setSource(''); setDirty(false); }
      setNewPath('');
    } catch (cause) { setError(text(cause)); }
    finally { setBusy(false); }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError('');
    try {
      if (!await flush() || !await beforeChange()) return;
      const body = new FormData();
      body.set('path', uploadPath.trim() || file.name);
      body.set('file', file);
      const response = await fetch(`${base}/files/upload`, { method: 'POST', credentials: 'include', body });
      const result = await response.json();
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message || `HTTP ${response.status}`);
      onRefresh(result.project);
      setUploadPath('');
    } catch (cause) { setError(text(cause)); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!selected || isMain) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true); setError('');
    try {
      if (!await flush()) return;
      const { project: updated } = await json<{ project: LatexProjectData }>(`${base}/files/${selected.id}`, 'DELETE');
      onRefresh(updated);
      latest.current = { selectedId: updated.mainFile.id, source: '', dirty: false };
      setSelectedId(updated.mainFile.id); setSource(''); setDirty(false); setConfirmDelete(false);
    } catch (cause) { setError(text(cause)); }
    finally { setBusy(false); }
  }

  return <div className="latex-project-files">
    <aside className="latex-files-sidebar"><header><strong>Tệp dự án</strong><button type="button" onClick={() => fileDialog.current?.showModal()}>+ Thêm</button></header><nav aria-label="Tệp dự án">{project.files.map((file) => <button title={file.path} key={file.id} type="button" className={file.id===selected?.id?'active':''} aria-pressed={file.id===selected?.id} onClick={() => void select(file)} disabled={busy}><span>{file.path}</span><small>{formatBytes(file.sizeBytes)}</small></button>)}</nav><button className="workbench-add-mobile" type="button" onClick={() => fileDialog.current?.showModal()}>Thêm tệp</button></aside>
    <div className="latex-file-editor"><div className="latex-filebar"><details className="workbench-mobile-files"><summary>Tệp ▾</summary><nav>{project.files.map((file)=><button type="button" key={file.id} onClick={(event)=>{void select(file);const menu=event.currentTarget.closest("details");if(menu)menu.open=false;}}>{file.path}</button>)}<button type="button" onClick={()=>fileDialog.current?.showModal()}>+ Thêm tệp</button></nav></details><strong>{selected?.path || 'main.tex'}</strong><span>{isMain ? 'Tự lưu' : dirty ? 'Đang lưu…' : 'Đã lưu'}</span>{!isMain && <><a href={`${base}/files/${selected.id}/raw`}>Tải tệp ↓</a><button type="button" className="danger-text" disabled={busy} onClick={() => void remove()}>{confirmDelete ? 'Xác nhận xóa' : 'Xóa tệp'}</button></>}</div>
      {error && <p className="latex-error" role="alert">{error}</p>}
      {isText ? <div className="latex-code-shell"><pre ref={lineNumbers} className="latex-line-numbers" aria-hidden="true">{Array.from({ length: Math.max(1, (isMain ? mainSource : source).split('\n').length) }, (_, index) => index + 1).join('\n')}</pre><textarea className="latex-code" wrap="off" spellCheck={false} value={isMain ? mainSource : source} onScroll={(event) => { if (lineNumbers.current) lineNumbers.current.scrollTop = event.currentTarget.scrollTop; }} onChange={(event) => isMain ? onMainEdit(event.target.value) : (latest.current = { selectedId, source: event.target.value, dirty: true }, setSource(event.target.value), setDirty(true))} disabled={busy}/></div> : selected?.mimeType.startsWith('image/') ? <div className="latex-asset-preview"><img src={`${base}/files/${selected.id}/raw`} alt={selected.path}/></div> : <div className="latex-asset-preview"><p>Tệp {selected?.path} được dùng khi biên dịch.</p><a href={`${base}/files/${selected?.id}/raw`}>Tải tệp xuống</a></div>}
    </div>
    <dialog ref={fileDialog} className="workbench-dialog"><header><h2>{fileAction==='create'?'Tạo tệp':'Tải tệp lên'}</h2><button type="button" onClick={()=>fileDialog.current?.close()} aria-label="Đóng thêm tệp">✕</button></header><div className="workbench-form-switch"><button type="button" aria-pressed={fileAction==='create'} onClick={()=>setFileAction('create')}>Tạo tệp</button><button type="button" aria-pressed={fileAction==='upload'} onClick={()=>setFileAction('upload')}>Tải tệp lên</button></div>{fileAction==='create'?<><label>Đường dẫn tệp<input value={newPath} onChange={(event)=>setNewPath(event.target.value)} placeholder="chapters/intro.tex" /></label><button className="ink-button" type="button" disabled={busy} onClick={()=>void addText()}>Tạo tệp</button></>:<><label>Đường dẫn đích (không bắt buộc)<input value={uploadPath} onChange={(event)=>setUploadPath(event.target.value)} placeholder="images/hinh-1.png" /></label><label className="workbench-upload">Chọn tệp tải lên<input type="file" onChange={(event)=>{void upload(event.target.files?.[0]);event.target.value='';}} accept=".tex,.bib,.sty,.cls,.bst,.bbx,.cbx,.def,.cfg,.txt,.png,.jpg,.jpeg,.pdf,.eps" /></label></>}{error&&<p role="alert">{error}</p>}</dialog>
  </div>;
}

async function json<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method, credentials: 'include', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message || `HTTP ${response.status}`);
  return result as T;
}
function text(cause: unknown) { return cause instanceof Error ? cause.message : 'Không thể kết nối máy chủ.'; }
function formatBytes(value: number) { return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(0)} KB`; }
