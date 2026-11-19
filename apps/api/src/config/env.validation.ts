type RawEnvironment = Record<string, unknown>;

export type ValidatedEnvironment = RawEnvironment & {
  NODE_ENV: string;
  NEST_PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  CORS_ORIGINS: string;
  APP_WEB_URL: string;
  MAIL_MODE: 'preview' | 'smtp';
  MAIL_HOST?: string;
  MAIL_PORT: number;
  MAIL_SECURE: boolean;
  MAIL_USER?: string;
  MAIL_PASSWORD?: string;
  MAIL_FROM: string;
  SESSION_TTL_DAYS: number;
  EMAIL_VERIFICATION_TTL_MINUTES: number;
};

function requireText(config: RawEnvironment, key: string): string {
  const value = config[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Biến môi trường ${key} là bắt buộc.`);
  }
  return value.trim();
}

function parsePort(value: unknown, fallback: number, key: string): number {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Biến môi trường ${key} phải là cổng hợp lệ.`);
  }
  return port;
}

function parsePositiveInteger(value: unknown, fallback: number, key: string): number {
  const result = Number(value ?? fallback);
  if (!Number.isInteger(result) || result < 1) {
    throw new Error(`Biến môi trường ${key} phải là số nguyên dương.`);
  }
  return result;
}

export function validateEnvironment(config: RawEnvironment): ValidatedEnvironment {
  const mailMode = config.MAIL_MODE === 'smtp' ? 'smtp' : 'preview';
  if (mailMode === 'smtp') requireText(config, 'MAIL_HOST');

  return {
    ...config,
    NODE_ENV:
      typeof config.NODE_ENV === 'string' && config.NODE_ENV.trim()
        ? config.NODE_ENV.trim()
        : 'development',
    NEST_PORT: parsePort(config.NEST_PORT, 3001, 'NEST_PORT'),
    DB_HOST: requireText(config, 'DB_HOST'),
    DB_PORT: parsePort(config.DB_PORT, 3306, 'DB_PORT'),
    DB_NAME: requireText(config, 'DB_NAME'),
    DB_USER: requireText(config, 'DB_USER'),
    DB_PASSWORD: requireText(config, 'DB_PASSWORD'),
    CORS_ORIGINS:
      typeof config.CORS_ORIGINS === 'string' && config.CORS_ORIGINS.trim()
        ? config.CORS_ORIGINS.trim()
        : 'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5174',
    APP_WEB_URL:
      typeof config.APP_WEB_URL === 'string' && config.APP_WEB_URL.trim()
        ? config.APP_WEB_URL.trim().replace(/\/$/, '')
        : 'http://127.0.0.1:5174',
    MAIL_MODE: mailMode,
    MAIL_HOST: typeof config.MAIL_HOST === 'string' ? config.MAIL_HOST.trim() : undefined,
    MAIL_PORT: parsePort(config.MAIL_PORT, 587, 'MAIL_PORT'),
    MAIL_SECURE: String(config.MAIL_SECURE ?? 'false').toLowerCase() === 'true',
    MAIL_USER: typeof config.MAIL_USER === 'string' ? config.MAIL_USER.trim() : undefined,
    MAIL_PASSWORD:
      typeof config.MAIL_PASSWORD === 'string' ? config.MAIL_PASSWORD : undefined,
    MAIL_FROM:
      typeof config.MAIL_FROM === 'string' && config.MAIL_FROM.trim()
        ? config.MAIL_FROM.trim()
        : 'Tờ Toán <no-reply@localhost>',
    SESSION_TTL_DAYS: parsePositiveInteger(config.SESSION_TTL_DAYS, 7, 'SESSION_TTL_DAYS'),
    EMAIL_VERIFICATION_TTL_MINUTES: parsePositiveInteger(
      config.EMAIL_VERIFICATION_TTL_MINUTES,
      60,
      'EMAIL_VERIFICATION_TTL_MINUTES',
    ),
  };
}
