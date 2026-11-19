import { defineConfig } from 'vitest/config';
import { coverageRun } from '../../packages/config/vitest.preset.mjs';

// The web's Vitest share of its coverage (`coverage/vitest/lcov.info`); `scripts/coverage-report.mjs`
// unions it with the e2e run's browser and server V8. Every `src/` file is listed, so a file no
// test loads still counts, at 0 %.
const config = coverageRun(['./vitest.config.mts']);
config.test.coverage.reportsDirectory = 'coverage/vitest';
export default defineConfig(config);
