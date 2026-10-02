import { describe, expect, it } from 'vitest';
import { gitFiles, readRepoFile } from './lib/corpus.js';

/**
 * Every contract spec starts a real gRPC server on a fixed port, and turbo runs the
 * services' integration suites in parallel — two specs on one port fail with EADDRINUSE,
 * but only when the timing lines up. So each port belongs to exactly one spec.
 */
/**
 * Ports a running service owns (ADR 0027): web 23000, gateway 23100, the four services' ops
 * 23101–23104 and gRPC 25051–25054. A contract spec on one of them fails with EADDRINUSE on
 * any machine with the stack up.
 */
const SERVICE_PORTS = new Set([
  '23000',
  '23100',
  '23101',
  '23102',
  '23103',
  '23104',
  '25051',
  '25052',
  '25053',
  '25054',
]);

interface Use {
  port: string;
  file: string;
  line: number;
}

const PORT = /(?:localhost|127\.0\.0\.1):(\d{4,5})/;

export function portUses(files: string[], read: (file: string) => string): Use[] {
  const uses: Use[] = [];
  for (const file of files.filter((f) =>
    /^services\/[^/]+\/test\/contract\/.+\.spec\.ts$/.test(f),
  )) {
    for (const [index, line] of read(file).split('\n').entries()) {
      const match = PORT.exec(line);
      if (match) uses.push({ port: match[1]!, file, line: index + 1 });
    }
  }
  return uses;
}

export function servicePortUses(uses: Use[]): string[] {
  return uses
    .filter((use) => SERVICE_PORTS.has(use.port))
    .map((use) => `${use.file}:${use.line} uses ${use.port}, a running service's port (ADR 0027)`);
}

export function duplicates(uses: Use[]): string[] {
  const byPort = new Map<string, Use[]>();
  for (const use of uses) byPort.set(use.port, [...(byPort.get(use.port) ?? []), use]);
  return [...byPort]
    .filter(([, list]) => new Set(list.map((u) => u.file)).size > 1)
    .map(
      ([port, list]) =>
        `port ${port} is used by ${[...new Set(list.map((u) => u.file))].join(' and ')}`,
    );
}

describe('contract-ports', () => {
  it('holds over the real corpus — no shared port, no service port', () => {
    const uses = portUses(gitFiles(), readRepoFile);
    expect(duplicates(uses)).toEqual([]);
    expect(servicePortUses(uses)).toEqual([]);
  });

  it('a conforming shape passes: one file may use its own port twice', () => {
    const files = ['services/a/test/contract/a.contract.spec.ts'];
    const uses = portUses(
      files,
      () => "const url = 'localhost:25097';\nexpect(url).toBe('localhost:25097');",
    );
    expect(uses).toHaveLength(2);
    expect(duplicates(uses)).toEqual([]);
    expect(servicePortUses(uses)).toEqual([]);
  });

  it("reports a contract spec on a running service's port, naming file and line", () => {
    const files = ['services/a/test/contract/a.contract.spec.ts'];
    const found = servicePortUses(portUses(files, () => "// x\nconst url = 'localhost:25053';"));
    expect(found).toEqual([
      "services/a/test/contract/a.contract.spec.ts:2 uses 25053, a running service's port (ADR 0027)",
    ]);
  });

  it('reports a port two spec files share, naming both', () => {
    const files = [
      'services/a/test/contract/a.contract.spec.ts',
      'services/b/test/contract/b.contract.spec.ts',
    ];
    const found = duplicates(portUses(files, () => "const url = 'localhost:25097';"));
    expect(found).toHaveLength(1);
    expect(found[0]).toContain(
      'a.contract.spec.ts and services/b/test/contract/b.contract.spec.ts',
    );
  });

  it('actually sees the contract specs (the guard is not vacuous)', () => {
    expect(portUses(gitFiles(), readRepoFile).length).toBeGreaterThanOrEqual(5);
  });
});
