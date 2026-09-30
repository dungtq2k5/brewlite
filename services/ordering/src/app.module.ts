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
import { OrdersModule } from './modules/orders/orders.module.js';
import { PromotionsModule } from './modules/promotions/promotions.module.js';
import { StaffOrdersModule } from './modules/staff-orders/staff-orders.module.js';
import { LoyaltyModule } from './modules/loyalty/loyalty.module.js';
import { NatsModule, NATS_CONNECTION } from './nats/nats.module.js';
import { OrdersExpireJob } from './jobs/orders-expire.job.js';
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
        new NatsConnectionTracker(nc).readinessCheck(),
        redisPingCheck(redis),
      ],
    }),
    NatsModule,
    OrdersModule,
    PromotionsModule,
    LoyaltyModule,
    StaffOrdersModule,
    JobsModule.forRoot({
      queue: 'ordering-jobs',
      jobs: [
        { name: 'orders-expire', everyMs: 60_000, job: OrdersExpireJob },
        { name: 'outbox-prune', everyMs: 24 * 60 * 60_000, job: OutboxPruneJob },
      ],
      imports: [OrdersModule],
    }),
  ],
})
export class AppModule {}
