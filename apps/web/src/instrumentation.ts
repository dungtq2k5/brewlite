import type { Instrumentation } from 'next';

/**
 * Logs a server render error with its digest and the request id the gateway saw — the digest
 * is what the 500 page shows, so support can join the two.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  const requestId = request.headers['x-request-id'];
  const digest = (error as { digest?: string }).digest;
  console.error(JSON.stringify({ msg: 'render error', digest, requestId, path: request.path }));
};
