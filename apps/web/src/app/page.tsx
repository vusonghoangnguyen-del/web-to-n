import type { Metadata } from 'next';
import Link from 'next/link';
import { NewsletterForm } from '@/components/newsletter-form';
import { getHomeData, problemHref, type PublicProblem } from '@/lib/public-api';
import { summarizeProblemBody } from '@/lib/problem-summary';

export const metadata: Metadata = {
  title: 'Trang nhất',
  description: 'Khám phá những bài toán mới, lời giải từ cộng đồng và video bài giảng trên Tờ Toán.',
};

export const revalidate = 60;

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' });

export default async function HomePage() {
  const { problems, totalProblems, featuredSolutions, videos, problemsAvailable } = await getHomeData();
  const [lead, ...recent] = problems;

  return (
    <>
      <section className="news-strip" aria-label="Giới thiệu">
        <strong>Tờ Toán</strong>
        <div className="ticker"><span>Chọn một bài vừa sức</span><i>◆</i><span>Thử một hướng giải mới</span><i>◆</i><span>Cùng trao đổi với cộng đồng</span></div>
      </section>

      <section className="front-page page-shell">
        <article className="lead-story">
          <div className="story-meta"><span className="rubric">Bài mới được chọn</span><span>{lead ? formatDate(lead.publishedAt ?? lead.createdAt) : 'Từ cộng đồng'}</span></div>
          <h1>{lead ? lead.title : 'Mỗi bài toán, một câu chuyện.'}</h1>
          <p className="standfirst">{lead ? summarizeProblemBody(lead.body, 230) : problemsAvailable ? 'Chưa có bài toán được xuất bản. Hãy quay lại sau nhé.' : 'NestJS API chưa chạy. Khởi động API để tải các bài toán mới nhất.'}</p>
          <div className="lead-illustration" aria-hidden="true"><div className="math-orbit"><span>∑</span><i>x²</i><b>∞</b></div><p>Thử nghĩ<br /><em>một cách khác?</em></p></div>
          <div className="story-footer"><span className={`difficulty ${difficultyClass(lead?.difficulty)}`}>{lead?.difficulty ?? 'Tờ Toán'}</span>{lead && <Link className="text-button" href={problemHref(lead)}>Đọc và thảo luận <span>→</span></Link>}</div>
        </article>

        <aside className="hot-column">
          <header className="section-rule"><h2>Bài mới xuất bản</h2><span>{totalProblems} bài công khai</span></header>
          {recent.length ? <ol className="hot-list">{recent.slice(0, 5).map((problem, index) => <li key={problem.id}><span>{String(index + 1).padStart(2, '0')}</span><div><Link href={problemHref(problem)}>{problem.title}</Link><small>{problem.difficulty} · {problem.commentCount} thảo luận</small></div></li>)}</ol> : <p className="empty-copy">Chưa có thêm bài toán mới.</p>}
          <div className="editor-note"><strong>Lời tòa soạn</strong><p>Một lời giải hay cần chỉ rõ vì sao từng bước đúng. Mọi hướng tiếp cận và câu hỏi chân thành đều được chào đón.</p></div>
        </aside>

        <article className="side-feature"><div className="feature-art" aria-hidden="true"><span>∞</span><i>… 1, 2, 3, 5, 8, 13 …</i></div><span className="rubric">Cách tham gia</span><h2>Không chỉ tìm đáp án.</h2><p>Đọc đề, thử giải, gửi lời giải của mình và trao đổi ngay bên trong từng bài.</p><Link href="/bai-toan" className="read-link">Tìm bài để thử <span>↗</span></Link></article>
      </section>

      <section className="problem-preview page-shell" id="bai-toan">
        <header className="desk-header"><div><span className="eyebrow">Kho bài toán</span><h2>Những thử thách<br />mới từ cộng đồng.</h2></div><p>{totalProblems ? `${totalProblems} bài toán đã được tòa soạn duyệt và xuất bản.` : 'Kho bài đang chờ những đóng góp đầu tiên.'}</p></header>
        {problems.length ? <div className="problem-grid">{problems.slice(0, 8).map((problem, index) => <ProblemCard key={problem.id} problem={problem} index={index} />)}</div> : <div className="home-empty"><strong>{problemsAvailable ? 'Chưa có bài toán được xuất bản.' : 'Chưa kết nối được NestJS API.'}</strong><p>{problemsAvailable ? 'Bạn có thể là người gửi thử thách đầu tiên.' : 'Chạy npm.cmd run dev:nest rồi tải lại trang.'}</p></div>}
        <div className="section-action"><Link className="outline-button" href="/bai-toan">Xem toàn bộ kho bài →</Link></div>
      </section>

      <section className="solutions-band" id="loi-giai"><div className="page-shell"><header className="section-rule light"><h2>Lời giải từ cộng đồng</h2><span>Đã được tòa soạn kiểm chứng</span></header><div className="solution-layout"><article className="solution-main"><span className="quote-mark">“</span><h3>Một lời giải đẹp<br />mở ra cách nghĩ mới.</h3><p>Trình bày từng bước để người khác có thể học và cùng trao đổi.</p><Link href="/bai-toan" className="read-link light-link">Chọn một bài để giải <span>→</span></Link></article><div className="solution-list">{featuredSolutions.length ? featuredSolutions.slice(0, 4).map((solution, index) => <article key={solution.id}><span>{String(index + 1).padStart(2, '0')}</span><div><h4><Link href={`/bai-toan/${encodeURIComponent(solution.problem_slug)}#loi-giai`}>{solution.problem_title}</Link></h4><p>{solution.author_name} · {solution.excerpt}…</p></div></article>) : <p className="dark-empty">Chưa có lời giải được kiểm chứng.</p>}</div></div></div></section>

      <section className="video-section page-shell" id="video"><header className="desk-header compact"><div><span className="eyebrow">Lớp học trên màn hình</span><h2>Video bài giảng</h2></div></header>{videos.length ? <div className="video-grid">{videos.slice(0, 3).map((video, index) => <article className={`video-card${index === 0 ? ' large' : ''}`} key={video.id}><a className={`video-thumb thumb-${index + 1}`} href={video.url} target="_blank" rel="noopener noreferrer" aria-label={`Xem video ${video.title}`}><span>▶</span><i>{video.duration}</i></a><div><span className="rubric">{video.topic}</span><h3>{video.title}</h3></div></article>)}</div> : <p className="empty-copy">Chưa có video bài giảng.</p>}</section>

      <section className="newsletter"><div><span className="eyebrow">Danh sách nhận tin</span><h2>Để lại email<br />nếu bạn quan tâm.</h2><p>Chúng tôi sẽ thông báo khi bản tin được triển khai.</p></div><NewsletterForm /></section>
    </>
  );
}

function ProblemCard({ problem, index }: { problem: PublicProblem; index: number }) {
  const category = problem.categories[0]?.name ?? 'Bài toán';
  return <article className={`problem-card${index === 0 ? ' featured' : index === 3 ? ' dark' : ''}`}><div className="card-top"><span className="number">{String(index + 1).padStart(2, '0')}</span><span className="rubric">{category}</span></div><h3><Link href={problemHref(problem)}>{problem.title}</Link></h3><p>{summarizeProblemBody(problem.body, 145)}</p><div className="card-stats"><span>{problem.difficulty}</span><span>·</span><span>{problem.commentCount} thảo luận</span></div><Link className="text-button" href={problemHref(problem)}>Đọc bài <span>→</span></Link></article>;
}

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function difficultyClass(value?: string): string {
  if (value === 'Dễ') return 'easy';
  if (value === 'Khó' || value === 'Thử thách') return 'hard';
  return 'medium';
}
