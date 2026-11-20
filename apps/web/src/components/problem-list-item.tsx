import Link from 'next/link';
import { MathContent } from './math-content';
import { UiIcon } from './ui-icon';
import { problemHref, type PublicProblem } from '@/lib/public-api';
import { summarizeProblemBody } from '@/lib/problem-summary';

export function ProblemListItem({ problem }: { problem: PublicProblem }) {
  return <article className="catalog-item">
    <div className="catalog-item-copy"><h2><Link href={problemHref(problem)}>{problem.title}</Link></h2><MathContent content={summarizeProblemBody(problem.body, 220)} className="catalog-excerpt" /><div className="catalog-item-footer"><span>{problem.author.name} · <time dateTime={problem.publishedAt ?? problem.createdAt}>{new Intl.DateTimeFormat('vi-VN').format(new Date(problem.publishedAt ?? problem.createdAt))}</time></span><Link href={problemHref(problem)}>Đọc bài <UiIcon name="arrow-right" /></Link></div></div>
    <div className="catalog-item-meta"><span className="catalog-topic">{problem.categories.map((category) => category.name).join(', ') || 'Bài viết'}</span><span>{problem.difficulty}</span><span>{problem.commentCount} thảo luận</span></div>
  </article>;
}
