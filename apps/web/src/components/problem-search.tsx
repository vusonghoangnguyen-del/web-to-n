import { UiIcon } from './ui-icon';

export function ProblemSearch({ search = '', category = 'all', difficulty = '', id = 'problem-search' }: { search?: string; category?: string; difficulty?: string; id?: string }) {
  return <form className="catalog-search" action="/bai-toan" method="get" role="search"><label className="visually-hidden" htmlFor={id}>Tìm bài viết</label><UiIcon name="search" /><input id={id} name="search" type="search" defaultValue={search} maxLength={100} placeholder="Tìm theo tiêu đề hoặc nội dung…" />{category !== 'all' && <input type="hidden" name="category" value={category} />}{difficulty && <input type="hidden" name="difficulty" value={difficulty} />}<button type="submit" className="ink-button">Tìm bài</button></form>;
}
