import { describe, expect, it } from 'vitest';
import { pageChangedBy } from './probe-rule';

describe('pageChangedBy', () => {
  it.each([204, 401, 403, 404])('%i changes what the page shows', (status) => {
    expect(pageChangedBy(status)).toBe(true);
  });

  it.each([0, 200, 500, 502, 503])('%i is the API being down or fine — no re-read', (status) => {
    expect(pageChangedBy(status)).toBe(false);
  });
});
