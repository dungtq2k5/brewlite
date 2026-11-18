import { defineConfig } from 'vitest/config';
import { coverageRun } from '../../packages/config/vitest.preset.mjs';

// `test:coverage`: every tier of this package in one run, so the report is their union.
export default defineConfig(
  coverageRun(['./vitest.config.mts', './vitest.integration.config.mts'], { shared: true }),
);
