import { applyDecorators, HttpCode } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ZodSerializerDto, type ZodDto } from 'nestjs-zod';

export interface ApiEnvelopeOptions {
  status?: number;
  /**
   * Further success statuses the handler can answer with the same body — a create route that
   * returns `200` when it replays an existing result documents `{ status: 201, alsoStatus: [200] }`.
   */
  alsoStatus?: readonly number[];
  list?: boolean;
  /** The handler returns a `Paged` — `data` is documented as a list, plus a `meta` page block. */
  paged?: boolean;
  /** The handler returns a `Paged.cursor` — `data` is a list, plus a `meta.nextCursor` block. */
  cursor?: boolean;
}

/**
 * Documents the response envelope (`{ data }`, `{ data, meta }` for `paged`/`cursor`)
 * around a DTO and attaches it as the route's `@ZodSerializerDto` schema, so OpenAPI and
 * `ResponseValidationInterceptor` read the same definition (conventions §6.5).
 */
export function ApiEnvelope(
  dto: ZodDto,
  {
    status = 200,
    alsoStatus = [],
    list = false,
    paged = false,
    cursor = false,
  }: ApiEnvelopeOptions = {},
) {
  const isList = list || paged || cursor;
  return applyDecorators(
    ZodSerializerDto(isList ? [dto] : dto),
    ApiExtraModels(dto),
    HttpCode(status),
    ...[status, ...alsoStatus].map((code) =>
      ApiResponse({
        status: code,
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
            ...(cursor && {
              meta: {
                type: 'object',
                // OpenAPI 3.1 (`type: [.., "null"]`) — Nest's typings still describe 3.0.
                properties: { nextCursor: { type: ['string', 'null'] } as never },
                required: ['nextCursor'],
              },
            }),
          },
        },
      }),
    ),
  );
}
