import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class JsonLogger implements LoggerService {
  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  private write(
    level: string,
    message: unknown,
    context?: string,
    trace?: string,
  ): void {
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      context,
      message: message instanceof Error ? message.message : message,
      ...(trace ? { trace } : {}),
    });

    if (level === 'error') {
      process.stderr.write(`${entry}\n`);
      return;
    }
    process.stdout.write(`${entry}\n`);
  }
}
