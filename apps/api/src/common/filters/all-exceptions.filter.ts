import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const context = host.switchToHttp();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const response =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const request = context.getRequest<{ originalUrl?: string; url: string }>();

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Lỗi máy chủ không xác định',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    httpAdapter.reply(
      context.getResponse(),
      {
        statusCode: status,
        message: this.extractMessage(response, status),
        path: request.originalUrl ?? request.url,
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }

  private extractMessage(response: unknown, status: number): string | string[] {
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object' && 'message' in response) {
      const message = (response as { message: unknown }).message;
      if (typeof message === 'string' || Array.isArray(message)) return message as string | string[];
    }
    return status === HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Đã xảy ra lỗi phía máy chủ.'
      : 'Yêu cầu không hợp lệ.';
  }
}
