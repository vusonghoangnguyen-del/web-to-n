import type { Metadata } from 'next';
import { AdminDashboard } from '@/components/admin-dashboard';

export const metadata: Metadata = {
  title: 'Bàn biên tập',
  description: 'Kiểm duyệt bài toán, lời giải và thảo luận của Tờ Toán.',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminDashboard />;
}
