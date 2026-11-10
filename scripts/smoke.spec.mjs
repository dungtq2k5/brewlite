import { describe, expect, it } from 'vitest';
import { healthReport, LOCAL_OPS_URLS, nameFor, parseOpsUrls } from './smoke-lib.mjs';

describe('parseOpsUrls', () => {
  it('defaults to the four local ops ports when unset', () => {
    expect(parseOpsUrls(undefined)).toEqual(LOCAL_OPS_URLS);
  });
  it('is none when set empty — a deployment checks only the gateway', () => {
    expect(parseOpsUrls('')).toEqual([]);
    expect(parseOpsUrls(' , ')).toEqual([]);
  });
  it('splits a list, trimming blanks and trailing slashes', () => {
    expect(parseOpsUrls(' http://a:1/, http://b:2 ,')).toEqual(['http://a:1', 'http://b:2']);
  });
});

describe('nameFor', () => {
  it('names the local services by port, anything else by its URL', () => {
    expect(nameFor('http://localhost:23103')).toBe('ordering');
    expect(nameFor('https://api.example.com')).toBe('https://api.example.com');
    expect(nameFor('not a url')).toBe('not a url');
  });
});

describe('healthReport', () => {
  it('passes only when every check passed, and lines up the names', () => {
    const report = healthReport([
      { name: 'gateway', ok: true, ms: 12 },
      { name: 'ordering', ok: false, error: 'connection refused' },
    ]);
    expect(report.ok).toBe(false);
    expect(report.lines).toEqual(['✓ gateway   ready (12 ms)', '✗ ordering  connection refused']);
    expect(healthReport([{ name: 'gateway', ok: true, ms: 1 }]).ok).toBe(true);
  });
});
