#!/usr/bin/env node
// `pnpm coverage`'s last step: every measured package at ≥ 90 % by Sonar's formula (lines +
// conditions), per package — a well-tested one must not hide an untested one. The shared packages
// are the union over every report that executed them. A package with a ratchet floor
// (`coverage-floor.json`: the web, until it reaches 90) is held to its floor instead.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COVERAGE_MIN } from '../packages/config/coverage.mjs';
import { coverageRows, packageTotals, unionReports } from './coverage-check-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEASURED = [
  'packages/contracts',
  'packages/api-client',
  'packages/nest-common',
  'services/identity',
  'services/catalog',
  'services/ordering',
  'services/payment',
  'services/gateway',
  'apps/web',
];
const report = (pkg) => path.join(ROOT, pkg, 'coverage', 'lcov.info');
const missing = MEASURED.filter((p) => !existsSync(report(p)));
const texts = MEASURED.filter((p) => !missing.includes(p)).map((p) =>
  readFileSync(report(p), 'utf8'),
);
const floors = JSON.parse(readFileSync(path.join(ROOT, 'scripts', 'coverage-floor.json'), 'utf8'));

const rows = coverageRows(packageTotals(unionReports(texts), MEASURED), {
  min: COVERAGE_MIN,
  floors,
  missing,
});
const width = Math.max(...rows.map((r) => r.name.length));
console.log(
  `coverage (Sonar's formula: lines + conditions), at least ${COVERAGE_MIN} % per package\n`,
);
for (const r of rows) {
  const value = r.pct === undefined ? 'no report' : `${r.pct.toFixed(1)} %`;
  const note = r.bar === COVERAGE_MIN ? '' : `  (ratchet floor ${r.bar})`;
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name.padEnd(width)}  ${value.padStart(9)}${note}`);
}
const failed = rows.filter((r) => !r.ok);
if (failed.length > 0) {
  const list = failed.map(
    (r) => `${r.name} (${r.pct === undefined ? 'no report' : r.pct.toFixed(1)})`,
  );
  console.error(`\n✗ Under the bar: ${list.join(', ')}`);
  process.exit(1);
}
console.log('\n✓ Every package is at its bar.');
