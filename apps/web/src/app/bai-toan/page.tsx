import type { Metadata } from 'next';
import Link from 'next/link';
import { getProblems, problemHref, type PublicProblem } from '@/lib/public-api';

export const metadata: Metadata = {
  title: 'Kho bài toán',
  description: 'Tìm kiếm và khám phá các bài toán số học, đại số, hình học, tổ hợp, logic và xác suất từ cộng đồng Tờ Toán.',
};

type SearchParameters = Record<string, string | string[] | undefined>;

const categories = [
  ['all', 'Tất cả'], ['so-hoc', 'Số học'], ['hinh-hoc', 'Hình học'],
  ['dai-so', 'Đại số'], ['to-hop', 'Tổ hợp'], ['logic', 'Logic'], ['xac-suat', 'Xác suất'],
] as const;
const difficulties = ['Dễ', 'Trung bình', 'Khó', 'Thử thách'] as const;

export default async function ProblemsPage({ searchParams }: { searchParams: Promise<SearchParameters> }) {
  const parameters = await searchParams;
  const search = single(parameters.search).slice(0, 100);
  const requestedCategory = single(parameters.category) || 'all';
  const category = categories.some(([slug]) => slug === requestedCategory) ? requestedCategory : 'all';
  const requestedDifficulty = single(parameters.difficulty);
  const difficulty = difficulties.includes(requestedDifficulty as typeof difficulties[number]) ? requestedDifficulty : '';
  const page = positiveInteger(single(parameters.page));
  const result = await getProblems({ page, limit: 12, search, category, difficulty });

  return (
    <>
      <header className="archive-hero page-shell">
        <div><span className="eyebrow">Thư viện cộng đồng</span><h1>Kho bài toán</h1></div>
        <p>Tìm một bài vừa sức, hoặc khó hơn một chút. Mỗi đề bài đều đã được tòa soạn duyệt trước khi xuất bản.</p>
      </header>

      <section className="archive-controls page-shell" aria-label="Tìm kiếm và lọc bài toán">
        <form className="archive-search" action="/bai-toan" method="get">
          <label htmlFor="problem-search">Tìm kiếm</label>
          <div><input id="problem-search" name="search" type="search" defaultValue={search} maxLength={100} placeholder="Tiêu đề hoặc nội dung…" /><button type="submit">Tìm →</button></div>
          {category !== 'all' && <input type="hidden" name="category" value={category} />}
          {difficulty && <input type="hidden" name="difficulty" value={difficulty} />}
        </form>

        <nav className="category-filters" aria-label="Lọc theo chuyên mục">
          {categories.map(([slug, label]) => <Link key={slug} href={filterHref({ search, category: slug, difficulty, page: 1 })} className={category === slug ? 'active' : undefined} aria-current={category === slug ? 'page' : undefined}>{label}</Link>)}
        </nav>

        <form className="difficulty-control" action="/bai-toan" method="get">
          {search && <input type="hidden" name="search" value={search} />}
          {category !== 'all' && <input type="hidden" name="category" value={category} />}
          <label htmlFor="difficulty-filter">Độ khó</label>
          <select id="difficulty-filter" name="difficulty" defaultValue={difficulty}><option value="">Mọi mức độ</option>{difficulties.map((item) => <option key={item}>{item}</option>)}</select>
          <button className="outline-button" type="submit">Áp dụng</button>
          {(search || category !== 'all' || difficulty) && <Link className="clear-filters" href="/bai-toan">Xóa bộ lọc</Link>}
        </form>
      </section>

      <section className="archive-results page-shell" aria-live="polite">
        <header className="results-heading"><p><strong>{result.total}</strong> bài toán phù hợp</p>{search && <span>Kết quả cho “{search}”</span>}</header>
        {!result.available ? <ArchiveMessage title="Chưa kết nối được NestJS API" copy="Khởi động API bằng npm.cmd run dev:nest rồi tải lại trang." /> : result.problems.length ? <div className="archive-grid">{result.problems.map((problem, index) => <ArchiveCard key={problem.id} problem={problem} number={(result.page - 1) * result.limit + index + 1} />)}</div> : <ArchiveMessage title="Không tìm thấy bài toán phù hợp" copy="Hãy thử từ khóa, chuyên mục hoặc mức độ khác." />}
        {result.available && result.totalPages > 1 && <Pagination currentPage={result.page} totalPages={result.totalPages} filters={{ search, category, difficulty }} />}
      </section>
    </>
  );
}

function ArchiveCard({ problem, number }: { problem: PublicProblem; number: number }) {
  return (
    <article className="archive-card">
      <div className="card-top"><span className="number">{String(number).padStart(2, '0')}</span><span className="rubric">{problem.categories.map((item) => item.name).join(' · ') || 'Bài toán'}</span></div>
      <h2><Link href={problemHref(problem)}>{problem.title}</Link></h2>
      <p>{summarize(problem.body, 180)}</p>
      <div className="archive-author">Bởi <strong>{problem.author.name}</strong></div>
      <div className="archive-card-footer"><span>{problem.difficulty}</span><span>{problem.commentCount} thảo luận</span><Link href={problemHref(problem)} aria-label={`Đọc bài ${problem.title}`}>Đọc →</Link></div>
    </article>
  );
}

function ArchiveMessage({ title, copy }: { title: string; copy: string }) {
  return <div className="archive-message"><span aria-hidden="true">∅</span><h2>{title}</h2><p>{copy}</p></div>;
}

function Pagination({ currentPage, totalPages, filters }: { currentPage: number; totalPages: number; filters: { search: string; category: string; difficulty: string } }) {
  const pages = pageWindow(currentPage, totalPages);
  return <nav className="pagination" aria-label="Phân trang bài toán">{currentPage > 1 && <Link href={filterHref({ ...filters, page: currentPage - 1 })} rel="prev">← Trước</Link>}<div>{pages.map((page) => <Link key={page} href={filterHref({ ...filters, page })} className={page === currentPage ? 'active' : undefined} aria-current={page === currentPage ? 'page' : undefined}>{page}</Link>)}</div>{currentPage < totalPages && <Link href={filterHref({ ...filters, page: currentPage + 1 })} rel="next">Sau →</Link>}</nav>;
}

function filterHref(filters: { search?: string; category?: string; difficulty?: string; page?: number }): string {
  const parameters = new URLSearchParams();
  if (filters.search) parameters.set('search', filters.search);
  if (filters.category && filters.category !== 'all') parameters.set('category', filters.category);
  if (filters.difficulty) parameters.set('difficulty', filters.difficulty);
  if (filters.page && filters.page > 1) parameters.set('page', String(filters.page));
  const query = parameters.toString();
  return query ? `/bai-toan?${query}` : '/bai-toan';
}

function pageWindow(current: number, total: number): number[] {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function positiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function summarize(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength).trimEnd()}…`;
}
