import { describe, expect, it } from 'vitest';
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
    expect(summary).toContain('Tìm nghiệm của phương trình x^2 + 1 = 0');
    expect(summary).not.toContain('documentclass');
    expect(summary).not.toContain('usepackage');
  });

  it('giới hạn độ dài tóm tắt', () => {
    expect(summarizeProblemBody('Một bài toán rất thú vị', 12)).toBe('Một bài toán…');
  });
});
