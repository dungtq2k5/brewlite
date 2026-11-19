import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The browser every baseline is drawn in: Playwright's own server inside the official Playwright
 * image at exactly the lockfile's `@playwright/test` version. A screenshot is a function of the
 * fonts and the renderer, so this one image draws them all — here, on another machine and in CI.
 *
 * The server runs from the repo's own `node_modules`, mounted read-only (pnpm's store, so the CLI
 * is reached by its real path); nothing is downloaded into the container. The rows connect with
 * `exposeNetwork: '<loopback>'`, so the browser reaches the app on this machine's localhost
 * through the client — no host networking.
 */
export const BROWSER_PORT = 3941;
export const BROWSER_WS = `ws://127.0.0.1:${BROWSER_PORT}/`;
const CONTAINER = 'brewlite-screens-browser';
const REPO = fileURLToPath(new URL('../../../../', import.meta.url));

function playwrightVersion(): string {
  const pkg = JSON.parse(
    readFileSync(
      new URL('../../node_modules/@playwright/test/package.json', import.meta.url),
      'utf8',
    ),
  ) as { version: string };
  return pkg.version;
}

/** `mcr.microsoft.com/playwright:v<lockfile version>-noble`. */
export const browserImage = () => `mcr.microsoft.com/playwright:v${playwrightVersion()}-noble`;

export async function startBrowserServer(): Promise<void> {
  stopBrowserServer();
  const version = playwrightVersion();
  execFileSync(
    'docker',
    [
      'run',
      '--detach',
      '--rm',
      '--init',
      '--name',
      CONTAINER,
      '--user',
      'pwuser',
      '--publish',
      `127.0.0.1:${BROWSER_PORT}:${BROWSER_PORT}`,
      '--volume',
      `${REPO}node_modules:/repo/node_modules:ro`,
      browserImage(),
      'node',
      `/repo/node_modules/.pnpm/@playwright+test@${version}/node_modules/@playwright/test/cli.js`,
      'run-server',
      '--port',
      String(BROWSER_PORT),
      '--host',
      '0.0.0.0',
    ],
    { stdio: 'pipe' },
  );
  await waitForServer(60_000);
}

export function stopBrowserServer(): void {
  try {
    execFileSync('docker', ['rm', '--force', CONTAINER], { stdio: 'pipe' });
  } catch {
    // Not running: nothing to stop.
  }
}

/**
 * Waits for the server itself, not just the port: Docker's proxy accepts a connection before the
 * server inside listens, and the first row would then hang up. The server answers plain HTTP.
 */
async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await fetch(`http://127.0.0.1:${BROWSER_PORT}/`, {
      signal: AbortSignal.timeout(2_000),
    }).then(
      (r) => r.ok,
      () => false,
    );
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`the Playwright browser server never answered on ${BROWSER_PORT}`);
}
