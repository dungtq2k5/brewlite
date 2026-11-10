/**
 * `next` only when it is a same-origin relative path (conventions §11.7); otherwise `/`.
 * One leading `/`, no `\`, no scheme, no control characters.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  if (
    next.includes('\\') ||
    [...next].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)
  ) {
    return '/';
  }
  return next;
}
