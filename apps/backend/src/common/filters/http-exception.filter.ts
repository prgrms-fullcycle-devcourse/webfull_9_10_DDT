import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = '서버 내부 오류가 발생했습니다.';
    let errorCode = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse() as any;

      message = Array.isArray(exceptionResponse.message)
        ? exceptionResponse.message[0]
        : exceptionResponse.message || exception.message;

      switch (status) {
        case HttpStatus.UNAUTHORIZED:
          errorCode = 'UNAUTHORIZED';
          break;
        case HttpStatus.FORBIDDEN:
          errorCode = 'FORBIDDEN';
          break;
        case HttpStatus.NOT_FOUND:
          errorCode = 'NOT_FOUND';
          break;
        case HttpStatus.BAD_REQUEST:
          errorCode = 'INVALID_REQUEST';
          break;
        default:
          errorCode = exceptionResponse.error || 'UNKNOWN_ERROR';
      }

      if (exceptionResponse.error && typeof exceptionResponse.error === 'string') {
        errorCode = exceptionResponse.error;
      }
    } else {
      this.logger.error(`[Unhandled Exception] ${request.method} ${request.url}`, exception);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      data: null,
      error: errorCode,
    });
  }
}