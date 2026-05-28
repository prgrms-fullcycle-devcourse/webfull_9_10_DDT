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

function isStandardResponse(value: unknown): value is StandardResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    'timestamp' in value &&
    'path' in value
  );
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((res: unknown): StandardResponse => {
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
