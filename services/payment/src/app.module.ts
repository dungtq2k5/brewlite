import { Module } from '@nestjs/common';
import type { NatsConnection } from 'nats';
import type { Redis } from 'ioredis';
import {
  createConfigModule,
  BrewliteLoggerModule,
  OpsModule,
  JobsModule,
  JOBS_REDIS_CLIENT,
  NatsConnectionTracker,
  redisPingCheck,
  type ReadinessCheck,
} from '@brewlite/nest-common';
import { envSchema } from './config/env.schema.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { PrismaService } from './modules/prisma/prisma.service.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { NatsModule, NATS_CONNECTION } from './nats/nats.module.js';
import { OutboxPruneJob } from './jobs/outbox-prune.job.js';

@Module({
  imports: [
    createConfigModule(envSchema),
    BrewliteLoggerModule,
    PrismaModule,
    OpsModule.forRootAsync({
      packageJsonDir: __dirname,
      inject: [PrismaService, NATS_CONNECTION, JOBS_REDIS_CLIENT],
      useFactory: (prisma: PrismaService, nc: NatsConnection, redis: Redis): ReadinessCheck[] => [
        async () => {
          try {
            await prisma.$queryRaw`SELECT 1`;
            return true;
          } catch {
            return false;
          }
        },
        new NatsConnectionTracker(nc).start().readinessCheck(),
        redisPingCheck(redis),
      ],
    }),
    NatsModule,
    PaymentsModule,
    JobsModule.forRoot({
      queue: 'payment-jobs',
      jobs: [{ name: 'outbox-prune', everyMs: 24 * 60 * 60_000, job: OutboxPruneJob }],
      imports: [PaymentsModule],
    }),
  ],
})
export class AppModule {}
