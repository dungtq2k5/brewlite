// The pure parts of `scripts/coverage-check.mjs`, tested in coverage-check.spec.mjs.

/** One lcov file, per source file: line → hits (`DA`), branch → hits (`BRDA`; `-` is 0). */
export function parseLcov(text) {
  const files = new Map();
  let cur;
  for (const line of text.split('\n')) {
    if (line.startsWith('SF:')) {
      const sf = line.slice(3);
      if (!files.has(sf)) files.set(sf, { lines: new Map(), branches: new Map() });
      cur = files.get(sf);
    } else if (cur && line.startsWith('DA:')) {
      const [n, hits] = line.slice(3).split(',');
      cur.lines.set(n, (cur.lines.get(n) ?? 0) + Number(hits));
    } else if (cur && line.startsWith('BRDA:')) {
      const parts = line.slice(5).split(',');
      const hits = parts[3] === '-' ? 0 : Number(parts[3]);
      const key = parts.slice(0, 3).join(',');
      cur.branches.set(key, (cur.branches.get(key) ?? 0) + hits);
    } else if (line === 'end_of_record') {
      cur = undefined;
    }
  }
  return files;
}

/**
 * The union of several reports, per file: a line or a branch is covered when any run covered it.
 * A shared package's file appears in its own report and in every service's that executed it.
 */
export function unionReports(texts) {
  const all = new Map();
  for (const text of texts) {
    for (const [sf, { lines, branches }] of parseLcov(text)) {
      if (!all.has(sf)) all.set(sf, { lines: new Map(), branches: new Map() });
      const into = all.get(sf);
      for (const [k, v] of lines) into.lines.set(k, (into.lines.get(k) ?? 0) + v);
      for (const [k, v] of branches) into.branches.set(k, (into.branches.get(k) ?? 0) + v);
    }
  }
  return all;
}

/** Totals per package: each file goes to the package whose directory it is under. */
export function packageTotals(files, packages) {
  const totals = new Map(
    packages.map((p) => [p, { lines: 0, linesHit: 0, conditions: 0, conditionsHit: 0 }]),
  );
  for (const [sf, { lines, branches }] of files) {
    const pkg = packages.find((p) => sf.startsWith(`${p}/`));
    if (!pkg) continue;
    const t = totals.get(pkg);
    t.lines += lines.size;
    t.linesHit += [...lines.values()].filter((h) => h > 0).length;
    t.conditions += branches.size;
    t.conditionsHit += [...branches.values()].filter((h) => h > 0).length;
  }
  return totals;
}

/**
 * SonarCloud's coverage: `(covered lines + covered conditions) / (lines + conditions)`, in %,
 * so our number and theirs agree. Nothing to cover counts as fully covered.
 */
export function sonarCoverage({ lines, linesHit, conditions, conditionsHit }) {
  const total = lines + conditions;
  return total === 0 ? 100 : ((linesHit + conditionsHit) / total) * 100;
}

/**
 * One row per package. The bar is `min`, or the package's ratchet floor when it has one (the web,
 * until it reaches `min`). A package without its own report fails.
 */
export function coverageRows(totals, { min, floors = {}, missing = [] }) {
  return [...totals].map(([name, t]) => {
    const bar = floors[name] ?? min;
    if (missing.includes(name)) return { name, pct: undefined, bar, ok: false };
    const pct = sonarCoverage(t);
    return { name, pct, bar, ok: pct >= bar };
  });
}
