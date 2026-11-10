import { createZodDto as baseCreateZodDto } from 'nestjs-zod';

/**
 * Carries "this property was `.nullable()`" past `@nestjs/swagger`. nestjs-zod hands Nest each
 * top-level property's JSON Schema as property metadata, and in Nest's metadata an
 * **array-valued `type`** means *array of* — so zod's `type: ["string", "null"]` would come out
 * as `{ type: "array", items: { type: "string" } }`. The wrapper below swaps it for a plain
 * scalar plus this marker; `restoreNullable` (setup-swagger.ts) puts the null back afterwards.
 */
export const NULLABLE_MARKER = 'x-brewlite-nullable';

type MetadataFactory = (this: unknown) => Record<string, Record<string, unknown>>;

function hideNullable(properties: Record<string, Record<string, unknown>>) {
  for (const property of Object.values(properties)) {
    const type = property.type;
    if (!Array.isArray(type) || !type.includes('null')) continue;
    const rest = type.filter((t) => t !== 'null');
    // `["string","null"]` is the only shape zod emits for a nullable scalar; anything
    // wider is left to fail loudly in the OpenAPI test rather than be guessed at.
    if (rest.length !== 1) continue;
    property.type = rest[0];
    property[NULLABLE_MARKER] = true;
  }
  return properties;
}

function wrapFactory(dto: { _OPENAPI_METADATA_FACTORY?: MetadataFactory }) {
  const original = dto._OPENAPI_METADATA_FACTORY;
  if (!original) return;
  dto._OPENAPI_METADATA_FACTORY = function (this: unknown) {
    return hideNullable(original.call(this));
  };
}

/**
 * `createZodDto` from nestjs-zod, plus: a top-level `.nullable()` field stays nullable in the
 * OpenAPI document (conventions §6.2). Every DTO imports this, never nestjs-zod's own.
 */
export const createZodDto: typeof baseCreateZodDto = (schema, options) => {
  const dto = baseCreateZodDto(schema, options);
  wrapFactory(dto as never);

  // `Output` builds a fresh class on every read; wrap each one as it is made.
  const output = Object.getOwnPropertyDescriptor(dto, 'Output')?.get;
  if (output) {
    Object.defineProperty(dto, 'Output', {
      configurable: true,
      get(this: unknown) {
        const out = output.call(this);
        wrapFactory(out as never);
        return out;
      },
    });
  }
  return dto;
};
