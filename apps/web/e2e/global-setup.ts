import { request as playwrightRequest } from '@playwright/test';

const BASE_URL = 'http://localhost:23000';

/**
 * The E2E suite needs the same stack a developer uses. Check both the Next
 * server and one gateway route through its rewrite, so a missing service is
 * reported here rather than as a mystery timeout inside a spec.
 */
export default async function globalSetup(): Promise<void> {
  const context = await playwrightRequest.newContext({ baseURL: BASE_URL });

  try {
    const home = await context.get('/');
    if (!home.ok()) {
      throw new Error(`The web app at ${BASE_URL} answered ${home.status()}.`);
    }

    const products = await context.get('/api/v1/products');
    if (!products.ok()) {
      throw new Error(
        `The gateway behind ${BASE_URL}/api/v1 answered ${products.status()}. Start the stack with \`pnpm dev\` at the repo root.`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('answered')) throw error;
    throw new Error(
      `Cannot reach ${BASE_URL}. Start the stack with \`pnpm dev\` at the repo root, then rerun Playwright.`,
      { cause: error },
    );
  } finally {
    await context.dispose();
  }
}
