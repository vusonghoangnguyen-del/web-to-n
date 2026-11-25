'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type PdfDocumentLike = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageLike>;
};

type PdfLoadingTaskLike = { promise: Promise<PdfDocumentLike>; destroy: () => Promise<void> };

type PdfPageLike = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    transform?: [number, number, number, number, number, number];
  }) => { promise: Promise<void> };
  cleanup: () => void;
};

export function CleanPdfViewer({ url, title = 'Bản PDF', compact = false, continuous = false, heading, actions }: { url: string; title?: string; compact?: boolean; continuous?: boolean; heading?: ReactNode; actions?: ReactNode }) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [containerWidth,setContainerWidth] = useState(0);
  useEffect(() => {const host=pagesRef.current;if(!host)return;const observer=new ResizeObserver(()=>setContainerWidth(host.clientWidth));observer.observe(host);return ()=>observer.disconnect();},[]);
  const [zoom, setZoom] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [status, setStatus] = useState('Đang mở bản PDF…');

  useEffect(() => {
    const host = pagesRef.current;
    if (!host) return;

    let cancelled = false;
    let loadingTask: PdfLoadingTaskLike | null = null;
    async function render() {
      if (!host || host.clientWidth === 0) return;
      host.replaceChildren();
      setStatus('Đang mở bản PDF…');
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
        loadingTask = pdfjs.getDocument({ url, withCredentials: true }) as unknown as PdfLoadingTaskLike;
        const document = await loadingTask.promise;
        if (cancelled) return;
        setPageCount(document.numPages);

        const availableWidth = Math.max(180, host.clientWidth - (continuous ? 0 : 32));
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          setStatus(`Đang dựng trang ${pageNumber}/${document.numPages}…`);
          const page = await document.getPage(pageNumber);
          if (cancelled) return;
          const natural = page.getViewport({ scale: 1 });
          const fitScale = availableWidth / natural.width * zoom;
          const viewport = page.getViewport({ scale: fitScale });
          // Keep long papers responsive: the editor preview does not benefit from
          // rendering every page at the full device pixel ratio.
          const pixelRatio = Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.5);
          let canvas = window.document.createElement('canvas');
          canvas.width = Math.floor(viewport.width * pixelRatio);
          canvas.height = Math.floor(viewport.height * pixelRatio);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.setAttribute('aria-label', `Trang ${pageNumber} trên ${document.numPages}`);
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Trình duyệt không thể tạo vùng hiển thị PDF.');
          await page.render({ canvas, canvasContext: context, viewport, transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] }).promise;
          page.cleanup();

          if (continuous) canvas = cropReadingPage(canvas);

          const figure = window.document.createElement('figure');
          const caption = window.document.createElement('figcaption');
          caption.textContent = `Trang ${pageNumber}`;
          figure.append(canvas, caption);
          if (cancelled) return;
          host.append(figure);
        }
        if (!cancelled) setStatus('');
      } catch (cause) {
        if (!cancelled) setStatus(cause instanceof Error ? cause.message : 'Không thể hiển thị bản PDF.');
      }
    }

    void render();
    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [compact, continuous, url, zoom, containerWidth]);

  return <section className={`clean-pdf-viewer${compact ? ' compact' : ''}${continuous ? ' continuous' : ''}`} aria-label={title}>
    {!continuous && <header>
      <div className="clean-pdf-heading">{heading ?? <strong>{title}</strong>}</div>
      <div className="clean-pdf-controls" aria-label="Điều chỉnh bản PDF">
        <button type="button" onClick={() => setZoom((value) => Math.max(.65, +(value - .15).toFixed(2)))} disabled={zoom <= .65} aria-label="Thu nhỏ">−</button>
        <output>{Math.round(zoom * 100)}%</output>
        <button type="button" onClick={() => setZoom((value) => Math.min(1.8, +(value + .15).toFixed(2)))} disabled={zoom >= 1.8} aria-label="Phóng to">＋</button>
      </div>
      {actions}
    </header>}
    {status && <p className="clean-pdf-status" role="status">{status}</p>}
    <div ref={pagesRef} className="clean-pdf-pages" data-page-count={pageCount} />
  </section>;
}

/** Remove print margins in the article reader while leaving the downloadable PDF intact. */
function cropReadingPage(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return canvas;
  const { width, height } = canvas;
  let pixels: Uint8ClampedArray;
  try {
    pixels = context.getImageData(0, 0, width, height).data;
  } catch {
    return canvas;
  }
  const step = Math.max(2, Math.round(width / 350));
  let left = width, top = height, right = 0, bottom = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const offset = (y * width + x) * 4;
      if (pixels[offset + 3] < 8 || (pixels[offset] > 220 && pixels[offset + 1] > 220 && pixels[offset + 2] > 220)) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right <= left || bottom <= top) return canvas;

  const padding = Math.round(width * .025);
  const x1 = Math.min(Math.max(0, left - padding), Math.round(width * .2));
  const x2 = Math.max(Math.min(width, right + padding), Math.round(width * .8));
  const y1 = Math.min(Math.max(0, top - padding), Math.round(height * .18));
  const y2 = Math.max(Math.min(height, bottom + padding), Math.round(height * .72));
  const cropped = window.document.createElement('canvas');
  cropped.width = x2 - x1;
  cropped.height = y2 - y1;
  const target = cropped.getContext('2d');
  if (!target) return canvas;
  target.drawImage(canvas, x1, y1, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  cropped.style.width = '100%';
  cropped.style.height = 'auto';
  cropped.setAttribute('aria-label', canvas.getAttribute('aria-label') ?? 'Trang PDF');
  canvas.width = 0;
  canvas.height = 0;
  return cropped;
}
