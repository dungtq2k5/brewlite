import { Global, Inject, Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { ConsumerMessages, NatsConnection } from 'nats';
import { connectNats, ensureStreams, OutboxRelay } from '@brewlite/nest-common';
import type { Env } from '../config/env.schema.js';
import { PrismaModule } from '../modules/prisma/prisma.module.js';
import { PrismaService } from '../modules/prisma/prisma.service.js';
import { OrdersModule } from '../modules/orders/orders.module.js';
import { PaymentSucceededConsumer } from '../modules/orders/payment-succeeded.consumer.js';
import { PaymentRefundFailedConsumer } from '../modules/orders/payment-refund-failed.consumer.js';
import { PaymentRefundSucceededConsumer } from '../modules/orders/payment-refund-succeeded.consumer.js';
import { PaymentFailedConsumer } from '../modules/orders/payment-failed.consumer.js';

export const NATS_CONNECTION = Symbol('NATS_CONNECTION');

/**
 * Ordering both publishes (the relay) and consumes payment's events — a
 * consumer ensures the stream it reads *and* `DLQ` (architecture §2.3); the publisher
 * (payment) ensures `PAYMENT` too, so boot order between the two services never matters.
 * One connection per process (ADR 0005) — the factory value has no lifecycle hooks of
 * its own, so this module implements them (the same trap as `PrismaService`/`RedisModule`).
 */
@Global()
@Module({
  imports: [ConfigModule, PrismaModule, OrdersModule],
  providers: [
    {
      provide: NATS_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Promise<NatsConnection> =>
        connectNats(config.get('NATS_URL', { infer: true })),
    },
    {
      provide: OutboxRelay,
      inject: [PrismaService, NATS_CONNECTION],
      useFactory: (prisma: PrismaService, nc: NatsConnection): OutboxRelay =>
        new OutboxRelay(prisma, nc.jetstream()),
    },
  ],
  exports: [NATS_CONNECTION, OutboxRelay],
})
export class NatsModule implements OnModuleInit, OnModuleDestroy {
  private readonly messages: ConsumerMessages[] = [];

  constructor(
    @Inject(NATS_CONNECTION) private readonly nc: NatsConnection,
    private readonly relay: OutboxRelay,
    private readonly paymentSucceeded: PaymentSucceededConsumer,
    private readonly paymentFailed: PaymentFailedConsumer,
    private readonly refundSucceeded: PaymentRefundSucceededConsumer,
    private readonly refundFailed: PaymentRefundFailedConsumer,
  ) {}

  async onModuleInit(): Promise<void> {
    const jsm = await this.nc.jetstreamManager();
    await ensureStreams(jsm, ['ORDERING', 'PAYMENT', 'DLQ']);
    this.relay.start();
    const jsc = this.nc.jetstream();
    for (const consumer of [
      this.paymentSucceeded,
      this.paymentFailed,
      this.refundSucceeded,
      this.refundFailed,
    ]) {
      this.messages.push(await consumer.start(jsc, jsm, 'PAYMENT'));
    }
  }

  /** Stops the relay and consumers before draining the connection — no publish races the close. */
  async onModuleDestroy(): Promise<void> {
    await this.relay.stop();
    await Promise.all(this.messages.map((m) => m.close()));
    await this.nc.drain();
  }
}
