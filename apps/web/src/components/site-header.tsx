'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AccountMenu } from './account-menu';
import { UiIcon } from './ui-icon';

const navigation = [
  { href: '/', label: 'Trang nhất' },
  { href: '/bai-toan', label: 'Bài viết' },
  { href: '/#loi-giai', label: 'Lời giải' },
  { href: '/#video', label: 'Video' },
  { href: '/ho-so', label: 'Hồ sơ' },
];

export function SiteHeader({ initialUser }: { initialUser: { id: string; username: string; name: string; email: string; role: string } | null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <p>Tạp chí toán học cộng đồng</p>
          <div className="account-actions">
            <AccountMenu initialUser={initialUser} />
          </div>
        </div>
      </header>
      <header className="masthead">
        <button className="mobile-menu" type="button" aria-expanded={menuOpen} aria-controls="main-nav" onClick={() => setMenuOpen((open) => !open)}>
          <UiIcon name="menu" /> {menuOpen ? 'Đóng' : 'Mục lục'}
        </button>
        <Link className="logo" href="/" aria-label="Tờ Toán — về trang chủ">
          <strong>TỜ TOÁN</strong>
        </Link>
        <p className="masthead-description">Bài viết · Lời giải · Thảo luận</p>
      </header>
      <nav id="main-nav" className={`main-nav${menuOpen ? ' open' : ''}`} aria-label="Điều hướng">
        {navigation.map((item) => (
          <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={pathname === item.href || (item.href === '/bai-toan' && pathname.startsWith('/bai-toan/')) ? 'active' : undefined} aria-current={pathname === item.href ? 'page' : undefined}>
            {item.label}
          </Link>
        ))}
        <Link className="nav-contribute" href="/soan-bai" onClick={() => setMenuOpen(false)}><UiIcon name="plus" /> Gửi bài</Link>
      </nav>
    </>
  );
}
