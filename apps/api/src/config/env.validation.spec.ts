import { validateEnvironment } from './env.validation';
import { describe, expect, it } from 'vitest';

const validEnvironment = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_NAME: 'to_toan',
  DB_USER: 'to_toan_app',
  DB_PASSWORD: 'secret',
};

describe('validateEnvironment', () => {
  it('áp dụng giá trị mặc định và chuyển kiểu cổng', () => {
    const result = validateEnvironment(validEnvironment);

    expect(result.NEST_PORT).toBe(3001);
    expect(result.DB_PORT).toBe(3306);
    expect(result.CORS_ORIGINS).toBe('http://localhost:5173');
  });

  it('từ chối cấu hình thiếu mật khẩu cơ sở dữ liệu', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, DB_PASSWORD: '' }),
    ).toThrow('DB_PASSWORD');
  });
});
