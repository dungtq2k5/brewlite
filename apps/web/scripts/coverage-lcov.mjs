/**
 * The union of lcov files from different runs (Vitest, and the e2e run via monocart).
 *
 * Per file, only the runs that **executed** it are merged: a run that never loaded a file still
 * lists it — Vitest names every `src/` file, at 0 hits, with its own idea of which lines are
 * executable — and that placeholder must not add uncovered lines to a file another run measured
 * (CheckoutView.tsx read 32/132 lines that way: 46 measured by the e2e run, 128 placeholders).
 * A file no run executed keeps the largest placeholder, so it still counts, at 0 %.
 *
 * Lines: a line counts when a merged run lists it, covered when any hit it. Conditions: each run
 * numbers its branches its own way, so they cannot be matched one by one — the merged run that
 * covered the most is kept.
 * ponytail: conditions are per-file best-of, not a true union; one V8 pipeline would make it exact.
 */
export function mergeLcov(texts) {
  const files = new Map(); // sf → [{ lines: Map, branches: string[] }] — one entry per run
  for (const text of texts) {
    let cur;
    for (const line of text.split('\n')) {
      if (line.startsWith('SF:')) {
        const sf = line.slice(3);
        if (!files.has(sf)) files.set(sf, []);
        cur = { lines: new Map(), branches: [] };
        files.get(sf).push(cur);
      } else if (cur && line.startsWith('DA:')) {
        const [n, hits] = line.slice(3).split(',');
        cur.lines.set(n, (cur.lines.get(n) ?? 0) + Number(hits));
      } else if (cur && line.startsWith('BRDA:')) {
        cur.branches.push(line);
      } else if (line === 'end_of_record') {
        cur = undefined;
      }
    }
  }
  const hit = (brda) => !/,(-|0)$/.test(brda);
  const executed = (run) => [...run.lines.values()].some((h) => h > 0) || run.branches.some(hit);
  let out = 'TN:\n';
  for (const [sf, runs] of files) {
    const ran = runs.filter(executed);
    const merged =
      ran.length > 0 ? ran : [runs.reduce((a, b) => (b.lines.size > a.lines.size ? b : a))];
    const lines = new Map();
    for (const run of merged) {
      for (const [n, h] of run.lines) lines.set(n, (lines.get(n) ?? 0) + h);
    }
    const branches = merged
      .map((r) => r.branches)
      .reduce((best, set) => (set.filter(hit).length > best.filter(hit).length ? set : best), []);
    const sorted = [...lines].sort((a, b) => Number(a[0]) - Number(b[0]));
    out += `SF:${sf}\n`;
    for (const b of branches) out += `${b}\n`;
    out += `BRF:${branches.length}\nBRH:${branches.filter(hit).length}\n`;
    for (const [n, h] of sorted) out += `DA:${n},${h}\n`;
    out += `LF:${sorted.length}\nLH:${sorted.filter(([, h]) => h > 0).length}\nend_of_record\n`;
  }
  return out;
}
