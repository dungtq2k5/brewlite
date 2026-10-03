import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { SessionsPruneJob } from '../../src/jobs/sessions-prune.job.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

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
    providers: [SessionsPruneJob],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

async function seedUser() {
  const user = await prisma.user.create({
    data: {
      id: newId(),
      email: `session-${newId()}@brewlite.test`,
      fullName: 'Session Test',
      role: 'CUSTOMER',
      passwordHash: '$'.repeat(60),
    },
  });
  return user.id;
}

async function seedSession(userId: string, expiresAt: Date) {
  const session = await prisma.session.create({
    data: { id: newId(), userId, refreshTokenHash: newId().repeat(2).slice(0, 64), expiresAt },
  });
  return session.id;
}

describe('SessionsPruneJob', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let job: SessionsPruneJob;

  beforeAll(async () => {
    app = await buildModule();
    job = app.get(SessionsPruneJob);
  });

  afterAll(async () => {
    await app.close();
  });

  it('deletes only expired sessions', async () => {
    const now = new Date();
    const userId = await seedUser();
    const expired = await seedSession(userId, new Date(now.getTime() - 1000));
    const active = await seedSession(userId, new Date(now.getTime() + 900_000));

    await job.run(now);

    const ids = (await prisma.session.findMany({ where: { userId } })).map((s) => s.id);
    expect(ids).not.toContain(expired);
    expect(ids).toContain(active);
  });
});
