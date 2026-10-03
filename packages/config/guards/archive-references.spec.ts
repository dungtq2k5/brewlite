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
const DOC_NUMBER_CITATION = /\bdoc \d{2}a?\b/i;
const CODE_PHRASES = [
  /docs\/archive/,
  /archive\/impls/,
  /impl(?:ementation)? doc/i,
  DOC_NUMBER_CITATION,
];

function check(files: string[]): Violation[] {
  const violations: Violation[] = [];
  for (const file of files) {
    if (file === '.gitignore') continue;
    const content = readRepoFile(file);
    if (file.endsWith('.md')) {
      for (const [i, line] of content.split('\n').entries()) {
        if (MARKDOWN_LINK_TO_ARCHIVE.test(line)) {
          violations.push({ file, line: i + 1, message: 'links into the archived docs tree' });
        }
        if (file !== 'docs/README.md' && DOC_NUMBER_CITATION.test(line)) {
          violations.push({ file, line: i + 1, message: 'cites a working document by number' });
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
    plant('docs/__lint-tmp-archive-link.md', '# x\n\nSee [the plan](./archive/plan.md).\n');
    // Built by concatenation so this guard's own source never contains the phrase it
    // forbids — the corpus check below would otherwise flag this very file.
    const forbiddenPhrase = ['impl', 'doc', '01 §6'].join(' ');
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

  it('reports a doc-number citation in markdown, in each of the three shapes that once reached a core doc', () => {
    // Built by concatenation so this guard's own source never contains the phrases it
    // forbids — the corpus check below would otherwise flag this very file.
    const shapes = [
      ['(doc', '02 §2, Q1)'].join(' '),
      ['(doc', '02 §4.2)'].join(' '),
      ['(doc', '01a §8.6)'].join(' '),
    ];
    plant(
      'docs/__lint-tmp-doc-number.md',
      shapes.map((shape) => `A line citing ${shape}.`).join('\n\n') + '\n',
    );

    const violations = check(['docs/__lint-tmp-doc-number.md']);

    expect(violations).toHaveLength(shapes.length);
  });

  it('docs/README.md is exempt from the doc-number citation, which is where the rule is named', () => {
    expect(check(['docs/README.md'])).toEqual([]);
  });

  it('conforming shapes pass: prose mentioning the archived-docs path in a .md file, no link', () => {
    // Built by concatenation so this guard's own source never contains the phrase it
    // forbids — the corpus check below would otherwise flag this very file.
    plant('docs/__lint-tmp-prose.md', '`docs' + '/archive/` is git-ignored scratch.\n');
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
