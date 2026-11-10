import { buildOpenApiDocument } from '@brewlite/nest-common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createE2eApp, type E2eApp } from './support/e2e-app.js';

type Property = { type?: unknown; items?: unknown };
type Schemas = Record<string, { properties?: Record<string, Property> }>;

describe('gateway e2e — the OpenAPI document', () => {
  let e2e: E2eApp;
  let schemas: Schemas;

  beforeAll(async () => {
    e2e = await createE2eApp();
    schemas = buildOpenApiDocument(e2e.app).components?.schemas as unknown as Schemas;
  });

  afterAll(async () => {
    await e2e.close();
  });

  const property = (schema: string, name: string) => schemas[schema]?.properties?.[name];

  it('a top-level .nullable() field is nullable, not an array', () => {
    expect(property('PaymentResponseDto', 'clientSecret')?.type).toEqual(['string', 'null']);
    expect(property('PromotionResponseDto', 'maxUses')?.type).toEqual(['number', 'null']);
    expect(property('PaymentResponseDto', 'clientSecret')).not.toHaveProperty('items');
  });

  it('a real array of strings is still an array', () => {
    expect(property('AdminProductResponseDto', 'toppingIds')).toMatchObject({
      type: 'array',
      items: { type: 'string' },
    });
  });

  it('never leaks the marker into the document', () => {
    expect(JSON.stringify(schemas)).not.toContain('x-brewlite-nullable');
  });
});
