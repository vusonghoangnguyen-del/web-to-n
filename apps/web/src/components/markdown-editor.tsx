'use client';

import type { TextareaHTMLAttributes } from 'react';
import { useEffect, useRef, useState } from 'react';
import { MathContent } from './math-content';

type EditorProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
};

const tools = [
  { label: 'B', title: 'In đậm', before: '**', after: '**', sample: 'nội dung' },
  { label: 'I', title: 'In nghiêng', before: '*', after: '*', sample: 'nội dung' },
  { label: '$x$', title: 'Công thức trong dòng', before: '$', after: '$', sample: 'x^2' },
  { label: 'a⁄b', title: 'Phân số', before: '$\\frac{', after: '}{b}$', sample: 'a' },
  { label: '√', title: 'Căn bậc hai', before: '$\\sqrt{', after: '}$', sample: 'x' },
  { label: 'xⁿ', title: 'Số mũ', before: '$', after: '^{n}$', sample: 'x' },
  { label: 'Σ', title: 'Tổng', before: '$$\\sum_{i=1}^{n} ', after: '$$', sample: 'a_i' },
  { label: '∫', title: 'Tích phân', before: '$$\\int_{a}^{b} ', after: '\\,dx$$', sample: 'f(x)' },
  { label: '[ ]', title: 'Ma trận', before: '$$\\begin{pmatrix}\n', after: '\n\\end{pmatrix}$$', sample: 'a & b \\\\\nc & d' },
] as const;

export function MarkdownTextarea({ value, onValueChange, className = '', ...properties }: EditorProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);

  function insert(before: string, after: string, sample: string) {
    const element = textarea.current;
    if (!element || properties.disabled) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const selected = value.slice(start, end) || sample;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onValueChange(next);
    requestAnimationFrame(() => {
      element.focus();
      const selectionStart = start + before.length;
      element.setSelectionRange(selectionStart, selectionStart + selected.length);
    });
  }

  return <div className="markdown-input"><div className="markdown-toolbar" role="toolbar" aria-label="Công cụ Markdown và công thức">{tools.map((tool) => <button key={tool.title} type="button" title={tool.title} aria-label={tool.title} disabled={properties.disabled} onClick={() => insert(tool.before, tool.after, tool.sample)} className={tool.label === 'I' ? 'italic-tool' : undefined}>{tool.label}</button>)}</div><textarea {...properties} ref={textarea} className={className} value={value} onChange={(event) => onValueChange(event.target.value)} /></div>;
}

export function DebouncedMathPreview({ content, empty = 'Nội dung xem trước sẽ xuất hiện tại đây.', delay = 400, className = '' }: { content: string; empty?: string; delay?: number; className?: string }) {
  const [settled, setSettled] = useState(content);
  useEffect(() => { const timer = window.setTimeout(() => setSettled(content), delay); return () => window.clearTimeout(timer); }, [content, delay]);
  return <MathContent content={settled.trim() || empty} className={className} />;
}
