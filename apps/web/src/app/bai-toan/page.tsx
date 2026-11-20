import type { Metadata } from 'next';
import Link from 'next/link';
import { getProblems } from '@/lib/public-api';
import { ProblemListItem } from '@/components/problem-list-item';
import { ProblemSearch } from '@/components/problem-search';
import { ResponsiveDisclosure } from '@/components/responsive-disclosure';

export const metadata: Metadata = {
  title: 'Kho bài viết',
  description: 'Tìm kiếm và khám phá các bài viết toán học từ cộng đồng Tờ Toán.',
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
    <div className="catalog-archive page-shell">
      <header className="archive-hero page-shell">
        <h1>Kho bài viết</h1><p>Bài toán, bài báo và thảo luận từ cộng đồng</p>
      </header>

      <div className="catalog-archive-layout">
      <ResponsiveDisclosure className="catalog-filter-panel" label="Bộ lọc"><section className="archive-controls" aria-label="Lọc bài viết">
        <h2>Chuyên mục</h2>

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
      </section></ResponsiveDisclosure>

      <section className="archive-results" aria-live="polite">
        <ProblemSearch search={search} category={category} difficulty={difficulty} />
        <header className="results-heading"><p>{result.available ? <><strong>{result.total}</strong> bài viết{search || category !== 'all' || difficulty ? ' phù hợp' : ''}</> : 'Không thể tải kết quả'}</p>{search && <span>Kết quả cho “{search}”</span>}</header>
        {!result.available ? <ArchiveMessage title="Chưa tải được bài viết" copy="Vui lòng tải lại trang sau ít phút." /> : result.problems.length ? <div className="catalog-results">{result.problems.map((problem) => <ProblemListItem key={problem.id} problem={problem} />)}</div> : <ArchiveMessage title="Không tìm thấy bài viết phù hợp" copy="Hãy thử từ khóa, chuyên mục hoặc mức độ khác." />}
        {result.available && result.totalPages > 1 && <Pagination currentPage={result.page} totalPages={result.totalPages} filters={{ search, category, difficulty }} />}
      </section>
      </div>
    </div>
  );
}

function ArchiveMessage({ title, copy }: { title: string; copy: string }) {
  return <div className="archive-message"><span aria-hidden="true">∅</span><h2>{title}</h2><p>{copy}</p></div>;
}

function Pagination({ currentPage, totalPages, filters }: { currentPage: number; totalPages: number; filters: { search: string; category: string; difficulty: string } }) {
  const pages = pageWindow(currentPage, totalPages);
  return <nav className="pagination" aria-label="Phân trang bài viết">{currentPage > 1 && <Link href={filterHref({ ...filters, page: currentPage - 1 })} rel="prev">← Trước</Link>}<div>{pages.map((page) => <Link key={page} href={filterHref({ ...filters, page })} className={page === currentPage ? 'active' : undefined} aria-current={page === currentPage ? 'page' : undefined}>{page}</Link>)}</div>{currentPage < totalPages && <Link href={filterHref({ ...filters, page: currentPage + 1 })} rel="next">Sau →</Link>}</nav>;
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
