import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, DiscoveryModule } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import type { Env } from '../config/env.schema.js';
import { AuthGuard } from './auth.guard.js';
import { PermissionGuard } from './permission.guard.js';
import { RATE_LIMIT_REDIS_CLIENT } from './rate-limit-redis.token.js';
import { RateLimitGuard } from './rate-limit.guard.js';
import { RouteMarkersCheck } from './route-markers.check.js';

@Module({
  imports: [DiscoveryModule, JwtModule.register({})],
  providers: [
    {
      provide: RATE_LIMIT_REDIS_CLIENT,
      inject: [ConfigService],
      // Fail-fast like catalog's — a stopped Redis must not queue the request for seconds.
      useFactory: (config: ConfigService<Env, true>): Redis =>
        new Redis(config.get('REDIS_URL', { infer: true }), {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 1000,
        }),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    RouteMarkersCheck,
  ],
})
export class AuthPipelineModule implements OnModuleDestroy {
  constructor(@Inject(RATE_LIMIT_REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    // `quit()` sends a command — with `enableOfflineQueue: false` it throws if the
    // connection never finished its handshake (e.g. no rate-limited route was ever hit).
    // `disconnect()` just tears down the socket, no command required.
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
