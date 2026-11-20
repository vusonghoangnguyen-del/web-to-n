type IconName = 'search' | 'arrow-right' | 'bookmark' | 'heart' | 'plus' | 'play' | 'menu';

const paths: Record<IconName, string> = {
  search: 'M21 21l-5-5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  'arrow-right': 'M4 12h16m-6-6 6 6-6 6',
  bookmark: 'M6 3h12v18l-6-4-6 4V3Z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  plus: 'M12 4v16M4 12h16',
  play: 'm8 4 12 8-12 8V4Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
};

export function UiIcon({ name }: { name: IconName }) {
  return <svg className="ui-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
