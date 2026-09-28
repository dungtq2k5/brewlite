import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The repo root — three levels up from `packages/config/guards/lib`.
 */
const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * Every file `git` tracks, repo-relative, forward-slashed. ⚠️ A new file is invisible to
 * the guards until `git add` — this is what makes the guards ignore `node_modules`,
 * `dist` and `generated/prisma` for free, without an ignore list of our own.
 */
export function gitFiles(): string[] {
  const out = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

/**
 * Reads a tracked file's content by its repo-relative path. `git ls-files` lists the
 * index, not the working tree — a file deleted on disk but not yet `git rm`'d is still
 * "tracked" and reads as empty rather than throwing, so the guards stay usable on a
 * mid-flight working tree.
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
