import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ERRORS, type ErrorCode } from '@brewlite/contracts';

/** Documents the error codes only this route can return (conventions §6.5). */
export function ApiErrors(...codes: ErrorCode[]) {
  return applyDecorators(
    ...codes.map((code) =>
      ApiResponse({
        status: ERRORS[code].http,
        description: code,
        schema: {
          properties: {
            error: {
              properties: {
                code: { type: 'string', example: code },
                message: { type: 'string' },
                requestId: { type: 'string' },
              },
            },
          },
        },
      }),
    ),
  );
}
