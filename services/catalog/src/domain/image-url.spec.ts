import { describe, expect, it } from 'vitest';
import { buildImageUrl } from './image-url.js';

const opts = { baseUrl: 'http://localhost:29199', bucket: 'demo-brewlite.appspot.com' };

describe('buildImageUrl', () => {
  it('is undefined when there is no path', () => {
    expect(buildImageUrl(null, opts)).toBeUndefined();
  });

  it('encodes the `/` in the object path (Firebase Storage object names use %2F, not raw slashes)', () => {
    const url = buildImageUrl('products/01a0d799-fda1-7c3e-8da5-3b5de192d879/abc.jpg', opts);
    expect(url).toBe(
      'http://localhost:29199/v0/b/demo-brewlite.appspot.com/o/products%2F01a0d799-fda1-7c3e-8da5-3b5de192d879%2Fabc.jpg?alt=media',
    );
  });
});
