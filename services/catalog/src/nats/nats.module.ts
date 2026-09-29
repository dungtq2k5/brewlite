import { Global, Inject, Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { ConsumerMessages, NatsConnection } from 'nats';
import { connectNats, ensureStreams } from '@brewlite/nest-common';
import type { Env } from '../config/env.schema.js';
import { StockModule } from '../modules/stock/stock.module.js';
import { OrderStatusConsumer } from '../modules/stock/order-status.consumer.js';

export const NATS_CONNECTION = Symbol('NATS_CONNECTION');

/**
 * Catalog only consumes for now — no relay. A consumer ensures the stream it
 * reads *and* `DLQ` (architecture §2.3); the publisher (ordering) ensures `ORDERING` too, so boot
 * order between the two services never matters.
 */
@Global()
@Module({
  imports: [ConfigModule, StockModule],
  providers: [
    {
      provide: NATS_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Promise<NatsConnection> =>
        connectNats(config.get('NATS_URL', { infer: true })),
    },
  ],
  exports: [NATS_CONNECTION],
})
export class NatsModule implements OnModuleInit, OnModuleDestroy {
  private messages?: ConsumerMessages;

  constructor(
    @Inject(NATS_CONNECTION) private readonly nc: NatsConnection,
    private readonly consumer: OrderStatusConsumer,
  ) {}

  async onModuleInit(): Promise<void> {
    const jsm = await this.nc.jetstreamManager();
    await ensureStreams(jsm, ['ORDERING', 'DLQ']);
    this.messages = await this.consumer.start(this.nc.jetstream(), jsm, 'ORDERING');
  }

  async onModuleDestroy(): Promise<void> {
    await this.messages?.close();
    await this.nc.drain();
  }
}
