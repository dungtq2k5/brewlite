import { permissionsFor, Role } from '@brewlite/contracts';

const GUEST_BLOCKED = [/^\/checkout(\/|$)/, /^\/orders(\/|$)/, /^\/account(\/|$)/];

/** Paths a guest is sent to sign in for (ADR 0029); everything else renders for a guest. */
export function needsAccount(pathname: string): boolean {
  return GUEST_BLOCKED.some((re) => re.test(pathname));
}

const section = (pathname: string, name: string) =>
  pathname === `/${name}` || pathname.startsWith(`/${name}/`);

export const isStaffPath = (pathname: string) => section(pathname, 'staff');
export const isAdminPath = (pathname: string) => section(pathname, 'admin');

const isRole = (role: string | undefined): role is Role =>
  role === Role.CUSTOMER || role === Role.STAFF || role === Role.ADMIN;

/**
 * A redirect hint from the token's `role` claim — the layouts re-check against `Me`, and the
 * gateway is the authority. `null` means let the request through.
 */
export function roleRedirect(pathname: string, role: string | undefined): string | null {
  const permissions = isRole(role) ? permissionsFor(role) : [];
  if (isStaffPath(pathname)) {
    const ok = permissions.includes('order.board.read') || permissions.includes('stock.update');
    return ok ? null : '/';
  }
  if (isAdminPath(pathname)) return permissions.includes('menu.manage') ? null : '/';
  return null;
}
