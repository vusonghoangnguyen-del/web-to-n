'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AccountMenu } from './account-menu';

const navigation = [
  { href: '/', label: 'Trang nhất' },
  { href: '/bai-toan', label: 'Bài toán' },
  { href: '/loi-giai', label: 'Lời giải' },
  { href: '/video', label: 'Video' },
  { href: '/ho-so', label: 'Hồ sơ' },
];

export function SiteHeader({ initialUser }: { initialUser: { id: string; username: string; name: string; email: string; role: string } | null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <p>Tờ Toán</p>
          <p className="edition">Bài toán · Lời giải · Thảo luận</p>
          <div className="account-actions">
            <AccountMenu initialUser={initialUser} />
          </div>
        </div>
      </header>
      <header className="masthead">
        <button className="mobile-menu" type="button" aria-expanded={menuOpen} aria-controls="main-nav" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? 'Đóng' : 'Mục lục'}
        </button>
        <Link className="logo" href="/" aria-label="Tờ Toán — về trang chủ">
          <span className="logo-kicker">Tạp chí cộng đồng</span>
          <strong>TỜ TOÁN</strong>
          <span className="logo-sub">Mỗi bài toán · Một cách nhìn mới</span>
        </Link>
        <div className="masthead-mark" aria-hidden="true">∑</div>
      </header>
      <nav id="main-nav" className={`main-nav${menuOpen ? ' open' : ''}`} aria-label="Điều hướng">
        {navigation.map((item) => (
          <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : undefined} aria-current={pathname === item.href ? 'page' : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
