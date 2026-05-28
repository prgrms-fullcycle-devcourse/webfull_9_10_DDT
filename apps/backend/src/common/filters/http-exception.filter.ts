import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ExceptionResponseShape {
  message?: string | string[];
  error?: string;
}

const STATUS_ERROR_CODE: Record<number, string> = {
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.BAD_REQUEST]: 'INVALID_REQUEST',
};

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
      const res = exception.getResponse();
      const exceptionResponse: ExceptionResponseShape =
        typeof res === 'object' && res !== null
          ? res
          : { message: String(res) };

      message = Array.isArray(exceptionResponse.message)
        ? exceptionResponse.message[0]
        : (exceptionResponse.message ?? exception.message);

      errorCode = STATUS_ERROR_CODE[status] ?? 'UNKNOWN_ERROR';

      if (typeof exceptionResponse.error === 'string') {
        errorCode = exceptionResponse.error;
      }
    } else {
      this.logger.error(
        `[Unhandled Exception] ${request.method} ${request.url}`,
        exception,
      );
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
