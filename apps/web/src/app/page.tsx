import type { Metadata } from 'next';
import Link from 'next/link';
import { MathContent } from '@/components/math-content';
import { NewsletterForm } from '@/components/newsletter-form';
import { ProblemListItem } from '@/components/problem-list-item';
import { ProblemSearch } from '@/components/problem-search';
import { UiIcon } from '@/components/ui-icon';
import { getHomeData, problemHref } from '@/lib/public-api';
import { summarizeProblemBody } from '@/lib/problem-summary';

export const metadata: Metadata = { title: 'Trang nhất', description: 'Khám phá bài viết, lời giải và video bài giảng từ cộng đồng Tờ Toán.' };
export const revalidate = 60;
const categories = [['dai-so', 'Đại số'], ['hinh-hoc', 'Hình học'], ['so-hoc', 'Số học'], ['to-hop', 'Tổ hợp'], ['logic', 'Logic'], ['xac-suat', 'Xác suất']] as const;

export default async function HomePage() {
  const { problems, totalProblems, featuredSolutions, videos, problemsAvailable } = await getHomeData();
  const [lead, ...recent] = problems;
  const expression = lead?.body.match(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$(?!\$)((?:\\.|[^$\\])+?)\$/);
  const leadExpression = expression && (expression[1] ?? expression[2] ?? expression[3]);
  return <div className="catalog-home page-shell">
    <header className="catalog-home-heading"><h1>Trang nhất</h1><ProblemSearch id="home-search" /></header>
    <div className="catalog-home-layout"><section aria-label="Bài viết mới">
      {lead ? <article className="catalog-lead">
        <div className="catalog-lead-meta"><span className="catalog-topic">{lead.categories.map((category) => category.name).join(', ') || 'Bài viết'}</span><span>{lead.difficulty}</span><span>{lead.commentCount} thảo luận</span></div>
        <h2><Link href={problemHref(lead)}>{lead.title}</Link></h2><MathContent content={summarizeProblemBody(lead.body, 280)} className="catalog-lead-excerpt" />
        {leadExpression && <MathContent content={'$$' + leadExpression + '$$'} className="catalog-lead-equation" />}
        <div className="catalog-item-footer"><span>{lead.author.name} · <time dateTime={lead.publishedAt ?? lead.createdAt}>{new Intl.DateTimeFormat('vi-VN').format(new Date(lead.publishedAt ?? lead.createdAt))}</time></span><Link href={problemHref(lead)}>Đọc và thảo luận <UiIcon name="arrow-right" /></Link></div>
      </article> : <div className="catalog-empty"><h2>{problemsAvailable ? 'Chưa có bài viết được xuất bản' : 'Chưa tải được bài viết'}</h2><p>{problemsAvailable ? 'Các bài được duyệt sẽ xuất hiện tại đây.' : 'Vui lòng tải lại trang sau ít phút.'}</p><Link className="outline-button" href={problemsAvailable ? '/soan-bai' : '/'}>{problemsAvailable ? 'Gửi bài viết' : 'Thử lại'}</Link></div>}
      {recent.slice(0, 7).map((problem) => <ProblemListItem problem={problem} key={problem.id} />)}
      {totalProblems > problems.slice(0, 8).length && <div className="catalog-more"><Link className="outline-button" href="/bai-toan">Xem toàn bộ kho bài <UiIcon name="arrow-right" /></Link></div>}
    </section><aside className="catalog-home-rail">
      <section><h2>Chuyên mục</h2><nav className="catalog-topic-links" aria-label="Chuyên mục bài viết">{categories.map(([slug, name]) => <Link key={slug} href={'/bai-toan?category=' + slug}>{name}<UiIcon name="arrow-right" /></Link>)}</nav></section>
      <section id="loi-giai"><h2>Lời giải mới</h2>{featuredSolutions.length ? featuredSolutions.slice(0, 3).map((solution) => <article key={solution.id} className="catalog-solution"><div className="catalog-solution-meta"><span className="status-verified">Đã kiểm chứng</span><span>{solution.author_name}</span></div><h3><Link href={'/bai-toan/' + encodeURIComponent(solution.problem_slug) + '#loi-giai'}>{solution.problem_title}</Link></h3><MathContent content={summarizeProblemBody(solution.excerpt, 230)} /><Link className="catalog-read-link" href={'/bai-toan/' + encodeURIComponent(solution.problem_slug) + '#loi-giai'}>Đọc lời giải <UiIcon name="arrow-right" /></Link></article>) : <p className="catalog-empty-copy">Chưa có lời giải được kiểm chứng. <Link href="/bai-toan">Chọn bài để giải <UiIcon name="arrow-right" /></Link></p>}</section>
      <section id="video"><h2>Video bài giảng</h2>{videos.length ? videos.slice(0, 3).map((video) => <article className="catalog-video" key={video.id}><a className="catalog-video-preview" href={video.url} target="_blank" rel="noopener noreferrer" aria-label={'Xem video ' + video.title}><span className="catalog-video-title">{video.title}</span><span className="catalog-video-play"><UiIcon name="play" /></span><span className="catalog-video-duration">{video.duration}</span></a><span className="catalog-topic">{video.topic}</span><h3><a href={video.url} target="_blank" rel="noopener noreferrer">{video.title}</a></h3></article>) : <p className="catalog-empty-copy">Chưa có video bài giảng.</p>}</section>
    </aside></div>
    <section className="catalog-newsletter"><div><h2>Nhận tin từ Tờ Toán</h2><p>Thông báo khi bản tin được triển khai.</p></div><NewsletterForm /></section>
  </div>;
}
