export function buildImageUrl(
  imagePath: string | null,
  opts: { baseUrl: string; bucket: string },
): string | undefined {
  if (imagePath === null) return undefined;
  return `${opts.baseUrl}/v0/b/${opts.bucket}/o/${encodeURIComponent(imagePath)}?alt=media`;
}
