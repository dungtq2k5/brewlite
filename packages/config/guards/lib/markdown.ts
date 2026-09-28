export interface TableRow {
  cells: string[];
  line: number;
}

/**
 * The rows of the first markdown table under a heading line (matched exactly, e.g.
 * `#### Table O-1: orders`), stopping at the next line starting with `#`. Skips the
 * header row and the `:----` delimiter row.
 */
export function tableRows(doc: string, heading: string): TableRow[] {
  const lines = doc.split('\n');
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) return [];

  const rows: TableRow[] = [];
  let sawHeaderRow = false;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('#')) break;
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    if (!sawHeaderRow) {
      sawHeaderRow = true; // this is the header row
      continue;
    }
    // A `\|` inside a cell is markdown's escape for a literal pipe, not a separator.
    const body = trimmed.slice(1, trimmed.endsWith('|') ? -1 : undefined);
    const cells = body.split(/(?<!\\)\|/).map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue; // delimiter row
    rows.push({ cells, line: i + 1 });
  }
  return rows;
}

/**
 * Every backticked span in a cell, stripped of the backticks. A span's own content is
 * further split on a literal `\|` (markdown's escaped pipe, used to list enum values
 * inside one span).
 */
export function backticked(cell: string): string[] {
  return [...cell.matchAll(/`([^`]*)`/g)].flatMap((match) =>
    match[1]!.split('\\|').map((value) => value.trim()),
  );
}

/**
 * The cell's *leading* backticked span, split on `\|` — never a later, unrelated
 * backtick span in the same cell's prose. `undefined` unless the cell starts with a
 * backtick whose content is itself a `\|`-joined list of SCREAMING_SNAKE tokens (an enum
 * span, not an inline code reference like `` `CHECK (...)` `` or a single identifier).
 */
export function leadingEnumSpan(cell: string): string[] | undefined {
  const match = /^`([^`]*)`/.exec(cell);
  if (!match) return undefined;
  const content = match[1]!;
  if (!/^[A-Za-z][A-Za-z0-9_]*(\s*\\\|\s*[A-Za-z][A-Za-z0-9_]*)+$/.test(content)) return undefined;
  return content.split('\\|').map((value) => value.trim());
}
