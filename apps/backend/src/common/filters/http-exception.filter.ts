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

/**
 * 모든 예외를 가로채 프로젝트 표준 실패 응답 형식으로 변환하는 전역 예외 필터입니다.
 * (statusCode/timestamp/path/message/data/error 형태로 통일)
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /**
   * 발생한 예외를 표준 실패 응답으로 직렬화해 클라이언트에 반환합니다.
   * @param {unknown} exception - 처리할 예외 객체 (HttpException 또는 그 외)
   * @param {ArgumentsHost} host - 현재 실행 컨텍스트(요청/응답 접근용)
   * @returns {void}
   */
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

      // class-validator는 message를 배열로 던지므로, 사용자에겐 첫 메시지만 노출한다.
      message = Array.isArray(exceptionResponse.message)
        ? exceptionResponse.message[0]
        : (exceptionResponse.message ?? exception.message);

      errorCode = STATUS_ERROR_CODE[status] ?? 'UNKNOWN_ERROR';

      // 예외가 명시적 error 코드를 담고 있으면 상태코드 기본 매핑보다 우선 적용
      if (typeof exceptionResponse.error === 'string') {
        errorCode = exceptionResponse.error;
      }
    } else {
      // HttpException이 아닌 예기치 못한 오류는 원인 추적을 위해 서버 로그에 남긴다.
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
