import { describe, expect, it } from 'vitest';
import { gitFiles, readRepoFile } from './lib/corpus.js';

/**
 * The graded Task 10 evidence (product-overview F10, conventions §16.3) MUST stay green —
 * a renamed or deleted test would make it silently absent instead. Each name is a
 * substring of a test title under `services/<s>/test/integration/`.
 */
export const PROOFS: readonly { rule: string; name: string; service: string }[] = [
  { rule: 'F10-1', name: 'refuses an ILLEGAL transition', service: 'ordering' },
  {
    rule: 'F10-2',
    name: 'creates ONE order for two requests with the same Idempotency-Key',
    service: 'ordering',
  },
  {
    rule: 'F10-2',
    name: 'creates ONE payment for two requests with the same Idempotency-Key',
    service: 'payment',
  },
  { rule: 'F10-3', name: 'never oversells under CONCURRENT orders', service: 'catalog' },
  {
    rule: 'F10-4',
    name: 'applies a valid promotion code ONCE under CONCURRENT orders',
    service: 'ordering',
  },
  { rule: 'F10-4', name: 'credits points ONCE when an order becomes PAID', service: 'ordering' },
];

interface Violation {
  file: string;
  line: number;
  message: string;
}

function integrationSpecs(files: string[]): string[] {
  return files.filter((f) => /^services\/[^/]+\/test\/integration\/.+\.spec\.ts$/.test(f));
}

export function check(files: string[], read: (file: string) => string): Violation[] {
  const specs = integrationSpecs(files);
  const violations: Violation[] = [];
  for (const proof of PROOFS) {
    const found = specs.some(
      (file) => file.startsWith(`services/${proof.service}/`) && read(file).includes(proof.name),
    );
    if (!found) {
      violations.push({
        file: `services/${proof.service}/test/integration`,
        line: 0,
        message: `${proof.rule} proof is missing — no integration test named "${proof.name}"`,
      });
    }
  }
  return violations;
}

describe('task10-proofs', () => {
  it('holds over the real corpus — every graded proof exists by name', () => {
    expect(check(gitFiles(), readRepoFile)).toEqual([]);
  });

  it('reports a proof whose test was renamed, naming it', () => {
    const violations = check(gitFiles(), (file) =>
      readRepoFile(file).replaceAll('credits points ONCE when', 'credits points once when'),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain('credits points ONCE when an order becomes PAID');
  });

  it('the proof list is not empty and covers all four F10 rules', () => {
    expect(new Set(PROOFS.map((p) => p.rule))).toEqual(
      new Set(['F10-1', 'F10-2', 'F10-3', 'F10-4']),
    );
  });

  it('the corpus contains ordering’s integration folder (the guard is not vacuous)', () => {
    expect(integrationSpecs(gitFiles()).some((f) => f.startsWith('services/ordering/'))).toBe(true);
  });
});
