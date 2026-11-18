#!/usr/bin/env node
// The web's coverage: the e2e run's browser V8 (`coverage/raw/browser`, written by the fixture in
// e2e/support.ts) and the Next server's (`coverage/raw/server`, NODE_V8_COVERAGE), mapped back to
// `src/` by monocart through the coverage build's source maps, then unioned with Vitest's lcov
// (`coverage/vitest/lcov.info`) into `coverage/lcov.info` — the file coverage-check reads.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CoverageReport } from 'monocart-coverage-reports';
import { COVERAGE_EXCLUDE } from '../../../packages/config/coverage.mjs';
import { mergeLcov } from './coverage-lcov.mjs';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const at = (...p) => path.join(WEB, ...p);
const excluded = (p) => COVERAGE_EXCLUDE.some((glob) => path.matchesGlob(p, glob));
// `src/…` inside the web app; reports name it from the repository root (`apps/web/src/…`).
const toSrc = (p) => {
  const i = p.indexOf('apps/web/src/');
  if (i >= 0) return p.slice(i + 'apps/web/'.length);
  return p;
};

const mcr = new CoverageReport({
  name: 'web e2e',
  outputDir: at('coverage', 'e2e'),
  baseDir: WEB,
  reports: [['lcovonly', { file: 'lcov.info' }]],
  entryFilter: (entry) =>
    entry.url.includes('/_next/static/chunks/') || entry.url.includes('/apps/web/.next/server/'),
  sourcePath: (p) => `apps/web/${toSrc(p)}`,
  sourceFilter: (p) => toSrc(p).startsWith('src/') && !excluded(toSrc(p)),
  // Only real source files: unmapped leftovers (a chunk without a map) and the `data:` modules
  // Next inlines for Server Actions are dropped, not counted.
  outputFilter: (file) => {
    const src = toSrc(file.sourcePath);
    return src.startsWith('src/') && /\.tsx?$/.test(src) && existsSync(at(src)) && !excluded(src);
  },
  // The maps are read from the build on disk (`.next/`; in CI, copied out of the image's build
  // stage): the browser's chunks name theirs by URL, and the standalone server carries none.
  sourceMapResolver: async (raw, defaultResolver) => {
    // A chunk name can hold `[`, `]` or spaces (`[root-of-the-server]__…js`): decode first.
    const url = decodeURIComponent(raw);
    const web = url.indexOf('/_next/');
    // The server's chunks: `…/apps/web/.next/standalone/apps/web/.next/server/…` locally,
    // `/app/apps/web/.next/server/…` in the image — either way, the part after the last
    // `apps/web/.next/` names the file under this build's `.next/`.
    const server = url.lastIndexOf('/apps/web/.next/');
    let file;
    if (web >= 0) file = at('.next', url.slice(web + '/_next/'.length).split('?')[0]);
    else if (server >= 0) file = at('.next', url.slice(server + '/apps/web/.next/'.length));
    else return defaultResolver(raw);
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined;
  },
});

const browser = at('coverage', 'raw', 'browser');
for (const file of existsSync(browser) ? readdirSync(browser) : []) {
  await mcr.add(JSON.parse(readFileSync(path.join(browser, file), 'utf8')));
}
// Node's V8 data carries no source, and its URLs name the machine that ran it
// (`/app/apps/web/.next/…` in the image). Each chunk is pointed at — and given the source of — the
// same file in this build's `.next/` (the standalone server's chunks are copies of those).
const NEXT_SERVER = '/apps/web/.next/server/';
const toBuild = (entry) => {
  const url = decodeURIComponent(entry.url);
  const i = url.lastIndexOf(NEXT_SERVER);
  if (i < 0) return entry;
  const file = at('.next', 'server', url.slice(i + NEXT_SERVER.length));
  // `add()` (unlike `addFromDir()`) maps only entries that carry their source.
  return existsSync(file)
    ? { ...entry, url: pathToFileURL(file).href, source: readFileSync(file, 'utf8') }
    : entry;
};
const server = at('coverage', 'raw', 'server');
for (const file of existsSync(server) ? readdirSync(server) : []) {
  const { result } = JSON.parse(readFileSync(path.join(server, file), 'utf8'));
  await mcr.add(result.filter((e) => e.url.includes(NEXT_SERVER)).map(toBuild));
}
await mcr.generate();

const sources = [at('coverage', 'vitest', 'lcov.info'), at('coverage', 'e2e', 'lcov.info')]
  .filter(existsSync)
  .map((f) => readFileSync(f, 'utf8'));
writeFileSync(at('coverage', 'lcov.info'), mergeLcov(sources));
console.log(`web coverage: merged ${sources.length} lcov files into coverage/lcov.info`);
