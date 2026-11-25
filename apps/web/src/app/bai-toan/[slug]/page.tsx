import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { WorkspaceTabs } from '@/components/workspace-tabs';
import { ContributionForms } from '@/components/contribution-forms';
import { CleanPdfViewer } from '@/components/clean-pdf-viewer';
import { MathContent } from '@/components/math-content';
import { ProblemActions } from '@/components/problem-actions';
import { getProblemPageData, problemHref, type PublicComment, type PublicSolution } from '@/lib/public-api';

type PageProperties = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProperties): Promise<Metadata> {
  const { slug } = await params;
  const { problem } = await getProblemPageData(slug);
  if (!problem) return { title: 'Không tìm thấy bài viết' };
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
    return <section className="detail-unavailable page-shell"><span aria-hidden="true">∅</span><h1>Chưa tải được bài viết</h1><p>Không thể kết nối tới NestJS API. Hãy khởi động API rồi tải lại trang.</p><Link className="outline-button" href="/bai-toan">← Về kho bài viết</Link></section>;
  }

  const problem = data.problem;
  const publishedAt = problem.publishedAt ?? problem.createdAt;
  const structuredData = {
    '@context': 'https://schema.org', '@type': 'Article', headline: problem.title,
    datePublished: publishedAt, dateModified: problem.updatedAt,
    author: { '@type': 'Person', name: problem.author.name },
    articleSection: problem.categories.map((category) => category.name),
  };

  return <>
    <article className="problem-detail page-shell catalog-detail article-reading-page">
      <nav className="detail-breadcrumb" aria-label="Đường dẫn"><Link href="/bai-toan">Bài viết</Link><span>›</span><span>{problem.categories[0]?.name ?? 'Toán học'}</span></nav>
      <header className="detail-header"><div className="catalog-lead-meta"><span className="catalog-topic">{problem.categories.map((category) => category.name).join(', ') || 'Toán học'}</span><span>{problem.difficulty}</span><span>{data.comments.length} thảo luận</span></div><h1>{problem.title}</h1><p className="detail-byline">{problem.author.name} · Xuất bản <time dateTime={publishedAt}>{formatDate(publishedAt)}</time></p><div className="article-reading-actions"><ProblemActions problemId={problem.id} initialLikes={data.engagement.reactionCount} initialFollowers={data.engagement.followerCount} />{problem.latexPdfUrl&&<div className="article-file-actions"><a href={problem.latexPdfUrl} download={problem.slug+'.pdf'}>Tải PDF ↓</a><a href={problem.latexPdfUrl} target="_blank" rel="noopener noreferrer">Mở bản gốc ↗</a></div>}</div></header>
      <div className="catalog-detail-layout">
        <WorkspaceTabs className="reader-tabs" syncHash tabs={[{ id: 'de-bai', label: 'Nội dung' }, { id: 'loi-giai', label: 'Phản hồi & lời giải (' + data.solutions.length + ')' }, { id: 'thao-luan', label: 'Thảo luận (' + data.comments.length + ')' }]}>
          <section id="de-bai" className="catalog-statement article-reading-body" aria-label="Nội dung bài viết">{problem.latexPdfUrl ? <><CleanPdfViewer url={problem.latexPdfUrl} title={problem.title} continuous />{problem.body.trim() && !/^xem\s+(?:tệp|file)\s+pdf[.!]?$/i.test(problem.body.trim()) && <details className="detail-text-fallback"><summary>Nội dung văn bản đi kèm</summary><MathContent content={problem.body} className="math-copy" /></details>}</> : <MathContent content={problem.body} className="math-copy" />}{problem.source && <p className="article-reading-source">Nguồn: {safeHttpUrl(problem.source)?<a href={problem.source} target="_blank" rel="noopener noreferrer">Tham khảo ↗</a>:problem.source}</p>}<p className="statement-contribute"><a className="outline-button" href="#loi-giai">Gửi phản hồi hoặc lời giải</a></p></section>
          <section id="loi-giai" className="catalog-solutions"><h2>Lời giải từ cộng đồng</h2>{data.solutions.length ? <div className="verified-solution-list">{data.solutions.map((solution, index) => <SolutionCard key={solution.id} solution={solution} index={index} reactions={data.engagement.solutionReactions[solution.id] ?? 0} />)}</div> : <EmptyCommunity copy="Chưa có lời giải được kiểm chứng." />}<ContributionForms problemId={problem.id} kind="solution" /></section>
          <section id="thao-luan" className="catalog-discussion"><h2>Thảo luận</h2>{data.comments.length ? <CommentTree comments={data.comments} /> : <EmptyCommunity copy="Chưa có bình luận." />}<ContributionForms problemId={problem.id} kind="comment" /></section>
        </WorkspaceTabs>

      </div>
    </article>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
  </>;
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
