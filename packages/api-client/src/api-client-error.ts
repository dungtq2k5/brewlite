/** Every non-2xx answer — the gateway's error envelope parsed (api-endpoints-plan §0.3). */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details: unknown,
    readonly requestId: string | undefined,
  ) {
    super(`${status} ${code}`);
    this.name = 'ApiClientError';
  }
}
