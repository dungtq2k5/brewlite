import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { OutboxPruneJob } from '../../src/jobs/outbox-prune.job.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

const DAY_MS = 24 * 60 * 60_000;

async function buildModule() {
  const configModule = ConfigModule.forRoot({
    isGlobal: true,
    validate: () =>
      envSchema.parse({
        ...testEnv,
        DATABASE_URL: testEnv.DATABASE_URL_TEST,
      }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule],
    providers: [OutboxPruneJob],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

async function seedOutboxRow(publishedAt: Date | null) {
  const id = newId();
  await prisma.outboxEvent.create({
    data: {
      id,
      subject: 'ordering.order.status_changed',
      payload: { note: id },
      aggregateId: newId(),
      requestId: null,
      publishedAt,
    },
  });
  return id;
}

describe('OutboxPruneJob', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let job: OutboxPruneJob;

  beforeAll(async () => {
    app = await buildModule();
    job = app.get(OutboxPruneJob);
  });

  afterAll(async () => {
    await app.close();
  });

  it('deletes published rows older than 7 days, keeps recent ones and every unpublished row', async () => {
    const now = new Date();
    const old = await seedOutboxRow(new Date(now.getTime() - 8 * DAY_MS));
    const recent = await seedOutboxRow(new Date(now.getTime() - 1 * DAY_MS));
    const veryOldUnpublished = await seedOutboxRow(null);
    // The unpublished row's own createdAt is forced old too — publishedAt is what matters.
    await prisma.outboxEvent.update({
      where: { id: veryOldUnpublished },
      data: { createdAt: new Date(now.getTime() - 30 * DAY_MS) },
    });

    await job.run(now);

    const ids = (await prisma.outboxEvent.findMany({ select: { id: true } })).map((r) => r.id);
    expect(ids).not.toContain(old);
    expect(ids).toContain(recent);
    expect(ids).toContain(veryOldUnpublished);
  });
});
