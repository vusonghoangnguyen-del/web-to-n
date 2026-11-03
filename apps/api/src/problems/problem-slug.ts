const VIETNAMESE_D = /đ/g;
const VIETNAMESE_UPPER_D = /Đ/g;

export function toSlugBase(title: string): string {
  const slug = title
    .replace(VIETNAMESE_D, 'd')
    .replace(VIETNAMESE_UPPER_D, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 240)
    .replace(/-+$/g, '');
  return slug || 'bai-toan';
}
