import { describe, expect, it } from 'vitest';
import {
  ERRORS,
  EVENT_SCHEMAS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  RATE_LIMITS,
  Role,
  compareStrings,
} from '@brewlite/contracts';
import { backticked, tableRows } from './lib/markdown.js';
import { gitFiles, readRepoFile } from './lib/corpus.js';

interface Violation {
  file: string;
  line: number;
  message: string;
}

const FILE = 'docs/api-endpoints-plan.md';

function checkErrors(doc: string): Violation[] {
  const violations: Violation[] = [];
  const rows = tableRows(doc, '## 7. Error codes');
  const docCodes = new Map<string, { http: number; line: number }>();
  for (const row of rows) {
    const codes = backticked(row.cells[0] ?? '');
    const http = Number.parseInt(row.cells[1] ?? '', 10);
    for (const code of codes) docCodes.set(code, { http, line: row.line });
  }

  const codeCodes = new Set(Object.keys(ERRORS));
  for (const [code, { http, line }] of docCodes) {
    if (!codeCodes.has(code)) {
      violations.push({
        file: FILE,
        line,
        message: `${code} is in api-endpoints-plan §7 but not in ERRORS`,
      });
      continue;
    }
    const definitionHttp = (ERRORS as Record<string, { http: number }>)[code]!.http;
    if (definitionHttp !== http) {
      violations.push({
        file: FILE,
        line,
        message: `${code} HTTP status ${http} in §7 does not match ERRORS.${code}.http (${definitionHttp})`,
      });
    }
  }
  for (const code of codeCodes) {
    if (!docCodes.has(code)) {
      violations.push({
        file: FILE,
        line: 0,
        message: `${code} is in ERRORS but not in api-endpoints-plan §7`,
      });
    }
  }
  return violations;
}

function checkPermissions(doc: string): Violation[] {
  const violations: Violation[] = [];
  const section = doc.split('## 10. Permission registry')[1]?.split('\n## ')[0] ?? '';
  const fence = /```text\n([\s\S]*?)```/.exec(section);
  const docPermissions = new Set((fence?.[1] ?? '').match(/[a-z]+(?:\.[a-z]+)+/g) ?? []);

  const codePermissions = new Set<string>(PERMISSIONS);
  for (const code of codePermissions) {
    if (!docPermissions.has(code)) {
      violations.push({
        file: FILE,
        line: 0,
        message: `${code} is in PERMISSIONS but not in api-endpoints-plan §10`,
      });
    }
  }
  for (const code of docPermissions) {
    if (!codePermissions.has(code)) {
      violations.push({
        file: FILE,
        line: 0,
        message: `${code} is in api-endpoints-plan §10 but not in PERMISSIONS`,
      });
    }
  }

  const roleRows = tableRows(doc, '| Role | Grants |');
  for (const row of roleRows) {
    const roleCell = (row.cells[0] ?? '').replaceAll('`', '');
    const grantsCell = row.cells[1] ?? '';
    if (roleCell === 'CUSTOMER') {
      if (ROLE_PERMISSIONS[Role.CUSTOMER].length !== 0) {
        violations.push({
          file: FILE,
          line: row.line,
          message: 'ROLE_PERMISSIONS.CUSTOMER is not empty',
        });
      }
      continue;
    }
    if (roleCell === 'ADMIN') {
      if (ROLE_PERMISSIONS[Role.ADMIN].length !== codePermissions.size) {
        violations.push({
          file: FILE,
          line: row.line,
          message: 'ROLE_PERMISSIONS.ADMIN is not every code',
        });
      }
      continue;
    }
    if (roleCell === 'STAFF') {
      const docStaff = new Set(grantsCell.match(/`([a-z.]+)`/g)?.map((s) => s.replaceAll('`', '')));
      const codeStaff = new Set(ROLE_PERMISSIONS[Role.STAFF]);
      for (const p of docStaff)
        if (!codeStaff.has(p as never))
          violations.push({
            file: FILE,
            line: row.line,
            message: `STAFF grants ${p} in the doc but not in ROLE_PERMISSIONS`,
          });
      for (const p of codeStaff)
        if (!docStaff.has(p))
          violations.push({
            file: FILE,
            line: row.line,
            message: `STAFF grants ${p} in ROLE_PERMISSIONS but not in the doc`,
          });
    }
  }
  return violations;
}

function parseWindow(window: string): number {
  // "120 / min" -> 60_000; "10 / 15 min" -> 15 * 60_000
  const match = /\/\s*(\d+\s+)?min/.exec(window);
  const minutes = match?.[1] ? Number.parseInt(match[1], 10) : 1;
  return minutes * 60_000;
}

function checkRateLimits(doc: string): Violation[] {
  const violations: Violation[] = [];
  const rows = tableRows(doc, '### 0.8 Rate limits');
  const docClasses = new Map<
    string,
    { keys: string[]; limit: number; ttlMs: number; line: number }
  >();
  for (const row of rows) {
    const cls = (row.cells[0] ?? '').replaceAll('`', '');
    if (cls === 'none') continue;
    const keys = (row.cells[1] ?? '')
      .replaceAll('**', '')
      .toLowerCase()
      .split(/\s+and\s+|,\s*/)
      .map((k) => k.trim())
      .filter(Boolean);
    const limitCell = row.cells[2] ?? '';
    const limit = Number.parseInt(limitCell, 10);
    docClasses.set(cls, { keys, limit, ttlMs: parseWindow(limitCell), line: row.line });
  }

  const codeClasses = RATE_LIMITS as Record<
    string,
    { keys: readonly string[]; limit: number; ttlMs: number }
  >;
  for (const [cls, doc_] of docClasses) {
    const codeDef = codeClasses[cls];
    if (!codeDef) {
      violations.push({
        file: FILE,
        line: doc_.line,
        message: `${cls} is in api-endpoints-plan §0.8 but not in RATE_LIMITS`,
      });
      continue;
    }
    if (codeDef.limit !== doc_.limit) {
      violations.push({
        file: FILE,
        line: doc_.line,
        message: `${cls} limit ${doc_.limit} does not match RATE_LIMITS.${cls}.limit (${codeDef.limit})`,
      });
    }
    if (codeDef.ttlMs !== doc_.ttlMs) {
      violations.push({
        file: FILE,
        line: doc_.line,
        message: `${cls} window does not match RATE_LIMITS.${cls}.ttlMs`,
      });
    }
    const codeKeys = [...codeDef.keys].sort(compareStrings);
    const docKeys = [...doc_.keys].sort(compareStrings);
    if (JSON.stringify(codeKeys) !== JSON.stringify(docKeys)) {
      violations.push({
        file: FILE,
        line: doc_.line,
        message: `${cls} keys do not match RATE_LIMITS.${cls}.keys`,
      });
    }
  }
  for (const cls of Object.keys(codeClasses)) {
    if (!docClasses.has(cls)) {
      violations.push({
        file: FILE,
        line: 0,
        message: `${cls} is in RATE_LIMITS but not in api-endpoints-plan §0.8`,
      });
    }
  }
  return violations;
}

function checkEvents(doc: string): Violation[] {
  const violations: Violation[] = [];
  const rows = tableRows(doc, '## 8. JetStream events');
  const docSubjects = new Map<string, number>();
  for (const row of rows) {
    for (const subject of backticked(row.cells[0] ?? '')) docSubjects.set(subject, row.line);
  }

  const codeSubjects = new Set(Object.keys(EVENT_SCHEMAS));
  for (const [subject, line] of docSubjects) {
    if (!codeSubjects.has(subject)) {
      violations.push({
        file: FILE,
        line,
        message: `${subject} is in api-endpoints-plan §8 but not declared in EVENT_SCHEMAS`,
      });
    }
  }
  for (const subject of codeSubjects) {
    if (!docSubjects.has(subject)) {
      violations.push({
        file: FILE,
        line: 0,
        message: `${subject} is declared in EVENT_SCHEMAS but not in api-endpoints-plan §8`,
      });
    }
  }
  return violations;
}

/**
 * Planned routes that are deliberately not in `openapi.json`, one reason each — anything
 * else planned-but-missing, or built-but-unplanned, fails.
 */
const OPENAPI_EXCLUSIONS = new Map<string, string>([
  ['GET /health', 'ops route, served on the gateway but excluded from the document'],
  ['GET /health/ready', 'ops route'],
  ['GET /version', 'ops route'],
  ['GET /docs', 'Swagger UI itself'],
  ['GET /orders/:id/events', 'SSE stream — the generated client cannot consume a stream'],
  ['GET /staff/orders/events', 'SSE stream'],
  ['POST /api/webhooks/stripe', 'signature-authenticated webhook, not for the client'],
  ['POST /payments/:id/fake-confirm', 'test-only route; 404 in production'],
]);

/** The P1 marker sits right after the path: `| GET | `/admin/orders` *(P1)* |`. */
const ROUTE_ROW = /^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`(\s*\*\(P1\)\*)?/;

function plannedRoutes(doc: string): Map<string, number> {
  const lines = doc.split('\n');
  const start = lines.findIndex((l) => l.startsWith('## 1. `identity`'));
  const end = lines.findIndex((l) => l.startsWith('## 5. Server-sent events'));
  const routes = new Map<string, number>();
  for (let i = start; i !== -1 && i < end; i++) {
    const line = lines[i]!;
    const match = ROUTE_ROW.exec(line);
    if (!match || match[3]) continue;
    routes.set(`${match[1]} ${match[2]}`, i + 1);
  }
  return routes;
}

function builtRoutes(openapi: string): Set<string> {
  const document = JSON.parse(openapi) as { paths?: Record<string, Record<string, unknown>> };
  const routes = new Set<string>();
  for (const [path, methods] of Object.entries(document.paths ?? {})) {
    for (const method of Object.keys(methods)) {
      routes.add(`${method.toUpperCase()} ${path.replaceAll(/\{(\w+)\}/g, ':$1')}`);
    }
  }
  return routes;
}

export function checkRoutes(doc: string, openapi: string): Violation[] {
  const violations: Violation[] = [];
  const planned = plannedRoutes(doc);
  const built = builtRoutes(openapi);
  for (const [route, line] of planned) {
    if (!built.has(route) && !OPENAPI_EXCLUSIONS.has(route)) {
      violations.push({
        file: FILE,
        line,
        message: `${route} is planned but not in services/gateway/openapi.json`,
      });
    }
  }
  for (const route of built) {
    if (!planned.has(route)) {
      violations.push({
        file: 'services/gateway/openapi.json',
        line: 0,
        message: `${route} is in openapi.json but not planned in api-endpoints-plan §1–§4`,
      });
    }
  }
  return violations;
}

const OPENAPI = 'services/gateway/openapi.json';

function check(doc: string): Violation[] {
  return [
    ...checkErrors(doc),
    ...checkPermissions(doc),
    ...checkRateLimits(doc),
    ...checkEvents(doc),
    ...checkRoutes(doc, readRepoFile(OPENAPI)),
  ];
}

describe('api-contract-sync', () => {
  it('holds over the real repo docs', () => {
    expect(check(readRepoFile(FILE))).toEqual([]);
  });

  it('reports a code renamed in the doc so a real ERRORS code is no longer covered', () => {
    const doc = readRepoFile(FILE);
    const mutated = doc.replace('`VALIDATION_FAILED`', '`RENAMED_CODE`');
    const violations = check(mutated);
    expect(
      violations.some(
        (v) =>
          v.message.includes('VALIDATION_FAILED') &&
          v.message.includes('not in api-endpoints-plan'),
      ),
    ).toBe(true);
  });

  it('reports an event subject renamed in the doc so a declared subject is no longer covered', () => {
    const doc = readRepoFile(FILE);
    const mutated = doc.replaceAll('`ordering.payment.rejected`', '`ordering.payment.renamed`');
    const violations = check(mutated);
    expect(
      violations.some(
        (v) =>
          v.message.includes('ordering.payment.rejected') &&
          v.message.includes('not in api-endpoints-plan'),
      ),
    ).toBe(true);
  });

  it('reports a permission removed from the §10 code block', () => {
    const doc = readRepoFile(FILE);
    const mutated = doc.replace('menu.manage          stock.update', 'stock.update');
    const violations = check(mutated);
    expect(violations.some((v) => v.message.includes('menu.manage'))).toBe(true);
  });

  it('the corpus is real', () => {
    expect(gitFiles()).toContain(FILE);
  });

  it('reports a route deleted from openapi.json, naming it', () => {
    const doc = readRepoFile(FILE);
    const openapi = readRepoFile(OPENAPI).replace('"/loyalty/me"', '"/loyalty/removed"');
    const messages = checkRoutes(doc, openapi).map((v) => v.message);
    expect(messages.some((m) => m.includes('GET /loyalty/me is planned but not'))).toBe(true);
    expect(messages.some((m) => m.includes('GET /loyalty/removed is in openapi.json'))).toBe(true);
  });

  it('an excluded route really is absent from openapi.json (no stale exclusions)', () => {
    const built = builtRoutes(readRepoFile(OPENAPI));
    for (const route of OPENAPI_EXCLUSIONS.keys()) {
      expect(built.has(route), `${route} is excluded but is in openapi.json`).toBe(false);
    }
  });
});
