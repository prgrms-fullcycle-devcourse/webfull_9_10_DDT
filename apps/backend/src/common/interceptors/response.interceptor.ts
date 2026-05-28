import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request, Response } from 'express';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((res) => {
        if (res && res.statusCode && res.timestamp && res.path !== undefined) {
          return res;
        }

        const message = res?.message || '요청이 성공적으로 처리되었습니다.';
        const data = res?.data !== undefined ? res.data : res;

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