import { describe, expect, it } from 'vitest';
import { newId } from '@brewlite/contracts';
import { prisma } from '../setup/per-file.js';

async function insertUser(overrides: Partial<{ email: string; passwordHash: string | null }> = {}) {
  return prisma.user.create({
    data: {
      id: newId(),
      email: 'someone@brewlite.test',
      passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0',
      fullName: 'Someone',
      ...overrides,
    },
  });
}

describe('users I-1 schema objects', () => {
  it('refuses an un-normalised email', async () => {
    await expect(insertUser({ email: 'Someone@Example.com' })).rejects.toThrow();
  });

  it('refuses a role outside CUSTOMER, STAFF, ADMIN', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO users (id, email, password_hash, full_name, role) VALUES ($1, $2, $3, $4, 'OWNER')`,
        newId(),
        'owner@brewlite.test',
        '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0',
        'Owner',
      ),
    ).rejects.toThrow();
  });

  it('refuses an account with neither a password nor a Firebase link', async () => {
    await expect(insertUser({ passwordHash: null })).rejects.toThrow();
  });

  it('refuses locked_until without is_locked', async () => {
    const user = await insertUser();
    await expect(
      prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil: new Date(Date.now() + 60_000) },
      }),
    ).rejects.toThrow();
  });

  it('refuses is_locked without a reason', async () => {
    const user = await insertUser();
    await expect(
      prisma.user.update({ where: { id: user.id }, data: { isLocked: true } }),
    ).rejects.toThrow();
  });

  it('refuses deleted_by_id without deleted_at', async () => {
    const user = await insertUser();
    const deleter = await insertUser({ email: 'admin@brewlite.test' });
    await expect(
      prisma.user.update({ where: { id: user.id }, data: { deletedById: deleter.id } }),
    ).rejects.toThrow();
  });

  it('refuses a locale outside en, vi', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO users (id, email, password_hash, full_name, preferred_locale) VALUES ($1, $2, $3, $4, 'fr')`,
        newId(),
        'french@brewlite.test',
        '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0',
        'French Speaker',
      ),
    ).rejects.toThrow();
  });

  it('email keeps a full unique index — a deleted email still blocks a new one', async () => {
    const first = await insertUser();
    await prisma.user.update({
      where: { id: first.id },
      data: { deletedAt: new Date(), deletedById: first.id },
    });
    await expect(insertUser()).rejects.toThrow();
  });
});
