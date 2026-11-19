import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContributionForms } from '@/components/contribution-forms';
import { MathContent } from '@/components/math-content';
import { ProblemActions } from '@/components/problem-actions';
import { getProblemPageData, problemHref, type PublicComment, type PublicSolution } from '@/lib/public-api';

type PageProperties = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProperties): Promise<Metadata> {
  const { slug } = await params;
  const { problem } = await getProblemPageData(slug);
  if (!problem) return { title: 'Không tìm thấy bài toán' };
  const description = summarize(problem.body, 155);
  return {
    title: problem.title,
    description,
    alternates: { canonical: problemHref(problem) },
    openGraph: { title: problem.title, description, type: 'article', publishedTime: problem.publishedAt ?? problem.createdAt },
  };
}

export default async function ProblemDetailPage({ params }: PageProperties) {
  const { slug } = await params;
  const data = await getProblemPageData(slug);
  if (data.notFound) notFound();
  if (!data.available || !data.problem) {
    return <section className="detail-unavailable page-shell"><span aria-hidden="true">∅</span><h1>Chưa tải được bài toán</h1><p>Không thể kết nối tới NestJS API. Hãy khởi động API rồi tải lại trang.</p><Link className="outline-button" href="/bai-toan">← Về kho bài toán</Link></section>;
  }

  const problem = data.problem;
  const publishedAt = problem.publishedAt ?? problem.createdAt;
  const structuredData = {
    '@context': 'https://schema.org', '@type': 'Article', headline: problem.title,
    datePublished: publishedAt, dateModified: problem.updatedAt,
    author: { '@type': 'Person', name: problem.author.name },
    articleSection: problem.categories.map((category) => category.name),
  };

  return (
    <>
      <article className="problem-detail page-shell">
        <nav className="detail-breadcrumb" aria-label="Đường dẫn"><Link href="/bai-toan">Kho bài toán</Link><span>→</span><span>{problem.categories[0]?.name ?? 'Bài toán'}</span></nav>
        <header className="detail-header">
          <div className="detail-kicker"><span className="eyebrow">{problem.categories.map((category) => category.name).join(' · ') || 'Bài toán cộng đồng'}</span><span>{formatDate(publishedAt)}</span></div>
          <h1>{problem.title}</h1>
          <div className="detail-byline"><p>Bài của <strong>{problem.author.name}</strong> · @{problem.author.username}</p><span className={`detail-difficulty ${difficultyClass(problem.difficulty)}`}>{problem.difficulty}</span></div>
        </header>

        <div className="detail-layout">
          <section className="problem-statement" aria-labelledby="problem-statement-title">
            <span className="section-number">01</span><div><h2 id="problem-statement-title">Đề bài</h2><MathContent content={problem.body} className="math-copy" />{safeHttpUrl(problem.source) && <a className="detail-source" href={problem.source!} target="_blank" rel="noreferrer">Nguồn tham khảo ↗</a>}</div>
          </section>
          <aside className="detail-sidebar"><strong>Thử trước khi xem lời giải</strong><p>Ghi lại giả thiết, thử một trường hợp nhỏ và tìm xem điều gì không đổi.</p><dl><div><dt>Thảo luận</dt><dd>{problem.commentCount}</dd></div><div><dt>Lời giải</dt><dd>{data.solutions.length}</dd></div></dl></aside>
        </div>

        <ProblemActions problemId={problem.id} initialLikes={data.engagement.reactionCount} initialFollowers={data.engagement.followerCount} />
      </article>

      <section className="verified-solutions-section" id="loi-giai">
        <div className="page-shell">
          <header className="detail-section-heading"><div><span className="eyebrow">Đã được tòa soạn kiểm chứng</span><h2>Lời giải từ cộng đồng</h2></div><span>{data.solutions.length} lời giải</span></header>
          {data.solutions.length ? <div className="verified-solution-list">{data.solutions.map((solution, index) => <SolutionCard key={solution.id} solution={solution} index={index} reactions={data.engagement.solutionReactions[solution.id] ?? 0} />)}</div> : <EmptyCommunity copy="Chưa có lời giải nào được kiểm chứng. Bạn có thể gửi một cách giải mới ở bên dưới." />}
        </div>
      </section>

      <section className="discussion-section page-shell" id="thao-luan">
        <header className="detail-section-heading"><div><span className="eyebrow">Trao đổi từng bước</span><h2>Thảo luận</h2></div><span>{data.comments.length} bình luận</span></header>
        {data.comments.length ? <CommentTree comments={data.comments} /> : <EmptyCommunity copy="Chưa có bình luận. Hãy là người đầu tiên mở một hướng suy nghĩ." />}
      </section>

      <section className="contribution-section page-shell"><ContributionForms problemId={problem.id} /></section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
    </>
  );
}

function SolutionCard({ solution, index, reactions }: { solution: PublicSolution; index: number; reactions: number }) {
  return <article className="verified-solution-card"><div className="solution-index">{String(index + 1).padStart(2, '0')}</div><div><div className="solution-meta">{solution.isFeatured && <strong>★ Nổi bật · </strong>}{solution.author.name} · {formatDate(solution.createdAt)}{solution.edited && ' · Đã chỉnh sửa'}</div><h3>Một cách tiếp cận từ cộng đồng</h3><MathContent content={solution.content} className="math-copy" /><span className="solution-likes">♡ {reactions} lượt thích</span></div></article>;
}

function CommentTree({ comments }: { comments: PublicComment[] }) {
  const ids = new Set(comments.map((comment) => comment.id));
  const children = new Map<string, PublicComment[]>();
  for (const comment of comments) {
    if (comment.parentId && ids.has(comment.parentId)) children.set(comment.parentId, [...(children.get(comment.parentId) ?? []), comment]);
  }
  const roots = comments.filter((comment) => !comment.parentId || !ids.has(comment.parentId));
  const render = (comment: PublicComment, depth = 0): ReactNode => <div key={comment.id} className={depth ? 'comment-branch' : undefined}><article className="discussion-comment"><span className="comment-avatar" aria-hidden="true">{comment.author.name.slice(0, 1).toUpperCase()}</span><div><header><strong>{comment.author.name}</strong><span>{roleLabel(comment.author.role)}</span><time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>{comment.edited && <em>Đã sửa</em>}</header><MathContent content={comment.content} /></div></article>{(children.get(comment.id) ?? []).map((child) => render(child, depth + 1))}</div>;
  return <div className="discussion-list">{roots.map((comment) => render(comment))}</div>;
}

function EmptyCommunity({ copy }: { copy: string }) { return <div className="community-empty"><span aria-hidden="true">∴</span><p>{copy}</p></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(new Date(value)); }
function summarize(value: string, max: number) { const normalized = value.replace(/\s+/g, ' ').trim(); return normalized.length <= max ? normalized : `${normalized.slice(0, max).trimEnd()}…`; }
function difficultyClass(value: string) { const normalized = value.toLowerCase(); return normalized.includes('dễ') ? 'easy' : normalized.includes('khó') || normalized.includes('thử') ? 'hard' : 'medium'; }
function roleLabel(role: string) { return ({ admin: 'Admin', moderator: 'Điều hành viên', editor: 'Biên tập viên', reader: 'Thành viên' } as Record<string, string>)[role] ?? 'Thành viên'; }
function safeHttpUrl(value: string | null) { if (!value) return false; try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } }
