import { describe, expect, it } from 'vitest';
import { toSlugBase } from './problem-slug';

describe('toSlugBase', () => {
  it('chuyển tiêu đề tiếng Việt thành slug ổn định', () => {
    expect(toSlugBase('Định lý Viète và phương trình bậc 2')).toBe(
      'dinh-ly-viete-va-phuong-trinh-bac-2',
    );
  });

  it('dùng slug dự phòng khi tiêu đề không có ký tự chữ hoặc số', () => {
    expect(toSlugBase('---')).toBe('bai-toan');
  });
});
