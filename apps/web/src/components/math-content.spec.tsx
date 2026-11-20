import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MathContent } from './math-content';

describe('MathContent', () => {
  it('render Markdown và giữ công thức cho MathJax browser', () => {
    const html = renderToStaticMarkup(<MathContent content={'## Định lý\n\nTa có $x^2 + y^2 = z^2$.'} />);
    expect(html).toContain('<h4>Định lý</h4>');
    expect(html).toContain('data-math-renderer="mathjax-browser"');
    expect(html).toContain('\\(x^2 + y^2 = z^2\\)');
  });

  it('không đưa HTML thô hoặc URL javascript vào DOM', () => {
    const html = renderToStaticMarkup(<MathContent content={'<script>alert(1)</script>\n\n[Nguy hiểm](javascript:alert(1))'} />);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
  });

  it('render bảng và danh sách GFM', () => {
    const html = renderToStaticMarkup(<MathContent content={'| a | b |\n| - | - |\n| 1 | 2 |\n\n- Một\n- Hai'} />);
    expect(html).toContain('<table>');
    expect(html).toContain('<ul>');
  });

  it('hiển thị công thức khối trong Markdown', () => {
    const html = renderToStaticMarkup(<MathContent content={'$$\nx^2\n$$'} />);
    expect(html).toContain('\\[x^2\\]');
  });

  it('hiển thị phần thân tài liệu TeX và công thức thay vì in phần khai báo', () => {
    const tex = String.raw`\documentclass[12pt]{article}
\usepackage{amsmath}
\title{Bản thảo}
\begin{document}
\maketitle
\section{Đề bài}
Tìm nghiệm của phương trình \(2x^2 + 3x - 5 = 0\).
Ta có công thức \[e^{i\pi}+1=0.\]
\end{document}`;
    const html = renderToStaticMarkup(<MathContent content={tex} />);
    expect(html).toContain('Đề bài');
    expect(html).toContain('\\(2x^2 + 3x - 5 = 0\\)');
    expect(html).toContain('\\[e^{i\\pi}+1=0.\\]');
    expect(html).not.toContain('documentclass');
    expect(html).not.toContain('usepackage');
    expect(html).not.toContain('maketitle');
  });
});
