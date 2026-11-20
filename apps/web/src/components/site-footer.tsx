import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link className="footer-logo" href="/">TỜ TOÁN</Link>
      <p>Bài viết · Lời giải · Thảo luận</p>
      <p>© {new Date().getFullYear()} · Tờ Toán</p>
    </footer>
  );
}
