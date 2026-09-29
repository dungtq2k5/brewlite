import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './constants.js';

/**
 * `page`/`pageSize`/`sort` for an admin list (api-endpoints-plan §0.4). `sortFields` are
 * the bare column names; `sort` also accepts each one prefixed with `-` for descending.
 * An unlisted `sort` value is a `400 VALIDATION_FAILED` (zod's own enum refusal).
 * `defaultSort`, when given, is one of those values and makes `sort` optional.
 */
export function zPageQuery<const F extends readonly [string, ...string[]]>(
  sortFields: F,
  defaultSort?: `${F[number]}` | `-${F[number]}`,
) {
  const sortValues = [...sortFields, ...sortFields.map((f) => `-${f}`)] as [string, ...string[]];
  const sort = z.enum(sortValues);
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    sort: defaultSort === undefined ? sort : sort.default(defaultSort),
  });
}

/** `z.coerce.boolean()` reads the string `"false"` as `true` — this reads the literal instead (conventions §6.2). */
export const zBooleanParam = z.enum(['true', 'false']).transform((v) => v === 'true');

/**
 * `cursor`/`limit` for a customer list that grows without bound (api-endpoints-plan §0.4).
 * The cursor is opaque — clients never parse it, so its shape here is only a length bound.
 */
export const zCursorQuery = z.object({
  cursor: z.string().base64url().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
