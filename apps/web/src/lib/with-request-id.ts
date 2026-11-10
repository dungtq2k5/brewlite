/**
 * Next shows a client error boundary only the error's `digest` (the message is stripped in
 * production). Next keeps a digest that is already set, so an API error with a request id
 * carries it as its digest — the 500 page then prints the id the gateway logged (16:309).
 */
export function withRequestId<E>(error: E): E {
  const requestId = (error as { requestId?: unknown } | null)?.requestId;
  if (typeof requestId === 'string' && error instanceof Error) {
    Object.assign(error, { digest: requestId });
  }
  return error;
}
