import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { format } from 'prettier';
import { buildOpenApiDocument } from '@brewlite/nest-common';
import { AppModule } from './app.module.js';

/**
 * Builds the Swagger document without listening — reuses `setupSwagger`'s document
 * builder, so `/docs-json` and the committed file cannot drift.
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app);
  const outPath = join(__dirname, '..', '..', 'openapi.json');
  // JSON.stringify never collapses short arrays; format with the repo's own
  // Prettier config so this output matches what `pnpm format:check` expects.
  const formatted = await format(JSON.stringify(document, null, 2), { filepath: outPath });
  writeFileSync(outPath, formatted);
  await app.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
