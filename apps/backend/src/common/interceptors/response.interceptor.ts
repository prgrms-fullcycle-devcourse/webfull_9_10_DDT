import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request, Response } from 'express';

interface StandardResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  data: unknown;
  error: unknown;
}

interface ControllerResult {
  message?: string;
  data?: unknown;
}

/**
 * 컨트롤러 반환값이 이미 표준 응답 형식(statusCode/timestamp/path 포함)인지 판별합니다.
 * @param {unknown} value - 검사할 컨트롤러 반환값
 * @returns {boolean} 표준 응답 형식이면 true
 */
function isStandardResponse(value: unknown): value is StandardResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    'timestamp' in value &&
    'path' in value
  );
}

/**
 * 모든 성공 응답을 프로젝트 표준 형식(statusCode/timestamp/path/message/data/error)으로 감싸는 인터셉터입니다.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  /**
   * 컨트롤러 반환값을 표준 성공 응답 형식으로 변환합니다.
   * @param {ExecutionContext} context - 현재 실행 컨텍스트(요청/응답 접근용)
   * @param {CallHandler} next - 다음 핸들러(컨트롤러 실행 스트림)
   * @returns {Observable<StandardResponse>} 표준 형식으로 매핑된 응답 스트림
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((res: unknown): StandardResponse => {
        // 이미 표준 형식이면(예: 직접 형식을 구성한 컨트롤러) 이중 래핑하지 않고 그대로 통과
        if (isStandardResponse(res)) {
          return res;
        }

        const result = (res ?? {}) as ControllerResult;
        const message = result.message ?? '요청이 성공적으로 처리되었습니다.';
        const data = result.data !== undefined ? result.data : (res ?? null);

        return {
          statusCode: response.statusCode,
          timestamp: new Date().toISOString(),
          path: request.url,
          message,
          data: data === undefined ? null : data,
          error: null,
        };
      }),
    );
  }
}
