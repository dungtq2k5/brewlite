const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL || process.env.GATEWAY_URL || 'http://localhost:23100';

export async function fetchGateway<T>(path: string, options?: RequestInit): Promise<T | null> {
  const normalizedPath = path.startsWith('/api/v1')
    ? path
    : `/api/v1${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const { headers, ...rest } = options || {};
    const res = await fetch(`${GATEWAY_URL}${normalizedPath}`, {
      cache: 'no-store',
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...((headers as Record<string, string>) || {}),
      },
    });

    if (!res.ok) {
      console.warn(`[Gateway API Error] ${normalizedPath}: HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    return json?.data ?? json;
  } catch (err) {
    console.error(`[Gateway API Exception] ${normalizedPath}:`, err);
    return null;
  }
}
