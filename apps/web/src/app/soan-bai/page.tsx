import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProblemEditor } from '@/components/problem-editor';

export const metadata: Metadata = { title: 'Bàn soạn bài', description: 'Soạn, lưu nháp và gửi bài toán tới tòa soạn Tờ Toán.' };

export default function EditorPage() { return <main className="editor-page page-shell"><Suspense fallback={<p>Đang mở bàn soạn…</p>}><ProblemEditor /></Suspense></main>; }
