import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';
import { JsonLogger } from './common/logger/json.logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useBodyParser('json', { limit: '5mb' });
  app.useLogger(app.get(JsonLogger));
  const logger = app.get(JsonLogger);
  const config = app.get(ConfigService);
  if (config.getOrThrow<string>('NODE_ENV') === 'production') {
    // Caddy is the only public entry point and forwards the client address to API.
    app.set('trust proxy', 1);
  }
  app.use((request: Request, response: Response, next: NextFunction) => {
    const started = performance.now();
    response.on('finish', () => {
      if (request.path === '/api/v1/health') return;
      const event = {
        event: 'http_request',
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Math.round(performance.now() - started),
      };
      if (response.statusCode >= 500) logger.error(event, undefined, 'HTTP');
      else if (response.statusCode >= 400) logger.warn(event, 'HTTP');
      else logger.log(event, 'HTTP');
    });
    next();
  });
  configureApplication(app);
  app.enableShutdownHooks();

  const port = config.getOrThrow<number>('NEST_PORT');
  const host = config.get<string>('NEST_HOST') || '127.0.0.1';
  await app.listen(port, host);
  app.get(JsonLogger).log(
    `NestJS API đang chạy tại http://${host}:${port}/api/v1`,
    'Bootstrap',
  );
}

void bootstrap();
