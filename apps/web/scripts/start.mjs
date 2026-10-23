import { cpSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// `next start` does not work with `output: 'standalone'`. This runs the same server.js the
// Docker image runs, after putting the static assets and public/ next to it (the image's COPY steps).
const app = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const standalone = app('.next/standalone/apps/web');
if (!existsSync(`${standalone}/server.js`)) {
  console.error('no standalone build — run `pnpm build` first');
  process.exit(1);
}
cpSync(app('.next/static'), `${standalone}/.next/static`, { recursive: true });
cpSync(app('public'), `${standalone}/public`, { recursive: true });

const server = spawn(process.execPath, [`${standalone}/server.js`], {
  stdio: 'inherit',
  env: { ...process.env, PORT: '23000', HOSTNAME: '0.0.0.0' },
});
server.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
