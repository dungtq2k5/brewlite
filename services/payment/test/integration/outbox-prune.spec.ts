import { describe, expect, it } from 'vitest';
import { newId } from '@brewlite/contracts';
import { OutboxPruneJob } from '../../src/jobs/outbox-prune.job.js';
import type { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { prisma } from '../setup/per-file.js';

const DAY_MS = 24 * 60 * 60_000;
const now = new Date('2026-11-18T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS);

async function seed(publishedAt: Date | null, createdAt: Date) {
  return prisma.outboxEvent.create({
    data: {
      subject: 'payment.payment.succeeded',
      payload: {},
      aggregateId: newId(),
      publishedAt,
      createdAt,
    },
  });
}

describe('OutboxPruneJob', () => {
  it('deletes rows published over 7 days ago and NEVER an unpublished row, whatever its age', async () => {
    const old = await seed(daysAgo(8), daysAgo(8));
    const recent = await seed(daysAgo(6), daysAgo(8));
    const unpublished = await seed(null, daysAgo(30));

    await new OutboxPruneJob(prisma as unknown as PrismaService).run(now);

    const left = await prisma.outboxEvent.findMany({ select: { id: true } });
    expect(new Set(left.map((r) => r.id))).toEqual(new Set([recent.id, unpublished.id]));
    expect(await prisma.outboxEvent.count({ where: { id: old.id } })).toBe(0);
  });
});
