import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { gitFiles, readRepoFile } from './lib/corpus.js';

interface Violation {
  file: string;
  line: number;
  message: string;
}

const MARKDOWN_LINK_TO_ARCHIVE = /\[[^\]]*\]\([^)]*archive\/[^)]*\)/;
const CODE_PHRASES = [/docs\/archive/, /archive\/impls/, /impl(?:ementation)? doc/i];

function check(files: string[]): Violation[] {
  const violations: Violation[] = [];
  for (const file of files) {
    if (file === '.gitignore') continue;
    const content = readRepoFile(file);
    if (file.endsWith('.md')) {
      for (const [i, line] of content.split('\n').entries()) {
        if (MARKDOWN_LINK_TO_ARCHIVE.test(line)) {
          violations.push({ file, line: i + 1, message: 'links into docs/archive/' });
        }
      }
    } else {
      for (const [i, l] of content.split('\n').entries()) {
        for (const phrase of CODE_PHRASES) {
          if (phrase.test(l)) {
            violations.push({ file, line: i + 1, message: `cites a working document (${phrase})` });
            break;
          }
        }
      }
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

describe('archive-references', () => {
  it('reports each planted violation by file and line', () => {
    plant('docs/__lint-tmp-archive-link.md', '# x\n\nSee [the plan](./archive/impls/01.md).\n');
    // Built by concatenation so this guard's own source never contains the phrase it
    // forbids — the corpus check below would otherwise flag this very file.
    const forbiddenPhrase = ['impl', 'doc 01 §6'].join(' ');
    plant(
      'packages/config/__lint-tmp-archive-cite.ts',
      `// ${forbiddenPhrase}\nexport const x = 1;\n`,
    );

    const violations = check([
      'docs/__lint-tmp-archive-link.md',
      'packages/config/__lint-tmp-archive-cite.ts',
    ]);

    expect(violations).toContainEqual(
      expect.objectContaining({ file: 'docs/__lint-tmp-archive-link.md', line: 3 }),
    );
    expect(violations).toContainEqual(
      expect.objectContaining({ file: 'packages/config/__lint-tmp-archive-cite.ts', line: 1 }),
    );
  });

  it('conforming shapes pass: prose mentioning docs/archive/ in a .md file, no link', () => {
    plant('docs/__lint-tmp-prose.md', '`docs/archive/` is git-ignored scratch.\n');
    expect(check(['docs/__lint-tmp-prose.md'])).toEqual([]);
  });

  it('.gitignore is exempt', () => {
    expect(check(['.gitignore'])).toEqual([]);
  });

  it('the corpus is real', () => {
    const files = gitFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain('docs/README.md');
  });

  it('holds over the real corpus', () => {
    expect(check(gitFiles())).toEqual([]);
  });
});
