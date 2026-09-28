import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLE_PERMISSIONS, permissionsFor } from './access.js';
import { Role } from './enums.js';

describe('ROLE_PERMISSIONS', () => {
  it('gives ADMIN every permission', () => {
    expect(ROLE_PERMISSIONS[Role.ADMIN]).toEqual(PERMISSIONS);
  });

  it('gives CUSTOMER none', () => {
    expect(permissionsFor(Role.CUSTOMER)).toEqual([]);
  });

  it('gives STAFF only its listed permissions', () => {
    expect(permissionsFor(Role.STAFF)).toEqual([
      'stock.update',
      'order.board.read',
      'order.status.update',
      'order.cancel.paid',
    ]);
  });
});
