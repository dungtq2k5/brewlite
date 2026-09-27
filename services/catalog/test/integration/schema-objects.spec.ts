import { describe, expect, it } from 'vitest';
import { newId } from '@brewlite/contracts';
import { prisma } from '../setup/per-file.js';

async function insertCategory(overrides: Partial<{ nameEn: string; nameVi: string }> = {}) {
  return prisma.category.create({
    data: { id: newId(), nameEn: 'Coffee', nameVi: 'Cà phê', ...overrides },
  });
}

describe('categories C-1 schema objects', () => {
  it('refuses a second LIVE row with the same English name', async () => {
    await insertCategory();
    await expect(insertCategory({ nameVi: 'Khác' })).rejects.toThrow();
  });

  it('refuses a second LIVE row with the same English name, case-insensitively', async () => {
    await insertCategory({ nameEn: 'Coffee' });
    await expect(insertCategory({ nameEn: 'COFFEE', nameVi: 'Khác' })).rejects.toThrow();
  });

  it('refuses a second LIVE row with the same Vietnamese name', async () => {
    await insertCategory();
    await expect(insertCategory({ nameEn: 'Other' })).rejects.toThrow();
  });

  it('does not block a new row once the old one is soft-deleted', async () => {
    const first = await insertCategory();
    await prisma.category.update({
      where: { id: first.id },
      data: { deletedAt: new Date(), deletedById: newId() },
    });
    await expect(insertCategory()).resolves.toMatchObject({ nameEn: 'Coffee' });
  });

  it('refuses deleted_at without deleted_by_id', async () => {
    const row = await insertCategory();
    await expect(
      prisma.category.update({ where: { id: row.id }, data: { deletedAt: new Date() } }),
    ).rejects.toThrow();
  });
});
