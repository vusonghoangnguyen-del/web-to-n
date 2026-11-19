import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link className="footer-logo" href="/">TỜ TOÁN</Link>
      <p>Đọc · Giải · Thảo luận cùng cộng đồng.</p>
      <p>© {new Date().getFullYear()} · Tờ Toán</p>
    </footer>
  );
}
