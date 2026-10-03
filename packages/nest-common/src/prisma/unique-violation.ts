/**
 * Prisma's `P2002` on a `$transaction`/query. `target` narrows to one index, so an
 * `EMAIL_TAKEN` is never answered for a clash on a different column (conventions §7.7).
 *
 * The violated index's name is reported two ways depending on the query engine:
 * `meta.target` (an array of column names) on the classic engine, or, with a driver
 * adapter (`@prisma/adapter-pg`, this repo's setup — Prisma 7), nested under
 * `meta.driverAdapterError.cause.constraint.index` as the Postgres constraint name
 * (`<table>_<column>_key`). `target` is checked against both, as a substring against
 * the constraint name so a caller passes the column, not the full constraint name.
 */
export function isUniqueConstraintViolation(error: unknown, target?: string): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  if ((error as { code: unknown }).code !== 'P2002') return false;
  if (target === undefined) return true;

  const meta = (error as { meta?: unknown }).meta;
  if (typeof meta !== 'object' || meta === null) return false;

  if ('target' in meta) {
    const columns = (meta as { target: unknown }).target;
    if (Array.isArray(columns) && columns.includes(target)) return true;
  }

  const driverAdapterError = (meta as { driverAdapterError?: unknown }).driverAdapterError;
  if (typeof driverAdapterError !== 'object' || driverAdapterError === null) return false;
  const cause = (driverAdapterError as { cause?: unknown }).cause;
  if (typeof cause !== 'object' || cause === null) return false;
  const constraint = (cause as { constraint?: unknown }).constraint;
  if (typeof constraint !== 'object' || constraint === null) return false;
  const index = (constraint as { index?: unknown }).index;
  return typeof index === 'string' && index.includes(target);
}
