/** Turn a simple standalone .tex document into web article content.
 * The original source remains in the database; this is only a reading view.
 */
export function prepareMathContent(content: string): string {
  const start = content.indexOf('\\begin{document}');
  if (start < 0) return normalizeMathDelimiters(content);

  const end = content.indexOf('\\end{document}', start);
  let body = content.slice(start + '\\begin{document}'.length, end < 0 ? undefined : end);

  body = body
    .replace(/\\maketitle\b/g, '')
    .replace(/\\(?:section|subsection|subsubsection)\*?(?:\[[^\]]*\])?\{([^{}]*)\}/g,
      (match, title: string) => `${'\n\n'}${match.startsWith('\\subsubsection') ? '####' : match.startsWith('\\subsection') ? '###' : '##'} ${title}\n\n`)
    .replace(/\\(?:textbf|textit|emph)\{([^{}]*)\}/g,
      (match, text: string) => match.startsWith('\\textbf') ? `**${text}**` : `*${text}*`)
    .replace(/\\(?:begin|end)\{(?:itemize|enumerate)\}/g, '\n')
    .replace(/\\item\b\s*/g, '\n- ')
    .replace(/\\(?:par|noindent)\b/g, '\n\n')
    .replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g,
      (_match, math: string) => `\n\n$$\n${math.trim()}\n$$\n\n`)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return normalizeMathDelimiters(body);
}

function normalizeMathDelimiters(content: string): string {
  return content
    .replace(/\\\[/g, () => '\n\n$$\n')
    .replace(/\\\]/g, () => '\n$$\n\n')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
}
