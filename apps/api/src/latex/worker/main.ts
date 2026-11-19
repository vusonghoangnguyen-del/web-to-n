import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import dataSource from '../../database/data-source';
import { LatexBuildEntity, LatexBuildStatus } from '../../database/entities/latex-build.entity';
import { latexMaxLogChars, latexQueueName, latexRedisUrl } from '../build-config';
import { compileContainer } from './compile-container';

async function main() {
  await dataSource.initialize();
  const builds = dataSource.getRepository(LatexBuildEntity);
  const connection = new IORedis(latexRedisUrl(), { maxRetriesPerRequest: null });
  connection.on('error', (error) => console.error('Redis:', error.message));
  const worker = new Worker<{ buildId: string }>(latexQueueName, async (job) => {
    const build = await builds.createQueryBuilder('build')
      .addSelect(['build.sourceSnapshot', 'build.sourceArchive'])
      .where('build.id = :id', { id: job.data.buildId })
      .getOne();
    if (!build || [LatexBuildStatus.Success, LatexBuildStatus.Failed, LatexBuildStatus.Cancelled].includes(build.status)) return;
    await builds.update(build.id, { status: LatexBuildStatus.Compiling, startedAt: new Date() });
    try {
      const result = await compileContainer({
        projectId: build.projectId,
        buildId: build.id,
        compiler: build.compiler,
        source: build.sourceSnapshot,
        archive: build.sourceArchive,
      });
      await builds.update(build.id, {
        status: result.success ? LatexBuildStatus.Success : LatexBuildStatus.Failed,
        pdfPath: result.pdfPath,
        compileLog: result.log,
        errorMessage: result.errorMessage,
        completedAt: new Date(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await builds.update(build.id, {
        status: LatexBuildStatus.Failed,
        errorMessage: `Lỗi worker: ${message}`.slice(0, 500),
        compileLog: message.slice(0, latexMaxLogChars),
        completedAt: new Date(),
      });
    }
  }, { connection, concurrency: 1 });

  worker.on('completed', (job) => console.log(`LaTeX build ${job.data.buildId} completed`));
  worker.on('failed', (job, error) => console.error(`LaTeX build ${job?.data.buildId || '?'} failed: ${error.message}`));
  worker.on('error', (error) => console.error('LaTeX worker:', error.message));
  console.log('LaTeX worker ready');

  const shutdown = async () => {
    await worker.close();
    connection.disconnect();
    await dataSource.destroy();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
