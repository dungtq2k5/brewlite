import { describe, expect, it } from 'vitest';
import * as contracts from '@brewlite/contracts';
import { leadingEnumSpan, tableRows, type TableRow } from './lib/markdown.js';
import { gitFiles, readRepoFile } from './lib/corpus.js';

interface Violation {
  file: string;
  line: number;
  message: string;
}

const FILE = 'docs/rdm-spec.md';

/** `'I-1.role'` → the table heading and field name to look up. */
function parseIdentifier(identifier: string): { heading: string; field: string } {
  const [table, field] = identifier.split('.') as [string, string];
  const titles: Record<string, string> = {
    'I-1': 'users',
    'I-2': 'sessions',
    'C-1': 'categories',
    'C-2': 'products',
    'C-3': 'product_sizes',
    'C-4': 'toppings',
    'C-5': 'product_toppings',
    'C-6': 'stock_reservations',
    'O-1': 'orders',
    'O-2': 'order_items',
    'O-3': 'order_status_history',
    'O-4': 'promotions',
    'O-5': 'loyalty_accounts',
    'O-6': 'loyalty_transactions',
    'P-1': 'payments',
    'P-2': 'refunds',
    'P-3': 'stripe_events',
  };
  return { heading: `#### Table ${table}: ${titles[table]}`, field };
}

function findRow(doc: string, identifier: string): TableRow | undefined {
  const { heading, field } = parseIdentifier(identifier);
  return tableRows(doc, heading).find((r) => (r.cells[0] ?? '').replaceAll('*', '') === field);
}

/** Every rdm-spec §3 column whose description begins with a backticked span of values. */
const ENUM_MAP: Record<string, readonly string[]> = {
  'I-1.role': contracts.ROLES,
  'I-1.preferred_locale': contracts.SUPPORTED_LOCALES,
  'C-3.size': contracts.PRODUCT_SIZES,
  'C-6.status': contracts.RESERVATION_STATUSES,
  'O-1.status': contracts.ORDER_STATUSES,
  'O-1.cancel_reason': contracts.CANCEL_REASONS,
  'O-1.refund_status': contracts.ORDER_REFUND_STATUSES,
  'O-2.size': contracts.PRODUCT_SIZES,
  'O-3.actor_type': contracts.ORDER_ACTOR_TYPES,
  'O-4.discount_type': contracts.DISCOUNT_TYPES,
  'O-6.kind': contracts.LOYALTY_KINDS,
  'P-1.provider': contracts.PAYMENT_PROVIDERS,
  'P-1.status': contracts.PAYMENT_STATUSES,
  'P-1.method': contracts.PAYMENT_METHODS,
  'P-1.failure_reason': contracts.PAYMENT_FAILURE_REASONS,
  'P-2.reason': contracts.REFUND_REASONS,
  'P-2.status': contracts.REFUND_STATUSES,
};

/** Every `…_MAX_LENGTH` of constants.ts § its rdm-spec column. */
const BOUND_MAP: Record<string, number> = {
  'O-1.note': contracts.ORDER_NOTE_MAX_LENGTH,
  'I-1.lock_reason': contracts.LOCK_REASON_MAX_LENGTH,
  'I-1.email': contracts.EMAIL_MAX_LENGTH,
  'I-1.full_name': contracts.FULL_NAME_MAX_LENGTH,
  'C-1.name_en': contracts.CATEGORY_NAME_MAX_LENGTH,
  'C-4.name_en': contracts.TOPPING_NAME_MAX_LENGTH,
  'C-2.name_en': contracts.PRODUCT_NAME_MAX_LENGTH,
  'C-2.description_en': contracts.PRODUCT_DESCRIPTION_MAX_LENGTH,
  'O-1.cancel_note': contracts.CANCEL_NOTE_MAX_LENGTH,
  'O-4.code': contracts.PROMO_CODE_MAX_LENGTH,
  'O-4.description': contracts.PROMO_DESCRIPTION_MAX_LENGTH,
};

/** Every table under §3 whose description column begins with a backticked span — the
 * full set the enum map above must cover (doc 01a §8.6: "every rdm column ... must be in
 * the map, so a new enumerated column cannot be added to rdm-spec alone"). */
function everyEnumBearingColumn(doc: string): string[] {
  const identifiers: string[] = [];
  for (const table of [
    'I-1',
    'I-2',
    'C-1',
    'C-2',
    'C-3',
    'C-4',
    'C-5',
    'C-6',
    'O-1',
    'O-2',
    'O-3',
    'O-4',
    'O-5',
    'O-6',
    'P-1',
    'P-2',
    'P-3',
  ]) {
    const { heading } = parseIdentifier(table);
    for (const row of tableRows(doc, heading)) {
      const description = row.cells[3] ?? '';
      if (leadingEnumSpan(description)) {
        identifiers.push(`${table}.${(row.cells[0] ?? '').replaceAll('*', '')}`);
      }
    }
  }
  return identifiers;
}

function checkEnums(doc: string): Violation[] {
  const violations: Violation[] = [];
  for (const identifier of everyEnumBearingColumn(doc)) {
    if (!(identifier in ENUM_MAP)) {
      violations.push({
        file: FILE,
        line: 0,
        message: `${identifier} has an enum span in rdm-spec but no entry in the guard's enum map`,
      });
    }
  }
  for (const [identifier, expected] of Object.entries(ENUM_MAP)) {
    const row = findRow(doc, identifier);
    if (!row) {
      violations.push({ file: FILE, line: 0, message: `${identifier} not found in rdm-spec` });
      continue;
    }
    const actual = leadingEnumSpan(row.cells[3] ?? '') ?? [];
    if (JSON.stringify(actual) !== JSON.stringify([...expected])) {
      violations.push({
        file: FILE,
        line: row.line,
        message: `${identifier}: rdm-spec lists ${JSON.stringify(actual)}, code has ${JSON.stringify(expected)}`,
      });
    }
  }
  return violations;
}

function checkBounds(doc: string): Violation[] {
  const violations: Violation[] = [];
  for (const [identifier, expected] of Object.entries(BOUND_MAP)) {
    const row = findRow(doc, identifier);
    if (!row) {
      violations.push({ file: FILE, line: 0, message: `${identifier} not found in rdm-spec` });
      continue;
    }
    const match = /VARCHAR\((\d+)\)/.exec(row.cells[1] ?? '');
    const actual = match ? Number.parseInt(match[1]!, 10) : undefined;
    if (actual !== expected) {
      violations.push({
        file: FILE,
        line: row.line,
        message: `${identifier}: rdm-spec says VARCHAR(${actual}), constants.ts says ${expected}`,
      });
    }
  }
  return violations;
}

function check(doc: string): Violation[] {
  return [...checkEnums(doc), ...checkBounds(doc)];
}

describe('rdm-contract-sync', () => {
  it('holds over the real repo docs', () => {
    expect(check(readRepoFile(FILE))).toEqual([]);
  });

  it('reports a changed enum value naming the identifier', () => {
    const doc = readRepoFile(FILE);
    const mutated = doc.replace(
      '`PENDING \\| PAYMENT_FAILED \\| PAID',
      '`PENDING \\| RENAMED \\| PAID',
    );
    const violations = check(mutated);
    expect(violations.some((v) => v.message.includes('O-1.status'))).toBe(true);
  });

  it('reports a changed bound naming the identifier', () => {
    const doc = readRepoFile(FILE);
    const mutated = doc.replace(
      "| **note** | VARCHAR(200) | Nullable | The customer's note to the barista. |",
      "| **note** | VARCHAR(199) | Nullable | The customer's note to the barista. |",
    );
    const violations = check(mutated);
    expect(violations.some((v) => v.message.includes('O-1.note'))).toBe(true);
  });

  it('the corpus is real', () => {
    expect(gitFiles()).toContain(FILE);
  });
});
