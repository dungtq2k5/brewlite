import { Global, Inject, Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { ConsumerMessages, NatsConnection } from 'nats';
import { connectNats, ensureStreams, OutboxRelay } from '@brewlite/nest-common';
import type { Env } from '../config/env.schema.js';
import { PrismaModule } from '../modules/prisma/prisma.module.js';
import { PaymentsModule } from '../modules/payments/payments.module.js';
import { OrderCancelledConsumer } from '../modules/payments/order-cancelled.consumer.js';
import { PaymentRejectedConsumer } from '../modules/payments/payment-rejected.consumer.js';
import { PrismaService } from '../modules/prisma/prisma.service.js';

export const NATS_CONNECTION = Symbol('NATS_CONNECTION');

/** Payment publishes (the relay) and consumes ordering's cancel and rejection events, for refunds. */
@Global()
@Module({
  imports: [ConfigModule, PrismaModule, PaymentsModule],
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
    private readonly orderCancelled: OrderCancelledConsumer,
    private readonly paymentRejected: PaymentRejectedConsumer,
  ) {}

  async onModuleInit(): Promise<void> {
    const jsm = await this.nc.jetstreamManager();
    await ensureStreams(jsm, ['PAYMENT', 'ORDERING', 'DLQ']);
    this.relay.start();
    const jsc = this.nc.jetstream();
    this.messages.push(
      await this.orderCancelled.start(jsc, jsm, 'ORDERING'),
      await this.paymentRejected.start(jsc, jsm, 'ORDERING'),
    );
  }

  /** Stops the relay before draining the connection — no publish races the close. */
  async onModuleDestroy(): Promise<void> {
    await this.relay.stop();
    await Promise.all(this.messages.map((m) => m.close()));
    await this.nc.drain();
  }
}
