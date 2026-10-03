const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

function startsWith(bytes: Uint8Array, offset: number, magic: number[]): boolean {
  if (bytes.length < offset + magic.length) return false;
  return magic.every((byte, i) => bytes[offset + i] === byte);
}

export function detectImageType(bytes: Uint8Array): 'jpg' | 'png' | 'webp' | null {
  if (startsWith(bytes, 0, JPEG)) return 'jpg';
  if (startsWith(bytes, 0, PNG)) return 'png';
  if (startsWith(bytes, 0, RIFF) && startsWith(bytes, 8, WEBP)) return 'webp';
  return null;
}
