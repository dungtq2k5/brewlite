import { config } from 'dotenv';
import { resolve } from 'node:path';

/**
 * Reads the service's `.env` into a local object — never writes `process.env`
 * (conventions §16.2). Integration and contract suites read `testEnv.DATABASE_URL_TEST`.
 */
export const testEnv = config({ path: resolve(__dirname, '../../.env'), processEnv: {} })
  .parsed as Record<string, string>;
