'use client';

import { useEffect, useState } from 'react';

type Build = {
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

export function LatexBuildPanel({ projectId, flush }: { projectId: string; flush: () => Promise<boolean> }) {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [selected, setSelected] = useState<Build | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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

  return <section className="latex-build-panel" aria-label="Biên dịch tài liệu LaTeX">
    <header><div><strong>Biên dịch tài liệu</strong><p>Chạy toàn bộ <code>main.tex</code> bằng TeX Live để tạo PDF, gồm tiêu đề, mục, công thức và bố cục bài viết.</p></div><button className="ink-button" type="button" disabled={busy || selected?.status === 'queued' || selected?.status === 'compiling'} onClick={() => void compile()}>{busy ? 'Đang gửi…' : 'Biên dịch PDF →'}</button></header>
    {error && <p className="latex-error" role="alert">{error}</p>}
    {builds.length > 0 && <div className="latex-build-history" aria-label="Các lần biên dịch">{builds.map((build) => <button className={selected?.id === build.id ? 'active' : ''} key={build.id} type="button" onClick={() => void select(build.id)}>#{build.id} · {build.compiler} · {labels[build.status]}</button>)}</div>}
    {selected && <div className="latex-build-result"><p role="status"><strong>{labels[selected.status]}</strong> · {new Date(selected.createdAt).toLocaleString('vi-VN')}{selected.errorMessage ? ` · ${selected.errorMessage}` : ''}</p>
      {selected.pdfUrl && <><div className="latex-pdf-actions"><a href={selected.pdfUrl} target="_blank" rel="noreferrer">Mở PDF ↗</a><a href={selected.pdfUrl} download={`latex-${selected.id}.pdf`}>Tải PDF ↓</a></div><iframe title="Bản PDF đã biên dịch" src={selected.pdfUrl}/></>}
      {selected.log && <details><summary>Xem nhật ký biên dịch</summary><pre>{selected.log}</pre></details>}
    </div>}
  </section>;
}

async function request<T>(url: string, method = 'GET'): Promise<T> {
  const response = await fetch(url, { method, credentials: 'include', cache: 'no-store' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message || `HTTP ${response.status}`);
  return result as T;
}
function text(cause: unknown) { return cause instanceof Error ? cause.message : 'Không thể kết nối máy chủ.'; }
