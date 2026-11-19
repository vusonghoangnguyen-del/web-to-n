import type { Metadata } from 'next';
import { LatexWorkspace } from '@/components/latex-workspace';

export const metadata: Metadata = {
  title: 'Dự án LaTeX',
  description: 'Soạn thảo và quản lý bản nháp LaTeX trên Tờ Toán.',
  robots: { index: false, follow: false },
};

export default function LatexPage() {
  return <LatexWorkspace />;
}
