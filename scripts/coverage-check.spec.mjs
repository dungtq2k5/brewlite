import { describe, expect, it } from 'vitest';
import {
  coverageRows,
  packageTotals,
  parseLcov,
  sonarCoverage,
  unionReports,
} from './coverage-check-lib.mjs';

const own = `SF:packages/shared/src/a.ts
DA:1,1
DA:2,0
BRDA:1,0,0,1
BRDA:1,0,1,-
end_of_record
`;
const service = `SF:services/s/src/x.ts
DA:1,1
end_of_record
SF:packages/shared/src/a.ts
DA:1,0
DA:2,4
BRDA:1,0,0,0
BRDA:1,0,1,2
end_of_record
`;

describe('parseLcov', () => {
  it('reads lines and branches per file; `-` is no hit', () => {
    const a = parseLcov(own).get('packages/shared/src/a.ts');
    expect([...a.lines]).toEqual([
      ['1', 1],
      ['2', 0],
    ]);
    expect(a.branches.get('1,0,1')).toBe(0);
  });
});

describe('unionReports + packageTotals', () => {
  it("credits a shared file with every run's hits, and files to their package", () => {
    const totals = packageTotals(unionReports([own, service]), ['packages/shared', 'services/s']);
    expect(totals.get('packages/shared')).toEqual({
      lines: 2,
      linesHit: 2,
      conditions: 2,
      conditionsHit: 2,
    });
    expect(totals.get('services/s')).toEqual({
      lines: 1,
      linesHit: 1,
      conditions: 0,
      conditionsHit: 0,
    });
  });
});

describe('sonarCoverage', () => {
  it("is Sonar's formula — (covered lines + covered conditions) / (lines + conditions)", () => {
    expect(sonarCoverage({ lines: 15, linesHit: 13, conditions: 4, conditionsHit: 2 })).toBeCloseTo(
      (15 / 19) * 100,
    );
  });
  it('is lines alone for a package with no conditions, and 100 for nothing to cover', () => {
    expect(sonarCoverage({ lines: 4, linesHit: 3, conditions: 0, conditionsHit: 0 })).toBe(75);
    expect(sonarCoverage({ lines: 0, linesHit: 0, conditions: 0, conditionsHit: 0 })).toBe(100);
  });
});

describe('coverageRows', () => {
  const t = (linesHit) => ({ lines: 100, linesHit, conditions: 0, conditionsHit: 0 });
  it('passes at 90, fails under it, holds a floored package to its floor, fails a missing report', () => {
    const totals = new Map([
      ['a', t(90)],
      ['b', t(89)],
      ['web', t(62)],
      ['web2', t(60)],
      ['gone', t(100)],
    ]);
    const rows = coverageRows(totals, {
      min: 90,
      floors: { web: 61, web2: 61 },
      missing: ['gone'],
    });
    expect(rows.map((r) => [r.name, r.ok])).toEqual([
      ['a', true],
      ['b', false],
      ['web', true],
      ['web2', false],
      ['gone', false],
    ]);
  });
});

describe('one exclusion list', () => {
  it("sonar-project.properties' sonar.coverage.exclusions is exactly COVERAGE_EXCLUDE", async () => {
    const { readFileSync } = await import('node:fs');
    const { COVERAGE_EXCLUDE } = await import('../packages/config/coverage.mjs');
    const props = readFileSync(new URL('../sonar-project.properties', import.meta.url), 'utf8');
    const line = props.split('\n').find((l) => l.startsWith('sonar.coverage.exclusions='));
    expect(line?.slice('sonar.coverage.exclusions='.length).split(',')).toEqual(COVERAGE_EXCLUDE);
  });
  it('every measured report is listed for SonarCloud', async () => {
    const { readFileSync } = await import('node:fs');
    const props = readFileSync(new URL('../sonar-project.properties', import.meta.url), 'utf8');
    const script = readFileSync(new URL('./coverage-check.mjs', import.meta.url), 'utf8');
    const measured = [...script.matchAll(/^ {2}'((?:packages|services|apps)\/[\w-]+)',$/gm)].map(
      (m) => m[1],
    );
    expect(measured.length).toBe(9);
    const line = props.split('\n').find((l) => l.startsWith('sonar.javascript.lcov.reportPaths='));
    expect(line?.split('=')[1].split(',')).toEqual(measured.map((p) => `${p}/coverage/lcov.info`));
  });
});
