import { Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { VersioningType } from '@nestjs/common';
import {
  ErrorFilter,
  pathAwareHelmet,
  requestIdMiddleware,
  ResponseEnvelopeInterceptor,
  ResponseValidationInterceptor,
  setupSwagger,
  ZodValidationPipe,
} from '@brewlite/nest-common';
import type { Env } from './config/env.schema.js';

/**
 * The pipeline shared by `main.ts` and the e2e tests, so a test proves the same
 * configuration that actually runs in production.
 */
export function configureApp(app: NestExpressApplication): {
  isProduction: boolean;
  config: ConfigService<Env, true>;
} {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

  app.set('trust proxy', config.get('TRUST_PROXY_HOPS', { infer: true }));
  app.use(requestIdMiddleware);
  app.setGlobalPrefix(config.get('GLOBAL_PREFIX', { infer: true }), {
    exclude: ['health', 'health/ready', 'version'],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.use(pathAwareHelmet());
  app.useGlobalPipes(new ZodValidationPipe());

  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new ResponseEnvelopeInterceptor(reflector), // registered FIRST = runs LAST on the way out
    new ResponseValidationInterceptor(reflector, isProduction),
  );
  app.useGlobalFilters(new ErrorFilter(isProduction));

  if (config.get('SWAGGER_ENABLED', { infer: true })) setupSwagger(app);

  return { isProduction, config };
}
