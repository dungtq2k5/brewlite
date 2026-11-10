// The pure parts of `scripts/smoke.mjs` — settings and the report — tested in smoke.spec.mjs.

export const LOCAL_OPS_URLS = [
  'http://localhost:23101', // identity
  'http://localhost:23102', // catalog
  'http://localhost:23103', // ordering
  'http://localhost:23104', // payment
];
const OPS_NAMES = new Map([
  ['23101', 'identity'],
  ['23102', 'catalog'],
  ['23103', 'ordering'],
  ['23104', 'payment'],
]);

/** Trailing `/`s removed — a loop, not `/\/+$/` (a regex tried from every position is quadratic). */
export function stripTrailingSlashes(s) {
  let end = s.length;
  while (end > 0 && s[end - 1] === '/') end--;
  return s.slice(0, end);
}

/**
 * `SMOKE_OPS_URLS`: unset → the four local ops ports; empty → none (a deployment where the
 * services are not reachable, so only the gateway's readiness is checked); otherwise a
 * comma-separated list, blanks and trailing slashes ignored.
 */
export function parseOpsUrls(raw) {
  if (raw === undefined) return [...LOCAL_OPS_URLS];
  return raw
    .split(',')
    .map((s) => stripTrailingSlashes(s.trim()))
    .filter((s) => s !== '');
}

/** A readable name for a checked URL: the local service it is, or the URL itself. */
export function nameFor(url) {
  try {
    const port = new URL(url).port;
    return OPS_NAMES.get(port) ?? url;
  } catch {
    return url;
  }
}

/** The health step's lines and whether it passed: `✓ gateway  ready (34 ms)` / `✗ ordering  …`. */
export function healthReport(results) {
  const width = Math.max(...results.map((r) => r.name.length), 0);
  const lines = results.map(
    (r) => `${r.ok ? '✓' : '✗'} ${r.name.padEnd(width)}  ${r.ok ? `ready (${r.ms} ms)` : r.error}`,
  );
  return { ok: results.every((r) => r.ok), lines };
}
