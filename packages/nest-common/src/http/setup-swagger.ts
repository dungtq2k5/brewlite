import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('BrewLite API')
    .setVersion('1')
    // zod's JSON Schema output is 2020-12 (`type: ["string", "null"]`, `contentEncoding`) — 3.1 is the
    // OpenAPI version that allows it; a 3.0 label made the document invalid.
    .setOpenAPIVersion('3.1.0')
    .build();
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
  stripParameterContentEncoding(document);
  return document;
}

/**
 * zod's `base64url` string lands on a query parameter as `contentEncoding` — a keyword that
 * belongs inside `schema` (where `format: 'base64url'` already says it), and which a strict
 * validator such as Orval's rejects on the parameter itself.
 */
function stripParameterContentEncoding(document: ReturnType<typeof SwaggerModule.createDocument>) {
  for (const methods of Object.values(document.paths ?? {})) {
    for (const operation of Object.values(methods as Record<string, unknown>)) {
      const parameters = (operation as { parameters?: Record<string, unknown>[] })?.parameters;
      for (const parameter of parameters ?? []) delete parameter.contentEncoding;
    }
  }
}

/** Swagger UI at `/docs`, the raw document at `/docs-json`. */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app));
}
