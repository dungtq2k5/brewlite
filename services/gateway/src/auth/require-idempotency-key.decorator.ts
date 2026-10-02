import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import type { Request } from 'express';
import { zUuidV7 } from '@brewlite/contracts';
import { apiError } from '@brewlite/nest-common';

/**
 * `Idempotency-Key`, required and a UUIDv7 (product-overview §6.7). Missing or malformed
 * → `400 IDEMPOTENCY_KEY_REQUIRED` — a v4 key is "malformed", not "a different key", so
 * it gets the same refusal as no key at all. The gateway stores nothing; the key is
 * forwarded as a field of the gRPC request (conventions §6.4).
 */
export const RequireIdempotencyKey = createParamDecorator(
  (_data: unknown, executionContext: ExecutionContext): string => {
    const req = executionContext.switchToHttp().getRequest<Request>();
    const raw = req.headers['idempotency-key'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = zUuidV7.safeParse(value);
    if (!parsed.success) throw apiError('IDEMPOTENCY_KEY_REQUIRED');
    return parsed.data;
  },
);

/**
 * The same header as OpenAPI metadata — a param decorator is invisible to Swagger, so the
 * generated client would otherwise have no `Idempotency-Key` parameter at all. Put it on the
 * handler beside `@RequireIdempotencyKey()`.
 */
export const ApiIdempotencyKey = () =>
  ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'A UUIDv7 — the same key and body replay the first answer (api-endpoints-plan §0.6).',
    schema: { type: 'string', format: 'uuid' },
  });
