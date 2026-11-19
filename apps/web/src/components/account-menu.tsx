'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type User = { id: string; username: string; name: string; email: string; role: string };

export function AccountMenu({ initialUser }: { initialUser: User | null }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(initialUser);
  const [unread, setUnread] = useState(0);

  const refreshSession = useCallback(() => {
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        const current = result?.user ?? null;
        setUser(current);
        if (!current) { setUnread(0); return; }
        fetch('/api/v1/notifications', { credentials: 'include' })
          .then((response) => response.ok ? response.json() : { unreadCount: 0 })
          .then((notifications) => setUnread(Number(notifications.unreadCount ?? 0)))
          .catch(() => setUnread(0));
      })
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    refreshSession();
    window.addEventListener('auth-changed', refreshSession);
    return () => window.removeEventListener('auth-changed', refreshSession);
  }, [refreshSession]);

  async function logout() {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
    setUser(null);
    setUnread(0);
    window.dispatchEvent(new Event('auth-changed'));
    router.push('/');
    router.refresh();
  }

  if (!user) return <><Link className="plain-button" href="/dang-nhap">Đăng nhập</Link><Link className="ink-button publish-button" href="/dang-ky">Tạo tài khoản</Link></>;

  const canModerate = ['moderator', 'admin'].includes(user.role);
  return <details className="account-menu"><summary><span className="account-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span><span>{user.name}</span>{unread > 0 && <b aria-label={`${unread} thông báo chưa đọc`}>{unread > 9 ? '9+' : unread}</b>}</summary><div className="account-dropdown"><header><span className="account-avatar large" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>@{user.username} · {roleLabel(user.role)}</small></div></header><nav><Link href="/ho-so"><span>♙</span><span><strong>Thông tin tài khoản</strong><small>Bài đăng, lời giải và bài đã lưu</small></span><b>→</b></Link><Link href="/soan-bai"><span>＋</span><span><strong>Đăng bài toán</strong><small>Soạn bản nháp hoặc gửi tòa soạn</small></span><b>→</b></Link><Link href="/latex"><span>TeX</span><span><strong>Dự án LaTeX</strong><small>Soạn và lưu bản nháp main.tex</small></span><b>→</b></Link>{canModerate && <Link href="/admin"><span>⚑</span><span><strong>Bàn biên tập</strong><small>Duyệt bài và quản lý thảo luận</small></span><b>→</b></Link>}<Link href="/ho-so#thong-bao"><span>♢</span><span><strong>Thông báo</strong><small>{unread ? `${unread} thông báo chưa đọc` : 'Không có thông báo mới'}</small></span><b>→</b></Link><button type="button" onClick={logout}><span>↪</span><span><strong>Đăng xuất</strong><small>Kết thúc phiên trên thiết bị này</small></span><b>→</b></button></nav></div></details>;
}

function roleLabel(role: string) { return ({ admin: 'Admin', moderator: 'Điều hành viên', editor: 'Biên tập viên', reader: 'Reader' } as Record<string, string>)[role] ?? 'Reader'; }
