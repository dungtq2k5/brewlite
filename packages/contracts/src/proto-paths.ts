import { dirname, join } from 'node:path';

/**
 * Resolved from the installed package, never a relative path into `src` — protos are
 * loaded at runtime and `proto/` is copied into every image (conventions §2.3, architecture §3.2).
 * `require` is CommonJS-native here (ADR 0012) — no `import.meta`.
 */
export const PROTO_ROOT = join(
  dirname(require.resolve('@brewlite/contracts/package.json')),
  'proto',
);

export const CATALOG_PROTO_FILES = [join(PROTO_ROOT, 'brewlite/catalog/menu_service.proto')];
