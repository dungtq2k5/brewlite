import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder().setTitle('BrewLite API').setVersion('1').build();
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}

/** Swagger UI at `/docs`, the raw document at `/docs-json`. */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app));
}
