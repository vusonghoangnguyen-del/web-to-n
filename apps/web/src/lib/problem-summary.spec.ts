import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MathContent } from '../components/math-content';
import { summarizeProblemBody } from './problem-summary';

describe('summarizeProblemBody', () => {
  it('bỏ phần đầu tài liệu TeX và giữ nội dung bài toán', () => {
    const tex = String.raw`\documentclass[12pt]{article}
\usepackage{amsmath}
\title{Bản thảo}
\begin{document}
\maketitle
Tìm nghiệm của phương trình \[x^2 + 1 = 0\].
\end{document}`;
    const summary = summarizeProblemBody(tex, 200);
    expect(summary).toContain('Tìm nghiệm của phương trình $x^2 + 1 = 0$');
    expect(summary).not.toContain('documentclass');
    expect(summary).not.toContain('usepackage');
    expect(renderToStaticMarkup(createElement(MathContent, { content: summary }))).toContain('\\(x^2 + 1 = 0\\)');
  });

  it('hiển thị được cả công thức nội dòng và công thức khối ở thẻ bài', () => {
    const inline = summarizeProblemBody('*Tìm nghiệm của phương trình sau*: $2x^2 + 3x -5 = 0$', 180);
    const display = summarizeProblemBody(String.raw`\begin{document}Ta có công thức \[ e^{i\pi} + 1 = 0. \]\end{document}`, 180);
    expect(renderToStaticMarkup(createElement(MathContent, { content: inline }))).toContain('\\(2x^2 + 3x -5 = 0\\)');
    expect(renderToStaticMarkup(createElement(MathContent, { content: display }))).toContain('\\(e^{i\\pi} + 1 = 0.\\)');
  });

  it('không cắt công thức giữa chừng khi tóm tắt', () => {
    const summary = summarizeProblemBody('Mở đầu $x^2 + y^2 = z^2$ và giải thích', 12);
    expect(summary).toBe('Mở đầu…');
    expect(summary).not.toContain('$');
  });

  it('giới hạn độ dài tóm tắt', () => {
    expect(summarizeProblemBody('Một bài toán rất thú vị', 12)).toBe('Một bài toán…');
  });
});
