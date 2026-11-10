import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';

// Silent unless `TEST_LOGS=1`. Spies on a logger still see every call.
if (!process.env.TEST_LOGS) {
  // Nest's own `Logger` (a service built without an app logger falls back to `ConsoleLogger`).
  Logger.overrideLogger(false);
  // Every `Test.createTestingModule().compile()` installs `TestingLogger`, which prints errors.
  // Resolved from the project under test — the copy its specs load (`@nestjs/testing` has no
  // `exports` map, and is not a dependency of this package).
  try {
    const { TestingLogger } = createRequire(join(process.cwd(), 'package.json'))(
      '@nestjs/testing/services/testing-logger.service.js',
    ) as { TestingLogger: { prototype: { error: () => void } } };
    TestingLogger.prototype.error = () => undefined;
  } catch {
    // A project without @nestjs/testing never compiles a testing module.
  }
}
