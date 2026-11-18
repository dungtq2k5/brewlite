/**
 * What coverage never counts — one list for Vitest, the web's merge and SonarCloud
 * (`sonar-project.properties` repeats it; a spec keeps the two equal). Generated code, entry
 * points with no logic, declarations, tests and scripts. Nothing else: code that cannot reach
 * 90 % gets tests or a recorded reason, never a silent exclusion.
 */
export const COVERAGE_EXCLUDE = [
  '**/generated/**',
  '**/prisma/migrations/**',
  '**/openapi.json',
  '**/src/main.ts',
  '**/instrumentation.ts',
  '**/*.d.ts',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.spec.mjs',
  '**/test/**',
  '**/e2e/**',
  '**/scripts/**',
];

/** The threshold, per package, by Sonar's formula (lines + conditions). */
export const COVERAGE_MIN = 90;
