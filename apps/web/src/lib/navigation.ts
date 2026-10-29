function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Keeps a `next` target on this site. A leading `//` or a backslash would be read as
 * another origin by browsers, so both are rejected (open-redirect guard).
 */
export function safeNextPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || value.length > 512) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  if (hasControlCharacter(value)) return fallback;
  return value;
}
