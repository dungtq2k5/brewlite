import { describe, expect, it } from 'vitest';
import { mergeLcov } from './coverage-lcov.mjs';

const record = (merged: string, sf: string) =>
  merged.split(`SF:${sf}\n`)[1].split('end_of_record')[0];

describe('mergeLcov', () => {
  it('unions lines across the runs that executed a file; keeps the run with the most conditions', () => {
    const a = 'SF:src/x.ts\nBRDA:1,0,0,1\nBRDA:1,0,1,0\nDA:1,1\nDA:2,0\nend_of_record\n';
    const b = 'SF:src/x.ts\nBRDA:1,7,0,1\nBRDA:1,7,1,1\nDA:2,3\nDA:3,0\nend_of_record\n';
    const x = record(mergeLcov([a, b]), 'src/x.ts');
    expect(x).toContain('LF:3\nLH:2\n');
    expect(x).toContain('BRF:2\nBRH:2\n');
  });

  it("ignores a run's 0-hit placeholder for a file another run measured", () => {
    const placeholder = 'SF:src/v.tsx\nDA:1,0\nDA:2,0\nDA:3,0\nDA:4,0\nend_of_record\n';
    const measured = 'SF:src/v.tsx\nDA:2,1\nDA:3,0\nend_of_record\n';
    expect(record(mergeLcov([placeholder, measured]), 'src/v.tsx')).toContain('LF:2\nLH:1\n');
  });

  it('keeps a file no run executed, at 0 %, with its largest placeholder', () => {
    const a = 'SF:src/y.ts\nDA:1,0\nend_of_record\n';
    const b = 'SF:src/y.ts\nDA:1,0\nDA:2,0\nend_of_record\n';
    expect(record(mergeLcov([a, b]), 'src/y.ts')).toContain('LF:2\nLH:0\n');
  });
});
