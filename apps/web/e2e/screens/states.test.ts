import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isSkipped, STATES } from './states';

// The state map and the screens suite cannot drift apart: a text scan of the specs' `look()` calls.
const dir = new URL('./', import.meta.url);
const specs = readdirSync(dir).filter((f) => f.endsWith('.spec.ts'));
const looked = specs.flatMap((f) =>
  [...readFileSync(new URL(f, dir), 'utf8').matchAll(/\blook\(\s*\w+,\s*'([^']+)'/g)].map(
    (m) => m[1]!,
  ),
);

describe('the screens state list', () => {
  it('draws every state that is not skipped, exactly once', () => {
    const drawn = Object.entries(STATES)
      .filter(([, s]) => !isSkipped(s))
      .map(([id]) => id);
    for (const id of drawn)
      expect(
        looked.filter((l) => l === id),
        id,
      ).toHaveLength(1);
  });
  it('looks only at states the list knows, and never at a skipped one', () => {
    for (const id of looked) {
      expect(STATES[id], `${id} is not in states.ts`).toBeDefined();
      expect(isSkipped(STATES[id]!), `${id} is skipped`).toBe(false);
    }
  });
  it('gives every skip its reason and every drawn width a viewport', () => {
    for (const [id, s] of Object.entries(STATES)) {
      if (isSkipped(s)) expect(s.skip.length, id).toBeGreaterThan(10);
      else expect(Object.keys(s.widths).length, id).toBeGreaterThan(0);
    }
  });
});
