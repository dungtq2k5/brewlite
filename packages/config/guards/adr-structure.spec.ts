import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { gitFiles, readRepoFile } from './lib/corpus.js';

interface Violation {
  file: string;
  line: number;
  message: string;
}

const STATUS_LINE =
  /^\*\*Status:\*\* (Proposed|Accepted|Superseded) · \*\*Date:\*\* \d{4}-\d{2}-\d{2} · \*\*Supersedes:\*\* (—|\[(\d{4})\]\([^)]+\)) · \*\*Superseded by:\*\* (—|\[(\d{4})\]\([^)]+\))$/;

function adrFiles(files: string[]): string[] {
  return files.filter(
    (f) => /^docs\/decisions\/\d{4}-.*\.md$/.test(f) && !f.endsWith('TEMPLATE.md'),
  );
}

function check(files: string[]): Violation[] {
  const violations: Violation[] = [];
  const byNumber = new Map<
    string,
    { file: string; status: string; supersedes?: string; supersededBy?: string }
  >();

  const readme = readRepoFile('docs/README.md');

  for (const file of adrFiles(files)) {
    const number = file.match(/(\d{4})-/)?.[1];
    if (!number) continue;
    const content = readRepoFile(file);
    const lines = content.split('\n');

    const titleLine = lines[0] ?? '';
    const titleMatch = new RegExp(`^# ${number} — .+$`).exec(titleLine);
    if (!titleMatch) {
      violations.push({ file, line: 1, message: `line 1 must be "# ${number} — <title>"` });
    }

    const statusLine = lines[2] ?? '';
    const statusMatch = STATUS_LINE.exec(statusLine);
    if (!statusMatch) {
      violations.push({
        file,
        line: 3,
        message: 'line 3 does not match the required Status line shape',
      });
    } else {
      byNumber.set(number, {
        file,
        status: statusMatch[1]!,
        supersedes: statusMatch[3],
        supersededBy: statusMatch[5],
      });
    }

    const headings = ['## Context', '## Decision', '## Consequences', '## See also'];
    let searchFrom = 0;
    for (const heading of headings) {
      const index = lines.findIndex((l, i) => i >= searchFrom && l === heading);
      if (index === -1) {
        violations.push({
          file,
          line: lines.length,
          message: `missing "${heading}" (or out of order)`,
        });
        break;
      }
      searchFrom = index + 1;
    }

    if (!readme.includes(`(./decisions/${file.split('/').pop()})`)) {
      violations.push({ file, line: 1, message: 'no row in docs/README.md links this file' });
    }
  }

  for (const [number, entry] of byNumber) {
    if (entry.supersedes) {
      const target = byNumber.get(entry.supersedes);
      if (!target || target.supersededBy !== number) {
        violations.push({
          file: entry.file,
          line: 3,
          message: `${number} Supersedes ${entry.supersedes}, but ${entry.supersedes} is not Superseded by ${number}`,
        });
      }
    }
    if (entry.supersededBy && entry.status !== 'Superseded') {
      violations.push({
        file: entry.file,
        line: 3,
        message: `${number} is Superseded by another ADR but its own status is not "Superseded"`,
      });
    }
  }

  return violations;
}

const REPO_ROOT = join(process.cwd(), '..', '..');
const written: string[] = [];

afterEach(() => {
  for (const file of written.splice(0)) rmSync(file, { force: true });
});

function plant(relativePath: string, content: string) {
  const absolutePath = join(REPO_ROOT, relativePath);
  writeFileSync(absolutePath, content);
  written.push(absolutePath);
}

describe('adr-structure', () => {
  it('holds over the real corpus', () => {
    expect(check(gitFiles())).toEqual([]);
  });

  it('reports each planted violation by file and line', () => {
    plant(
      'docs/decisions/9001-bad-title.md',
      [
        '# wrong title\n',
        '\n',
        '**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —\n',
        '\n',
        '## Context\n\nx\n\n## Decision\n\nx\n\n## Consequences\n\nx\n\n## See also\n',
      ].join(''),
    );
    plant(
      'docs/decisions/9002-bad-status.md',
      [
        '# 9002 — Bad status\n',
        '\n',
        '**Status:** Draft · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —\n',
        '\n',
        '## Context\n\nx\n\n## Decision\n\nx\n\n## Consequences\n\nx\n\n## See also\n',
      ].join(''),
    );
    plant(
      'docs/decisions/9003-missing-section.md',
      [
        '# 9003 — Missing section\n',
        '\n',
        '**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —\n',
        '\n',
        '## Context\n\nx\n\n## Decision\n\nx\n\n## See also\n',
      ].join(''),
    );

    const violations = check([
      ...gitFiles(),
      'docs/decisions/9001-bad-title.md',
      'docs/decisions/9002-bad-status.md',
      'docs/decisions/9003-missing-section.md',
    ]);

    expect(violations).toContainEqual(
      expect.objectContaining({ file: 'docs/decisions/9001-bad-title.md', line: 1 }),
    );
    expect(violations).toContainEqual(
      expect.objectContaining({ file: 'docs/decisions/9002-bad-status.md', line: 3 }),
    );
    expect(violations).toContainEqual(
      expect.objectContaining({ file: 'docs/decisions/9003-missing-section.md' }),
    );
    // Both are missing a README row too.
    expect(violations.filter((v) => v.message.includes('README')).length).toBeGreaterThan(0);
  });

  it('accepts a conforming shape, including a Supersedes/Superseded-by pair', () => {
    plant(
      'docs/decisions/9004-old.md',
      [
        '# 9004 — Old decision\n',
        '\n',
        '**Status:** Superseded · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** [9005](./9005-new.md)\n',
        '\n',
        '## Context\n\nx\n\n## Decision\n\nx\n\n## Consequences\n\nx\n\n## See also\n',
      ].join(''),
    );
    plant(
      'docs/decisions/9005-new.md',
      [
        '# 9005 — New decision\n',
        '\n',
        '**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** [9004](./9004-old.md) · **Superseded by:** —\n',
        '\n',
        '## Context\n\nx\n\n## Decision\n\nx\n\n## Consequences\n\nx\n\n## See also\n',
      ].join(''),
    );

    const violations = check(['docs/decisions/9004-old.md', 'docs/decisions/9005-new.md']).filter(
      (v) => !v.message.includes('README'),
    );

    expect(violations).toEqual([]);
  });

  it('the corpus is real', () => {
    const files = adrFiles(gitFiles());
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain('docs/decisions/0001-one-store-with-pickup-at-the-counter.md');
  });
});
