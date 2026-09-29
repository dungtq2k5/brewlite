import { describe, expect, it } from 'vitest';
import { detectImageType } from './image-type.js';

describe('detectImageType', () => {
  it('detects JPEG', () => {
    expect(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
  });

  it('detects PNG', () => {
    expect(
      detectImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])),
    ).toBe('png');
  });

  it('detects WebP', () => {
    const bytes = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WEBP'),
    ]);
    expect(detectImageType(bytes)).toBe('webp');
  });

  it('rejects a GIF', () => {
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
  });

  it('rejects a PDF', () => {
    expect(detectImageType(Buffer.from('%PDF-1.4'))).toBeNull();
  });

  it('rejects a buffer too short to hold any magic number', () => {
    expect(detectImageType(Uint8Array.from([0xff, 0xd8]))).toBeNull();
  });

  it('rejects a RIFF file that is not WebP (e.g. WAVE)', () => {
    const bytes = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WAVE'),
    ]);
    expect(detectImageType(bytes)).toBeNull();
  });
});
