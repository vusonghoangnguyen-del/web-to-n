export type PublicProblem = {
  id: string;
  slug: string;
  title: string;
  body: string;
  latexPdfUrl: string | null;
  source: string | null;
  difficulty: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; username: string; name: string };
  categories: Array<{ name: string; slug: string }>;
  commentCount: number;
};

export type FeaturedSolution = {
  id: string;
  problem_id: string;
  problem_slug: string;
  problem_title: string;
  author_name: string;
  excerpt: string;
};

export type PublicVideo = {
  id: number;
  title: string;
  topic: string;
  duration: string;
  url: string;
};

export type ProblemsResponse = {
  problems: PublicProblem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export type PublicSolution = {
  id: string;
  problemId: string;
  content: string;
  status: string;
  edited: boolean;
  reviewNote: string | null;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; username: string; name: string; role: string };
};

export type PublicComment = {
  id: string;
  problemId: string;
  parentId: string | null;
  content: string;
  deleted: boolean;
  edited: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; username: string; name: string; role: string };
};

export type ProblemEngagement = {
  problemId: string;
  reactionCount: number;
  followerCount: number;
  solutionReactions: Record<string, number>;
};

export type ProblemPageData = {
  problem: PublicProblem | null;
  solutions: PublicSolution[];
  comments: PublicComment[];
  engagement: ProblemEngagement;
  available: boolean;
  notFound: boolean;
};
type FeaturedSolutionsResponse = { solutions: FeaturedSolution[] };
type VideosResponse = { videos: PublicVideo[] };

const nestApiUrl = process.env.NEST_API_URL ?? 'http://127.0.0.1:3001';

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { next: { revalidate: 60 } });
  if (!response.ok) throw new Error(`API trả về HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export async function getHomeData() {
  const [problemsResult, solutionsResult, videosResult] = await Promise.allSettled([
    readJson<ProblemsResponse>(`${nestApiUrl}/api/v1/problems?page=1&limit=12`),
    readJson<FeaturedSolutionsResponse>(`${nestApiUrl}/api/v1/community/featured-solutions`),
    readJson<VideosResponse>(`${nestApiUrl}/api/v1/community/videos`),
  ]);

  return {
    problems: problemsResult.status === 'fulfilled' ? problemsResult.value.problems : [],
    totalProblems: problemsResult.status === 'fulfilled' ? problemsResult.value.total : 0,
    featuredSolutions: solutionsResult.status === 'fulfilled' ? solutionsResult.value.solutions : [],
    videos: videosResult.status === 'fulfilled' ? videosResult.value.videos.filter((video) => isSafeHttpUrl(video.url)) : [],
    problemsAvailable: problemsResult.status === 'fulfilled',
  };
}

export type ProblemFilters = {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  difficulty?: string;
};

export async function getProblems(filters: ProblemFilters): Promise<ProblemsResponse & { available: boolean }> {
  const parameters = new URLSearchParams({
    page: String(filters.page ?? 1),
    limit: String(filters.limit ?? 12),
  });
  if (filters.search) parameters.set('search', filters.search);
  if (filters.category && filters.category !== 'all') parameters.set('category', filters.category);
  if (filters.difficulty) parameters.set('difficulty', filters.difficulty);

  try {
    const result = await readJson<ProblemsResponse>(`${nestApiUrl}/api/v1/problems?${parameters}`);
    return { ...result, available: true };
  } catch {
    return {
      problems: [], page: filters.page ?? 1, limit: filters.limit ?? 12,
      total: 0, totalPages: 0, hasMore: false, available: false,
    };
  }
}

export async function getProblemPageData(identifier: string): Promise<ProblemPageData> {
  const response = await fetch(`${nestApiUrl}/api/v1/problems/${encodeURIComponent(identifier)}`, {
    cache: 'no-store',
  }).catch(() => null);

  if (!response) return emptyProblemPage(false, false);
  if (response.status === 404) return emptyProblemPage(true, true);
  if (!response.ok) return emptyProblemPage(false, false);

  const detail = await response.json() as { problem: PublicProblem };
  const problem = detail.problem;
  const [solutionsResult, commentsResult, engagementResult] = await Promise.allSettled([
    readJsonNoStore<{ solutions: PublicSolution[] }>(`${nestApiUrl}/api/v1/problems/${problem.id}/solutions?page=1&limit=100`),
    readJsonNoStore<{ comments: PublicComment[] }>(`${nestApiUrl}/api/v1/problems/${problem.id}/comments?page=1&limit=100`),
    readJsonNoStore<ProblemEngagement>(`${nestApiUrl}/api/v1/problems/${problem.id}/engagement`),
  ]);

  return {
    problem,
    solutions: solutionsResult.status === 'fulfilled' ? solutionsResult.value.solutions : [],
    comments: commentsResult.status === 'fulfilled' ? commentsResult.value.comments : [],
    engagement: engagementResult.status === 'fulfilled'
      ? engagementResult.value
      : { problemId: problem.id, reactionCount: 0, followerCount: 0, solutionReactions: {} },
    available: true,
    notFound: false,
  };
}

export function problemHref(problem: Pick<PublicProblem, 'slug'>): string {
  return `/bai-toan/${encodeURIComponent(problem.slug)}`;
}

async function readJsonNoStore<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`API trả về HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function emptyProblemPage(available: boolean, notFound: boolean): ProblemPageData {
  return {
    problem: null,
    solutions: [],
    comments: [],
    engagement: { problemId: '', reactionCount: 0, followerCount: 0, solutionReactions: {} },
    available,
    notFound,
  };
}

function isSafeHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
