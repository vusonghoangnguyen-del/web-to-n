import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';
import { JsonLogger } from './common/logger/json.logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(JsonLogger));
  configureApplication(app);
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('NEST_PORT');
  await app.listen(port, '127.0.0.1');
  app.get(JsonLogger).log(
    `NestJS API đang chạy tại http://127.0.0.1:${port}/api/v1`,
    'Bootstrap',
  );
}

void bootstrap();
