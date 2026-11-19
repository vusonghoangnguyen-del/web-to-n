'use client';

import { useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

type MathJaxRuntime = {
  typesetClear?: (elements?: Element[]) => void;
  typesetPromise?: (elements?: Element[]) => Promise<void>;
};

type MathJaxWindow = Window & {
  MathJax?: MathJaxRuntime & Record<string, unknown>;
};

let mathJaxLoader: Promise<MathJaxRuntime> | undefined;

export function MathContent({ content, className = '' }: { content: string; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void loadMathJax().then((mathJax) => {
      if (!active || !root.current || !mathJax.typesetPromise) return;
      mathJax.typesetClear?.([root.current]);
      return mathJax.typesetPromise([root.current]);
    }).catch((error: unknown) => console.error('Không thể hiển thị công thức MathJax.', error));
    return () => { active = false; };
  }, [content]);

  return (
    <div ref={root} className={`math-content ${className}`.trim()} data-math-renderer="mathjax-browser">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        skipHtml
        components={{
          a: ({ href, children, ...properties }) => <a {...properties} href={safeHref(href)} rel="nofollow ugc noopener" target={isExternal(href) ? '_blank' : undefined}>{children}</a>,
          code: ({ className: codeClassName, children }) => {
            const source = String(children).replace(/\n$/, '');
            if (codeClassName?.includes('math-display')) return <span className="math-display-source">{`\\[${source}\\]`}</span>;
            if (codeClassName?.includes('math-inline')) return <span className="math-inline-source">{`\\(${source}\\)`}</span>;
            return <code className={codeClassName}>{children}</code>;
          },
          h1: ({ children }) => <h3>{children}</h3>,
          h2: ({ children }) => <h4>{children}</h4>,
          h3: ({ children }) => <h5>{children}</h5>,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

function loadMathJax() {
  if (typeof window === 'undefined') return Promise.resolve({} as MathJaxRuntime);
  const browserWindow = window as MathJaxWindow;
  if (browserWindow.MathJax?.typesetPromise) return Promise.resolve(browserWindow.MathJax);
  if (mathJaxLoader) return mathJaxLoader;

  mathJaxLoader = new Promise<MathJaxRuntime>((resolve, reject) => {
    const finish = () => {
      const runtime = browserWindow.MathJax;
      if (runtime?.typesetPromise) resolve(runtime);
      else reject(new Error('MathJax đã tải nhưng API typeset chưa sẵn sàng.'));
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-to-toan-mathjax]');
    if (existing) {
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', () => reject(new Error('Không tải được MathJax.')), { once: true });
      return;
    }
    browserWindow.MathJax = {
      tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']], processEscapes: true },
      options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] },
      startup: { typeset: false },
    };
    const script = document.createElement('script');
    script.src = '/vendor/mathjax/tex-svg-full.js';
    script.async = true;
    script.dataset.toToanMathjax = 'true';
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', () => reject(new Error('Không tải được MathJax.')), { once: true });
    document.head.appendChild(script);
  });
  return mathJaxLoader;
}

function safeHref(value?: string) {
  if (!value) return undefined;
  if (value.startsWith('/') || value.startsWith('#')) return value;
  try { return ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol) ? value : undefined; }
  catch { return undefined; }
}

function isExternal(value?: string) {
  if (!value) return false;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
}
