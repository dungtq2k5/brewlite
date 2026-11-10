export type RefreshOutcome =
  | { kind: 'refreshed'; accessToken: string; accessTokenExpiresAt: string }
  | { kind: 'expired' }
  | { kind: 'unchanged' };

/**
 * `POST /auth/refresh`. The second sanctioned hand-written fetch (after the SSE handlers):
 * `proxy.ts` has no `headers()`, which the generated client needs. `401` → the session is
 * over; a network failure or any other answer → leave the cookies as they are.
 */
export async function refreshAccessToken(
  apiUrl: string,
  refreshToken: string,
  forwardedFor: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<RefreshOutcome> {
  try {
    const response = await fetchImpl(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(forwardedFor && { 'X-Forwarded-For': forwardedFor }),
      },
      body: JSON.stringify({ refreshToken }),
    });
    if (response.status === 401) return { kind: 'expired' };
    if (!response.ok) return { kind: 'unchanged' };
    const body = (await response.json()) as {
      data?: { accessToken?: string; accessTokenExpiresAt?: string };
    };
    const { accessToken, accessTokenExpiresAt } = body.data ?? {};
    return accessToken && accessTokenExpiresAt
      ? { kind: 'refreshed', accessToken, accessTokenExpiresAt }
      : { kind: 'unchanged' };
  } catch {
    return { kind: 'unchanged' };
  }
}
