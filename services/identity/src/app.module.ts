import { Module } from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  createConfigModule,
  BrewliteLoggerModule,
  OpsModule,
  JobsModule,
  JOBS_REDIS_CLIENT,
  redisPingCheck,
  type ReadinessCheck,
} from '@brewlite/nest-common';
import { envSchema } from './config/env.schema.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { PrismaService } from './modules/prisma/prisma.service.js';
import { AdminUsersModule } from './modules/admin-users/admin-users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { SessionsPruneJob } from './jobs/sessions-prune.job.js';

@Module({
  imports: [
    createConfigModule(envSchema),
    BrewliteLoggerModule,
    PrismaModule,
    OpsModule.forRootAsync({
      packageJsonDir: __dirname,
      inject: [PrismaService, JOBS_REDIS_CLIENT],
      useFactory: (prisma: PrismaService, redis: Redis): ReadinessCheck[] => [
        async () => {
          try {
            await prisma.$queryRaw`SELECT 1`;
            return true;
          } catch {
            return false;
          }
        },
        redisPingCheck(redis),
      ],
    }),
    AuthModule,
    UsersModule,
    AdminUsersModule,
    JobsModule.forRoot({
      queue: 'identity-jobs',
      jobs: [{ name: 'sessions-prune', everyMs: 24 * 60 * 60_000, job: SessionsPruneJob }],
    }),
  ],
})
export class AppModule {}
