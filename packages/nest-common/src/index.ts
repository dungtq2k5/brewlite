export * from './config/create-config-module.js';
export * from './logging/logger.module.js';
export * from './errors/rpc-error.js';
export * from './errors/api-error.js';
export * from './errors/grpc-service-error.js';
export * from './crypto/tokens.js';
export * from './crypto/content-hash.js';
export * from './grpc/proto-loader-options.js';
export * from './grpc/base-grpc.client.js';
export * from './grpc/request-id.js';
export * from './grpc/request-context.js';
export * from './grpc/grpc-request-context.interceptor.js';
export * from './grpc/caller.js';
export * from './http/request-id.middleware.js';
export * from './http/path-aware-helmet.js';
export * from './http/paged.js';
export * from './http/response-envelope.interceptor.js';
export * from './http/skip-envelope.decorator.js';
export * from './http/response-validation.interceptor.js';
export * from './http/error.filter.js';
export * from './http/api-envelope.decorator.js';
export * from './http/api-errors.decorator.js';
export * from './http/access.decorators.js';
export * from './http/setup-swagger.js';
export * from './health/ops.module.js';
export * from './health/readiness.js';
export * from './health/redis-ping.js';
export * from './prisma/live.js';
export * from './prisma/unique-violation.js';
export * from './outbox/outbox.service.js';
export * from './outbox/outbox.relay.js';
export * from './jetstream/connection.js';
export * from './jetstream/streams.js';
export * from './jetstream/consumer.js';
export * from './jetstream/dead-letter.js';
export * from './jetstream/connected-check.js';
export * from './jobs/jobs.module.js';

/**
 * Re-exported from nest-common's own resolved copy — a service importing `nestjs-zod`
 * directly can get a *different* physical copy under pnpm's isolated node_modules (peer
 * resolution can fork it), which breaks `instanceof ZodValidationException` in
 * `ErrorFilter`. Every service imports these from here, never from `nestjs-zod` itself.
 */
export {
  ZodValidationPipe,
  ZodSerializerDto,
  ZodValidationException,
  createZodDto,
  type ZodDto,
} from 'nestjs-zod';
