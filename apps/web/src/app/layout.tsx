import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5174'),
  title: { default: 'Tờ Toán — Cộng đồng yêu toán', template: '%s — Tờ Toán' },
  description: 'Đọc, gửi lời giải và cùng thảo luận những bài toán hay.',
  applicationName: 'Tờ Toán',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'Tờ Toán',
    title: 'Tờ Toán — Cộng đồng yêu toán',
    description: 'Mỗi bài toán, một cách nhìn mới.',
  },
};

export const viewport: Viewport = { themeColor: '#f2efe5', colorScheme: 'light' };

type SessionUser = { id: string; username: string; name: string; email: string; role: string };

async function getCurrentUser(): Promise<SessionUser | null> {
  const session = (await cookies()).get('to_toan_session');
  if (!session) return null;

  try {
    const apiUrl = process.env.NEST_API_URL ?? 'http://127.0.0.1:3001';
    const response = await fetch(`${apiUrl}/api/v1/auth/me`, {
      headers: { cookie: `${session.name}=${session.value}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = await response.json() as { user?: SessionUser };
    return data.user ?? null;
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const initialUser = await getCurrentUser();
  return (
    <html lang="vi">
      <body>
        <a className="skip-link" href="#noi-dung">Đi tới nội dung</a>
        <div className="paper-noise" aria-hidden="true" />
        <SiteHeader initialUser={initialUser} />
        <main id="noi-dung">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
