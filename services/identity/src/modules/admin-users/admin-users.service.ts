import { Injectable } from '@nestjs/common';
import {
  LOCK_REASON_MAX_LENGTH,
  MAX_LOCK_DURATION_DAYS,
  parseEnum,
  Role,
  zText,
} from '@brewlite/contracts';
import { requireUser, rpcError, type Caller } from '@brewlite/nest-common';
import type {
  ChangeRoleRequest,
  ChangeRoleResponse,
  DeactivateUserRequest,
  DeactivateUserResponse,
  GetUserRequest,
  GetUserResponse,
  ListUsersRequest,
  ListUsersResponse,
  LockUserRequest,
  LockUserResponse,
  RestoreUserRequest,
  RestoreUserResponse,
  UnlockUserRequest,
  UnlockUserResponse,
} from '@brewlite/contracts/generated/brewlite/identity/admin_user_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ADMIN_USER_SELECT, toProtoAdminUser, type AdminUserRow } from './admin-user.mapper.js';
import { isEffectiveAdmin } from './effective-admin.js';

const zSearchQuery = zText(100);
const zLockReason = zText(LOCK_REASON_MAX_LENGTH);

/** Escapes Postgres `LIKE`/`ILIKE` wildcards so a search term is matched literally. */
function escapeLikePattern(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function toOrderBy(sort: string): Prisma.UserOrderByWithRelationInput[] {
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  return [{ [field]: descending ? 'desc' : 'asc' }, { id: 'asc' }];
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(request: ListUsersRequest): Promise<ListUsersResponse> {
    const page = request.page?.page ?? 1;
    const pageSize = request.page?.pageSize ?? 20;
    const where: Prisma.UserWhereInput = {
      deletedAt: request.deleted === true ? { not: null } : null,
      ...(request.role !== undefined && { role: request.role }),
      ...(request.locked !== undefined && { isLocked: request.locked }),
      ...(request.q !== undefined &&
        (() => {
          const term = escapeLikePattern(zSearchQuery.parse(request.q));
          return {
            OR: [
              { email: { contains: term, mode: 'insensitive' as const } },
              { fullName: { contains: term, mode: 'insensitive' as const } },
            ],
          };
        })()),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: ADMIN_USER_SELECT,
        orderBy: toOrderBy(request.page?.sort ?? '-createdAt'),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users: users.map(toProtoAdminUser), meta: { page, pageSize, total } };
  }

  async getUser(request: GetUserRequest): Promise<GetUserResponse> {
    const row = await this.findByIdIncludingDeleted(request.id);
    return { user: toProtoAdminUser(row) };
  }

  async changeRole(request: ChangeRoleRequest, caller: Caller): Promise<ChangeRoleResponse> {
    const { userId: actorId } = requireUser(caller);
    const target = await this.requireWritableTarget(request.id, actorId);
    if (target.deletedAt !== null) throw rpcError('INVALID_STATE', { status: 'DEACTIVATED' });
    const newRole = parseEnum(Role, request.role);

    if (newRole === target.role) return { user: toProtoAdminUser(target) };

    await this.prisma.$transaction(async (tx) => {
      if (target.role === Role.ADMIN) await this.assertNotLastAdmin(tx, target.id);
      await tx.user.update({ where: { id: target.id }, data: { role: newRole } });
      await tx.session.deleteMany({ where: { userId: target.id } });
    });
    return { user: toProtoAdminUser(await this.findByIdIncludingDeleted(target.id)) };
  }

  async lockUser(request: LockUserRequest, caller: Caller): Promise<LockUserResponse> {
    const { userId: actorId } = requireUser(caller);
    const target = await this.requireWritableTarget(request.id, actorId);
    if (target.deletedAt !== null) throw rpcError('INVALID_STATE', { status: 'DEACTIVATED' });

    const reason = zLockReason.parse(request.reason);
    const lockedUntil = this.parseLockedUntil(request.lockedUntil);

    await this.prisma.$transaction(async (tx) => {
      if (target.role === Role.ADMIN) await this.assertNotLastAdmin(tx, target.id);
      await tx.user.update({
        where: { id: target.id },
        data: { isLocked: true, lockedUntil, lockReason: reason },
      });
      await tx.session.deleteMany({ where: { userId: target.id } });
    });
    return { user: toProtoAdminUser(await this.findByIdIncludingDeleted(target.id)) };
  }

  /** Unlock is independent of the deactivated/live state (rdm-spec §2.9) — no state check, no self-check, no last-admin check. */
  async unlockUser(request: UnlockUserRequest, caller: Caller): Promise<UnlockUserResponse> {
    requireUser(caller);
    const target = await this.findByIdIncludingDeleted(request.id);
    await this.prisma.user.update({
      where: { id: target.id },
      data: { isLocked: false, lockedUntil: null, lockReason: null },
    });
    return { user: toProtoAdminUser(await this.findByIdIncludingDeleted(target.id)) };
  }

  async deactivateUser(
    request: DeactivateUserRequest,
    caller: Caller,
  ): Promise<DeactivateUserResponse> {
    const { userId: actorId } = requireUser(caller);
    const target = await this.requireWritableTarget(request.id, actorId);
    if (target.deletedAt !== null) throw rpcError('INVALID_STATE', { status: 'DEACTIVATED' });

    await this.prisma.$transaction(async (tx) => {
      if (target.role === Role.ADMIN) await this.assertNotLastAdmin(tx, target.id);
      await tx.user.update({
        where: { id: target.id },
        data: { deletedAt: new Date(), deletedById: actorId },
      });
      await tx.session.deleteMany({ where: { userId: target.id } });
    });
    return { user: toProtoAdminUser(await this.findByIdIncludingDeleted(target.id)) };
  }

  /** Restore never reduces admin coverage, so no self-check and no last-admin check — only the state check. A lock, if any, stays. */
  async restoreUser(request: RestoreUserRequest, caller: Caller): Promise<RestoreUserResponse> {
    requireUser(caller);
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt === null) throw rpcError('INVALID_STATE', { status: 'ACTIVE' });

    await this.prisma.user.update({
      where: { id: target.id },
      data: { deletedAt: null, deletedById: null },
    });
    return { user: toProtoAdminUser(await this.findByIdIncludingDeleted(target.id)) };
  }

  private async findByIdIncludingDeleted(id: string): Promise<AdminUserRow> {
    const row = await this.prisma.user.findFirst({ where: { id }, select: ADMIN_USER_SELECT });
    if (!row) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'USER' });
    return row;
  }

  /** Existence (conventions §7.3's naming) plus the self-action refusal — shared by every write that can act on someone else. */
  private async requireWritableTarget(id: string, actorId: string): Promise<AdminUserRow> {
    const target = await this.findByIdIncludingDeleted(id);
    if (target.id === actorId) throw rpcError('SELF_ACTION_FORBIDDEN');
    return target;
  }

  private parseLockedUntil(value: string | undefined): Date | null {
    if (value === undefined) return null;
    const parsed = new Date(value);
    const now = new Date();
    if (parsed.getTime() <= now.getTime()) {
      throw rpcError('VALIDATION_FAILED', {
        issues: [{ path: '/lockedUntil', code: 'too_small' }],
      });
    }
    const maxAllowed = new Date(now.getTime() + MAX_LOCK_DURATION_DAYS * 24 * 60 * 60 * 1000);
    if (parsed.getTime() > maxAllowed.getTime()) {
      throw rpcError('VALIDATION_FAILED', { issues: [{ path: '/lockedUntil', code: 'too_big' }] });
    }
    return parsed;
  }

  /**
   * A row lock (conventions §7.8) before counting — two admins demoting each other at
   * the same moment must not both read "one other admin remains". `ORDER BY id` makes
   * every transaction lock the rows in the same order, so two of them wait instead of
   * deadlocking. Zero *other* effective admins → `409 LAST_ADMIN`.
   */
  private async assertNotLastAdmin(tx: Prisma.TransactionClient, targetId: string): Promise<void> {
    const admins = await tx.$queryRaw<
      Array<{ id: string; is_locked: boolean; locked_until: Date | null }>
    >`SELECT id, is_locked, locked_until FROM users WHERE role = 'ADMIN' AND deleted_at IS NULL ORDER BY id FOR UPDATE`;

    const now = new Date();
    const otherEffectiveAdmins = admins.filter(
      (admin) =>
        admin.id !== targetId &&
        isEffectiveAdmin({ isLocked: admin.is_locked, lockedUntil: admin.locked_until }, now),
    );
    if (otherEffectiveAdmins.length === 0) throw rpcError('LAST_ADMIN');
  }
}
