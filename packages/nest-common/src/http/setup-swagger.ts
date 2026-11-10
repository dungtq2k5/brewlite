import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { NULLABLE_MARKER } from './zod-dto.js';

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
  restoreNullable(document);
  return document;
}

/**
 * Undoes `createZodDto`'s marker: a property it flagged goes back to `type: [<type>, "null"]`
 * (valid in OpenAPI 3.1). It acts only where the source said `.nullable()`, so a real array
 * of strings is never mistaken for a nullable string.
 */
function restoreNullable(document: ReturnType<typeof SwaggerModule.createDocument>) {
  for (const schema of Object.values(document.components?.schemas ?? {})) {
    const properties = (schema as { properties?: Record<string, Record<string, unknown>> })
      .properties;
    for (const property of Object.values(properties ?? {})) {
      if (!(NULLABLE_MARKER in property)) continue;
      delete property[NULLABLE_MARKER];
      property.type = [property.type, 'null'];
    }
  }
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
