import type { ReactNode } from 'react';

/** A definition list for the record pages; keeps label/value alignment in one place. */
export function DetailList({ rows }: { rows: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="record-list">
      {rows.map((row, index) => (
        <div key={index} style={{ display: 'contents' }}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
