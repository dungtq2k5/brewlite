#!/usr/bin/env node
// `pnpm --filter @brewlite/web screens:review`, local only: every baseline added or
// changed against origin/main, beside its Figma frame and its old baseline, in
// `apps/web/screens-review/index.html` (git-ignored) — for a person to approve against the design.
//
// FIGMA_TOKEN: a Figma personal access token (File content: read), from the environment only —
// never committed, never logged.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATES, VIEWPORT } from './states.ts';

const FILE_KEY = 'BCeAngdcjVGdxUpBOFBmrZ';
const WEB = fileURLToPath(new URL('../../', import.meta.url));
const SHOTS = 'e2e/screens/__screenshots__';
const OUT = path.join(WEB, 'screens-review');
// Phone frames carry device chrome the build never draws (handoff §3.3).
const STATUS_BAR = 47;
const HOME_INDICATOR = 34;

const git = (...args) => execFileSync('git', args, { cwd: WEB, encoding: 'utf8' });
const changed = [
  ...git('diff', '--name-only', 'origin/main', '--', SHOTS).split('\n'),
  ...git('ls-files', '--others', '--exclude-standard', '--', SHOTS).split('\n'),
]
  .filter((f) => f.endsWith('.png'))
  .map((f) => path.basename(f))
  .filter((f, i, all) => all.indexOf(f) === i)
  .sort();

if (changed.length === 0) {
  console.log('No baseline added or changed against origin/main — nothing to review.');
  process.exit(0);
}
const token = process.env.FIGMA_TOKEN;
if (!token) {
  console.error(
    'Set FIGMA_TOKEN (a Figma personal access token, File content: read) to fetch the frames.',
  );
  process.exit(1);
}

// Playwright stores `<id>@<width>.png` as `<id>-<width>.png` (it sanitises the `@`).
const rows = changed.map((file) => {
  const [, id, width] = file.match(/^(.+)-(\d+)\.png$/) ?? [];
  const frame = STATES[id]?.widths?.[Number(width)] ?? null;
  return { file, id, width: Number(width), frame };
});

rmSync(OUT, { recursive: true, force: true });
for (const dir of ['figma', 'build', 'old']) mkdirSync(path.join(OUT, dir), { recursive: true });

// One Images API call for every frame (scale 1: the frame's own size).
const nodes = [...new Set(rows.filter((r) => r.frame).map((r) => r.frame.node))];
const urls = {};
if (nodes.length > 0) {
  const res = await fetch(
    `https://api.figma.com/v1/images/${FILE_KEY}?ids=${encodeURIComponent(nodes.join(','))}&format=png&scale=1`,
    { headers: { 'X-Figma-Token': token } },
  );
  if (!res.ok) throw new Error(`Figma Images API answered ${res.status}`);
  Object.assign(urls, (await res.json()).images);
}
for (const row of rows) {
  const repoPath = `${SHOTS}/${row.file}`;
  copyFileSync(path.join(WEB, repoPath), path.join(OUT, 'build', row.file));
  try {
    writeFileSync(
      path.join(OUT, 'old', row.file),
      // stderr ignored: a new baseline has no old one, and git says so ("fatal: …").
      execFileSync('git', ['show', `origin/main:apps/web/${repoPath}`], {
        cwd: WEB,
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    );
    row.old = true;
  } catch {
    row.old = false; // a new baseline
  }
  const url = row.frame && urls[row.frame.node];
  if (url) {
    const png = Buffer.from(await (await fetch(url)).arrayBuffer());
    writeFileSync(path.join(OUT, 'figma', row.file), png);
    row.figma = true;
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const figmaCell = (r) => {
  if (!r.frame) return '<p class="none">no frame — baselined without a design</p>';
  if (!r.figma) return '<p class="none">frame not returned by the Figma API</p>';
  const phone = r.width === 390;
  const top = phone ? STATUS_BAR : 0;
  const height = r.frame.frame - (phone ? STATUS_BAR + HOME_INDICATOR : 0);
  return `<div class="crop" style="height:${height}px"><img src="figma/${esc(r.file)}" style="margin-top:-${top}px"></div>`;
};
const html = `<!doctype html><meta charset="utf-8"><title>Screens review</title>
<style>
body{font:14px system-ui;margin:24px;color:#2a1a10;background:#fffaf2}
h2{margin:32px 0 8px;font-size:16px} .grid{display:flex;gap:16px;align-items:flex-start;overflow-x:auto}
figure{margin:0} figcaption{font-weight:600;margin-bottom:4px} img{display:block;border:1px solid #d9c9b4}
.crop{overflow:hidden} .none{color:#8a6d55;font-style:italic;width:200px}
.overlay{position:relative;overflow:hidden} .overlay img+img{position:absolute;inset:0;opacity:.5}
a{color:#6b3a1f}
</style>
<h1>Screens review — ${rows.length} baseline${rows.length === 1 ? '' : 's'} added or changed</h1>
<p>Approve each only when it <b>matches its Figma frame</b>; open the frame for its <i>Content</i> /
<i>Differs from the build</i> annotations (Dev Mode). Phone frames are shown below the 47-px status
bar and above the 34-px home indicator.</p>
${rows
  .map(
    (
      r,
    ) => `<h2>${esc(r.id)} @${r.width}${r.old ? '' : ' — new'}${r.frame ? ` · <a href="https://www.figma.com/design/${FILE_KEY}/Brewlite?node-id=${r.frame.node.replace(':', '-')}">open frame ${esc(r.frame.node)}</a>` : ''}</h2>
<div class="grid">
<figure><figcaption>Figma</figcaption>${figmaCell(r)}</figure>
<figure><figcaption>Build (new baseline)</figcaption><img src="build/${esc(r.file)}" width="${VIEWPORT[r.width]?.width ?? r.width}"></figure>
<figure><figcaption>Old baseline</figcaption>${r.old ? `<img src="old/${esc(r.file)}" width="${VIEWPORT[r.width]?.width ?? r.width}">` : '<p class="none">none — a new state</p>'}</figure>
${r.figma ? `<figure><figcaption>Overlay <input type="range" min="0" max="100" value="50" oninput="this.closest('figure').querySelector('.overlay img+img').style.opacity=this.value/100"></figcaption><div class="overlay"><img src="build/${esc(r.file)}"><img src="figma/${esc(r.file)}" style="margin-top:-${r.width === 390 ? STATUS_BAR : 0}px"></div></figure>` : ''}
</div>`,
  )
  .join('\n')}`;
writeFileSync(path.join(OUT, 'index.html'), html);
console.log(
  `Review written: ${path.relative(process.cwd(), path.join(OUT, 'index.html'))} (${rows.length} rows)`,
);
