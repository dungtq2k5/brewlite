import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { buildOpenApiDocument } from '@brewlite/nest-common';
import { AppModule } from './app.module.js';

/**
 * Builds the Swagger document without listening — reuses `setupSwagger`'s document
 * builder, so `/docs-json` and the committed file cannot drift (impl doc 01 §9.3).
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app);
  const outPath = join(__dirname, '..', '..', 'openapi.json');
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
