import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../../config/env.schema.js';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * The client is a `useFactory` provider, so `RedisModule` itself implements
 * `OnModuleDestroy` to `quit()` it — a factory value gets no lifecycle hooks of its own
 * (the same trap as `PrismaService`). `maxRetriesPerRequest: 1`, `enableOfflineQueue:
 * false` and a short `connectTimeout` make a call against a stopped Redis fail fast
 * instead of queueing for seconds.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Redis =>
        new Redis(config.get('REDIS_URL', { infer: true }), {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 1000,
        }),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
