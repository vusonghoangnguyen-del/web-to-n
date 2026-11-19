/** A readable, plain-text teaser for Markdown or an imported .tex document. */
export function summarizeProblemBody(content: string, maxLength: number): string {
  let body = content;
  const documentStart = body.indexOf('\\begin{document}');
  if (documentStart !== -1) body = body.slice(documentStart + '\\begin{document}'.length);
  body = body.split('\\end{document}', 1)[0];

  const normalized = body
    .replace(/^\s*\\(?:documentclass|usepackage|title|author|date)(?:\[[^\]]*\])?\{[^\n]*\}\s*$/gm, '')
    .replace(/(^|\s)%(?!%)[^\n]*/g, '$1')
    .replace(/\\(?:begin|end)\{[^}]+\}/g, ' ')
    .replace(/\\(?:section|subsection|subsubsection|textbf|textit|emph)\*?\{([^{}]*)\}/g, '$1')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
    .replace(/\\(?:maketitle|par|noindent|newline)\b/g, ' ')
    .replace(/\\(?:pi|alpha|beta|gamma|theta|infty)\b/g, (command) => ({
      '\\pi': 'π', '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ',
      '\\theta': 'θ', '\\infty': '∞',
    })[command] ?? command)
    .replace(/\\(?:\[|\]|\(|\)|\$)/g, ' ')
    .replace(/\\[a-zA-Z]+\b/g, ' ')
    .replace(/\\\\/g, ' ')
    .replace(/[$#*_`{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return 'Mở bài toán để xem nội dung.';
  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');
  const readable = lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return `${readable.trimEnd()}…`;
}
