import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  connectTimeout: 2000,
  maxRetriesPerRequest: 0,
});
try {
  const lastSeen = Number(await redis.get('latex-worker:heartbeat'));
  if (!lastSeen || Date.now() - lastSeen > 30_000) process.exitCode = 1;
} catch {
  process.exitCode = 1;
} finally {
  redis.disconnect();
}
