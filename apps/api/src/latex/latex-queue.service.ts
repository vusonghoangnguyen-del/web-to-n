import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { latexQueueName, latexRedisUrl } from './build-config';

@Injectable()
export class LatexQueueService {
  async enqueue(buildId: string): Promise<void> {
    const connection = new IORedis(latexRedisUrl(), {
      lazyConnect: true,
      connectTimeout: 3_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    connection.on('error', () => { /* Error is surfaced by connect/add. */ });
    let queue: Queue | undefined;
    try {
      await connection.connect();
      queue = new Queue(latexQueueName, { connection });
      await queue.add('compile', { buildId }, {
        jobId: `build-${buildId}`,
        attempts: 1,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      });
    } finally {
      await queue?.close().catch(() => {});
      connection.disconnect();
    }
  }
}
