import { applyDecorators, HttpCode } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ZodSerializerDto, type ZodDto } from 'nestjs-zod';

export interface ApiEnvelopeOptions {
  status?: number;
  list?: boolean;
  /** The handler returns a `Paged` — `data` is documented as a list, plus a `meta` page block. */
  paged?: boolean;
}

/**
 * Documents the response envelope (`{ data }`, or `{ data, meta }` for `paged`) around a
 * DTO and attaches it as the route's `@ZodSerializerDto` schema, so OpenAPI and
 * `ResponseValidationInterceptor` read the same definition (conventions §6.5).
 */
export function ApiEnvelope(
  dto: ZodDto,
  { status = 200, list = false, paged = false }: ApiEnvelopeOptions = {},
) {
  const isList = list || paged;
  return applyDecorators(
    ZodSerializerDto(isList ? [dto] : dto),
    ApiExtraModels(dto),
    HttpCode(status),
    ApiResponse({
      status,
      schema: {
        properties: {
          data: isList
            ? { type: 'array', items: { $ref: getSchemaPath(dto) } }
            : { $ref: getSchemaPath(dto) },
          ...(paged && {
            meta: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                pageSize: { type: 'integer' },
                total: { type: 'integer' },
              },
              required: ['page', 'pageSize', 'total'],
            },
          }),
        },
      },
    }),
  );
}
