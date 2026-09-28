import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { MENU_CACHE_TTL_MS } from '@brewlite/contracts';
import type { ListProductsResponse } from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import { REDIS_CLIENT } from '../redis/redis.module.js';

const MENU_KEY = 'catalog:menu';

/**
 * A Redis failure never fails the menu (doc 02 §4.4): every call is wrapped, logs one
 * `warn` on any error, and falls back to (or simply skips) the cache.
 */
@Injectable()
export class MenuCache {
  private readonly logger = new Logger(MenuCache.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async getOrLoad(load: () => Promise<ListProductsResponse>): Promise<ListProductsResponse> {
    const { value: cached, failed: readFailed } = await this.read();
    if (cached) return cached;

    const value = await load();
    // One `warn` per request (check 7), not one per Redis call: a GET failure means
    // Redis is unreachable, so the SET is skipped rather than failing (and logging) too.
    if (!readFailed) await this.write(value);
    return value;
  }

  async invalidate(): Promise<void> {
    try {
      await this.redis.del(MENU_KEY);
    } catch (error) {
      this.logger.warn({ err: error }, 'menu cache DEL failed');
    }
  }

  private async read(): Promise<{ value: ListProductsResponse | undefined; failed: boolean }> {
    try {
      const raw = await this.redis.get(MENU_KEY);
      return { value: raw ? (JSON.parse(raw) as ListProductsResponse) : undefined, failed: false };
    } catch (error) {
      this.logger.warn({ err: error }, 'menu cache GET failed');
      return { value: undefined, failed: true };
    }
  }

  private async write(value: ListProductsResponse): Promise<void> {
    try {
      await this.redis.set(MENU_KEY, JSON.stringify(value), 'PX', MENU_CACHE_TTL_MS);
    } catch (error) {
      this.logger.warn({ err: error }, 'menu cache SET failed');
    }
  }
}
