import type { Metadata } from 'next';
import { ProfileDashboard } from '@/components/profile-dashboard';

export const metadata: Metadata = { title: 'Hồ sơ cá nhân', description: 'Quản lý bài toán, lời giải, bài đã lưu, bài đang theo dõi và thông báo của bạn.' };

export default function ProfilePage() { return <main className="profile-page page-shell"><ProfileDashboard /></main>; }
