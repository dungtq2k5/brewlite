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
import { AdminMenuModule } from './modules/admin-menu/admin-menu.module.js';
import { MenuModule } from './modules/menu/menu.module.js';
import { StockModule } from './modules/stock/stock.module.js';
import { NatsModule, NATS_CONNECTION } from './nats/nats.module.js';
import { ReservationsReleaseOrphansJob } from './jobs/reservations-release-orphans.job.js';

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
    MenuModule,
    StockModule,
    AdminMenuModule,
    NatsModule,
    JobsModule.forRoot({
      queue: 'catalog-jobs',
      jobs: [
        {
          name: 'reservations-release-orphans',
          everyMs: 15 * 60_000,
          job: ReservationsReleaseOrphansJob,
        },
      ],
      imports: [StockModule],
    }),
  ],
})
export class AppModule {}
