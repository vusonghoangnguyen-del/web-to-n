import type { Metadata } from 'next';
import { VerifyEmailStatus } from '@/components/verify-email-status';

export const metadata: Metadata = { title: 'Xác minh email', description: 'Xác minh địa chỉ email và kích hoạt tài khoản Tờ Toán.' };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parameters = await searchParams;
  const token = Array.isArray(parameters.token) ? parameters.token[0] ?? '' : parameters.token ?? '';
  return <main className="verification-page page-shell"><section className="verification-card compact"><span className="eyebrow">Tài khoản Tờ Toán</span><h1>Xác minh email</h1><VerifyEmailStatus token={token.slice(0, 256)} /></section></main>;
}
