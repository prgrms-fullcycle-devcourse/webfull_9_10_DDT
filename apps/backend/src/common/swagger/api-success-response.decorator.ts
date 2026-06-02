import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * ResponseInterceptor의 표준 응답 봉투(statusCode/timestamp/path/message/data/error)에
 * `data`를 주어진 DTO로 타입화하여 문서화한다.
 * 인라인 example 대신 $ref를 사용하므로 orval 등 클라이언트 제너레이터가 타입을 생성할 수 있다.
 */
export const ApiSuccessResponse = <TModel extends Type<unknown>>(
  model: TModel,
  options: { status?: number; description?: string } = {},
) => {
  const status = options.status ?? 200;
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      description: options.description,
      schema: {
        allOf: [
          {
            properties: {
              statusCode: { type: 'number', example: status },
              timestamp: { type: 'string', format: 'date-time' },
              path: { type: 'string' },
              message: { type: 'string' },
              data: { $ref: getSchemaPath(model) },
              error: { type: 'string', nullable: true, example: null },
            },
          },
        ],
      },
    }),
  );
};
