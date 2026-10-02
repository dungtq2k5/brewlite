import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The repo root — three levels up from `packages/config/guards/lib`.
 */
const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * Every file `git` tracks **and** every untracked one, repo-relative, forward-slashed —
 * a new file is checked before it is committed, not after. `.gitignore` is still
 * respected (`--exclude-standard`), which is what keeps `node_modules`, `dist` and
 * `generated/prisma` out for free, without an ignore list of our own; a git-ignored file
 * is invisible to the guards.
 */
export function gitFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return [...new Set(out.split('\n').filter(Boolean))];
}

/**
 * Reads a file's content by its repo-relative path. `git ls-files` lists the index, not
 * the working tree — a file deleted on disk but not yet `git rm`'d is still listed and
 * reads as empty rather than throwing, so the guards stay usable on a mid-flight working
 * tree.
 */
export function readRepoFile(relativePath: string): string {
  try {
    return readFileSync(join(REPO_ROOT, relativePath), 'utf8');
  } catch {
    return '';
  }
}

/** The 1-based line number of the first line containing `needle`, or `undefined`. */
export function lineOf(content: string, needle: string): number | undefined {
  const lines = content.split('\n');
  const index = lines.findIndex((line) => line.includes(needle));
  return index === -1 ? undefined : index + 1;
}
