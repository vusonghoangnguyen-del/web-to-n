'use client';

import { useEffect, useState, useImperativeHandle, type Ref } from 'react';
import { CleanPdfViewer } from './clean-pdf-viewer';

export type Build = {
  id: string;
  status: 'queued' | 'compiling' | 'success' | 'failed' | 'cancelled';
  compiler: string;
  createdAt: string;
  errorMessage: string | null;
  pdfUrl: string | null;
  log?: string;
};

const labels: Record<Build['status'], string> = {
  queued: 'Đang chờ',
  compiling: 'Đang biên dịch',
  success: 'Thành công',
  failed: 'Thất bại',
  cancelled: 'Đã hủy',
};

export type BuildCommands = { compile: () => Promise<void> };
export function LatexBuildPanel({ projectId, flush, onSubmit, controlsRef, onBusyChange, onSelectionChange }: { projectId: string; flush: () => Promise<boolean>; onSubmit?: (buildId: string) => void; controlsRef?: Ref<BuildCommands>; onBusyChange?: (busy: boolean) => void; onSelectionChange?: (build: Build | null) => void }) {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [selected, setSelected] = useState<Build | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showLog,setShowLog] = useState(false);
  useImperativeHandle(controlsRef, () => ({compile}));
  useEffect(() => {onBusyChange?.(busy);},[busy,onBusyChange]);
  useEffect(() => {onSelectionChange?.(selected);},[selected,onSelectionChange]);
  const base = `/api/v1/latex/projects/${projectId}`;

  useEffect(() => {
    let mounted = true;
    void request<{ builds: Build[] }>(`${base}/builds`).then(({ builds }) => {
      if (!mounted) return;
      setBuilds(builds);
      if (builds[0]) void request<{ build: Build }>(`${base}/builds/${builds[0].id}`).then(({ build }) => { if (mounted) setSelected(build); });
    }).catch((cause) => { if (mounted) setError(text(cause)); });
    return () => { mounted = false; };
  }, [base]);

  useEffect(() => {
    if (!selected || !['queued', 'compiling'].includes(selected.status)) return;
    let mounted = true;
    const timer = setInterval(() => {
      void request<{ build: Build }>(`${base}/builds/${selected.id}`).then(({ build }) => {
        if (!mounted) return;
        setSelected(build);
        setBuilds((items) => items.map((item) => item.id === build.id ? build : item));
      }).catch((cause) => { if (mounted) setError(text(cause)); });
    }, 1500);
    return () => { mounted = false; clearInterval(timer); };
  }, [base, selected?.id, selected?.status]);

  async function compile() {
    setBusy(true); setError('');
    try {
      if (!await flush()) { setError('Chưa lưu được bản thảo. Hãy kiểm tra kết nối rồi thử lại.'); return; }
      const { build } = await request<{ build: Build }>(`${base}/compile`, 'POST');
      setBuilds((items) => [build, ...items]);
      setSelected(build);
    } catch (cause) { setError(text(cause)); }
    finally { setBusy(false); }
  }

  async function select(id: string) {
    setError('');
    try { const { build } = await request<{ build: Build }>(`${base}/builds/${id}`); setSelected(build); }
    catch (cause) { setError(text(cause)); }
  }

  const history = <label className="workbench-build-choice"><span className="visually-hidden">Bản biên dịch</span><select aria-label="Chọn bản biên dịch" value={selected?.id ?? ''} onChange={(event)=>void select(event.target.value)} disabled={!builds.length}>{!builds.length&&<option value="">Chưa có bản biên dịch</option>}{builds.map(build=><option key={build.id} value={build.id}>{new Intl.DateTimeFormat('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}).format(new Date(build.createdAt))} · {labels[build.status]}</option>)}</select></label>;
  const actions = <details className="workbench-menu pdf-menu"><summary aria-label="Thao tác PDF">•••</summary><div className="workbench-menu-items">{selected?.pdfUrl&&<><a href={selected.pdfUrl} target="_blank" rel="noreferrer">Mở PDF ↗</a><a href={selected.pdfUrl} download={'latex-'+selected.id+'.pdf'}>Tải PDF</a>{onSubmit&&<button type="button" onClick={()=>onSubmit(selected.id)}>Gửi PDF duyệt</button>}</>}<button type="button" disabled={!selected?.log} onClick={()=>setShowLog(value=>!value)}>{showLog?'Đóng nhật ký':'Xem nhật ký'}</button></div></details>;
  return <section className="latex-build-panel" aria-label="Bản PDF">
    {selected?.pdfUrl ? <CleanPdfViewer url={selected.pdfUrl} title="Bản PDF" compact heading={history} actions={actions}/> : <><header className="workbench-pdf-header">{history}{actions}</header><div className="workbench-pdf-empty"><h2>{selected ? labels[selected.status] : 'Chưa có bản PDF'}</h2><p>{selected?.errorMessage || (selected?.status==='queued'||selected?.status==='compiling'?'Bản PDF sẽ xuất hiện khi biên dịch hoàn tất.':'Chọn Biên dịch PDF để xem bản in của tài liệu.')}</p></div></>}
    {error&&<p className="latex-error" role="alert">{error}</p>}
    {showLog&&<section className="workbench-build-log"><header><strong>Nhật ký biên dịch</strong><button type="button" onClick={()=>setShowLog(false)}>Đóng</button></header><pre>{selected?.log || 'Chưa có nhật ký.'}</pre></section>}
  </section>;
}

async function request<T>(url: string, method = 'GET'): Promise<T> {
  const response = await fetch(url, { method, credentials: 'include', cache: 'no-store' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message || `HTTP ${response.status}`);
  return result as T;
}
function text(cause: unknown) { return cause instanceof Error ? cause.message : 'Không thể kết nối máy chủ.'; }
