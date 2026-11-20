import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProblemEditor } from '@/components/problem-editor';
import { LatexWorkspace } from '@/components/latex-workspace';

export const metadata: Metadata = { title: 'Bàn soạn bài', description: 'Soạn, lưu nháp và gửi bài viết toán học tới tòa soạn Tờ Toán.' };

export default async function EditorPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  if (!id) return <LatexWorkspace />;
  return <main className="editor-page page-shell"><Suspense fallback={<p>Đang mở bàn soạn…</p>}><ProblemEditor /></Suspense></main>;
}
