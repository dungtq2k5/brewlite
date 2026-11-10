import { defineProject } from 'vitest/config';
import { nestProject } from '../config/vitest.preset.mjs';

export default defineProject(
  nestProject('.', {
    test: {
      name: 'nest-common',
      include: ['src/**/*.spec.ts'],
      environment: 'node',
    },
  }),
);
