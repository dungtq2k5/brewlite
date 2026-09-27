import { applyDecorators, HttpCode } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ZodSerializerDto, type ZodDto } from 'nestjs-zod';

export interface ApiEnvelopeOptions {
  status?: number;
  list?: boolean;
}

/**
 * Documents the response envelope (`{ data }`) around a DTO and attaches it as the
 * route's `@ZodSerializerDto` schema, so OpenAPI and `ResponseValidationInterceptor`
 * read the same definition (conventions §6.5).
 */
export function ApiEnvelope(dto: ZodDto, { status = 200, list = false }: ApiEnvelopeOptions = {}) {
  return applyDecorators(
    ZodSerializerDto(list ? [dto] : dto),
    ApiExtraModels(dto),
    HttpCode(status),
    ApiResponse({
      status,
      schema: {
        properties: {
          data: list
            ? { type: 'array', items: { $ref: getSchemaPath(dto) } }
            : { $ref: getSchemaPath(dto) },
        },
      },
    }),
  );
}
