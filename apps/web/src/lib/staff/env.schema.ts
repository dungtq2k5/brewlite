import 'server-only';
export function gatewayBaseUrl(): string {
  const value = process.env.GATEWAY_URL || 'http://127.0.0.1:23100';
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('Invalid gateway configuration');
  }
  return `${url.origin}/api/v1`;
}
