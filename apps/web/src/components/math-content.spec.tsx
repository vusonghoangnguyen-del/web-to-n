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
});
