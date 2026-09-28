import { Role } from './enums.js';

export const PERMISSIONS = [
  'menu.manage',
  'stock.update',
  'order.board.read',
  'order.status.update',
  'order.cancel.paid',
  'order.read.all',
  'promotion.manage',
  'user.manage',
  'report.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** `ADMIN` *is* `PERMISSIONS`, not a copy — a new permission reaches admins for free. */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  [Role.CUSTOMER]: [],
  [Role.STAFF]: ['stock.update', 'order.board.read', 'order.status.update', 'order.cancel.paid'],
  [Role.ADMIN]: PERMISSIONS,
};

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
