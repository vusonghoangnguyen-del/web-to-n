import { prepareMathContent } from './prepare-math-content';

/** A short Markdown teaser that keeps complete math expressions for MathJax. */
export function summarizeProblemBody(content: string, maxLength: number): string {
  const body = prepareMathContent(content);
  const parts = body.split(/(\$\$[\s\S]*?\$\$|\$(?!\$)(?:\\.|[^$\\])+\$)/g);
  let summary = '';

  for (const part of parts) {
    if (!part) continue;
    const isMath = part.startsWith('$') && part.endsWith('$');
    const text = isMath
      ? `$${part.replace(/^\$+|\$+$/g, '').replace(/\s+/g, ' ').trim()}$`
      : part.replace(/^\s*#{1,6}\s+/gm, '').replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const separator = summary && !/^[,.;:!?)]/.test(text) ? ' ' : '';
    const remaining = maxLength - summary.length - separator.length;
    if (text.length <= remaining) {
      summary += separator + text;
      continue;
    }

    if (isMath) return summary ? `${summary}…` : 'Mở bài viết để xem công thức.';
    const clipped = text.slice(0, Math.max(0, remaining));
    const lastSpace = clipped.lastIndexOf(' ');
    const readable = lastSpace > remaining * 0.6 ? clipped.slice(0, lastSpace) : clipped;
    return `${summary}${separator}${readable.trimEnd()}…`;
  }

  return summary || 'Mở bài viết để xem nội dung.';
}
