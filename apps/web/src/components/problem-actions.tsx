'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UiIcon } from './ui-icon';

type Mine = { bookmarked: boolean; followed: boolean; problemLiked: boolean };

export function ProblemActions({ problemId, initialLikes, initialFollowers }: { problemId: string; initialLikes: number; initialFollowers: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [mine, setMine] = useState<Mine>({ bookmarked: false, followed: false, problemLiked: false });
  const [likes, setLikes] = useState(initialLikes);
  const [followers, setFollowers] = useState(initialFollowers);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error();
        setAuthenticated(true);
        return fetch(`/api/v1/problems/${problemId}/engagement/mine`, { credentials: 'include' });
      })
      .then((response) => response.json())
      .then((value: Mine) => setMine(value))
      .catch(() => setAuthenticated(false));
  }, [problemId]);

  function requireAccount(): boolean {
    if (authenticated) return true;
    router.push(`/dang-nhap?return=${encodeURIComponent(pathname)}`);
    return false;
  }

  async function toggle(kind: 'bookmark' | 'like' | 'follow') {
    if (!requireAccount()) return;
    setBusy(kind);
    setMessage('');
    const active = kind === 'bookmark' ? mine.bookmarked : kind === 'like' ? mine.problemLiked : mine.followed;
    const path = kind === 'bookmark'
      ? `/api/v1/bookmarks/${problemId}`
      : kind === 'like'
        ? `/api/v1/problems/${problemId}/reaction`
        : `/api/v1/follows/problems/${problemId}`;
    try {
      const response = await fetch(path, { method: active ? 'DELETE' : 'PUT', credentials: 'include' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Không thể thực hiện thao tác.');
      setMine((current) => ({
        ...current,
        bookmarked: kind === 'bookmark' ? !active : current.bookmarked,
        problemLiked: kind === 'like' ? !active : current.problemLiked,
        followed: kind === 'follow' ? !active : current.followed,
      }));
      if (kind === 'like') setLikes(Number(result.reactionCount ?? likes + (active ? -1 : 1)));
      if (kind === 'follow') setFollowers(Number(result.followerCount ?? followers + (active ? -1 : 1)));
      setMessage(kind === 'bookmark' ? (!active ? 'Đã lưu bài viết.' : 'Đã bỏ lưu bài viết.') : 'Đã cập nhật.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể thực hiện thao tác.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="detail-actions" aria-label="Tương tác với bài viết">
      <button type="button" aria-pressed={mine.bookmarked} disabled={busy !== null} onClick={() => toggle('bookmark')}><UiIcon name="bookmark" />{mine.bookmarked ? 'Đã lưu' : 'Lưu bài'}</button>
      <button type="button" aria-pressed={mine.problemLiked} disabled={busy !== null} onClick={() => toggle('like')}><UiIcon name="heart" />{mine.problemLiked ? 'Đã thích' : 'Thích'} ({likes})</button>
      <button type="button" aria-pressed={mine.followed} disabled={busy !== null} onClick={() => toggle('follow')}><UiIcon name="plus" />{mine.followed ? 'Đang theo dõi' : 'Theo dõi'} ({followers})</button>
      <span role="status">{message}</span>
    </div>
  );
}
