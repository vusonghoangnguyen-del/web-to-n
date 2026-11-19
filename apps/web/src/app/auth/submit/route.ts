import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const requestedReturn = String(form.get('return') ?? '');
  const base = process.env.NEST_API_URL ?? 'http://127.0.0.1:3001';

  if (!email || !password) return redirectTo('/dang-nhap?error=invalid');

  try {
    const upstream = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
    if (!upstream.ok) {
      const error = upstream.status === 403 ? 'unverified' : upstream.status >= 500 ? 'unavailable' : 'invalid';
      return redirectTo(`/dang-nhap?error=${error}`);
    }

    const data = await upstream.json() as { user?: { role?: string } };
    const defaultPath = ['admin', 'moderator'].includes(data.user?.role ?? '') ? '/admin' : '/';
    const returnPath = requestedReturn.startsWith('/') && !requestedReturn.startsWith('//') && !requestedReturn.includes('\\')
      ? requestedReturn
      : defaultPath;
    const response = redirectTo(returnPath);
    const cookie = upstream.headers.get('set-cookie');
    if (cookie) response.headers.set('set-cookie', cookie);
    return response;
  } catch {
    return redirectTo('/dang-nhap?error=unavailable');
  }
}

function redirectTo(path: string) {
  return new Response(null, { status: 303, headers: { location: path } });
}
