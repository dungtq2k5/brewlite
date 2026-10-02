export interface ApiClientConfig {
  /** The gateway's origin plus its prefix, e.g. `http://localhost:23100/api/v1`. */
  baseUrl: string;
  /**
   * Called per request. The web app supplies `Authorization`, `X-Request-Id` and
   * `X-Forwarded-For` from the incoming request — this package imports nothing from Next.js.
   */
  getRequestHeaders: () => Promise<Record<string, string>> | Record<string, string>;
}

let current: ApiClientConfig | undefined;

export function configureApiClient(config: ApiClientConfig): void {
  current = config;
}

export function apiClientConfig(): ApiClientConfig {
  if (!current) throw new Error('api-client is not configured — call configureApiClient() first');
  return current;
}
