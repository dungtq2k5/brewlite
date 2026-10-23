import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

// The service worker's cache name carries this, so a deploy's new worker drops the old assets.
const buildId = Date.now().toString(36);

const config: NextConfig = {
  generateBuildId: async () => buildId,
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  output: 'standalone',
  // The monorepo root, so the standalone trace includes the workspace packages.
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  poweredByHeader: false,
  agentRules: false,
};

export default config;
