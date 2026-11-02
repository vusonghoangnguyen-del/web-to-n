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

export function validateEnvironment(config: RawEnvironment): ValidatedEnvironment {
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
        : 'http://localhost:5173',
  };
}
