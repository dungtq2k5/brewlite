import { Global, Inject, Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { NatsConnection } from 'nats';
import { connectNats, ensureStreams, OutboxRelay } from '@brewlite/nest-common';
import type { Env } from '../config/env.schema.js';
import { PrismaModule } from '../modules/prisma/prisma.module.js';
import { PrismaService } from '../modules/prisma/prisma.service.js';

export const NATS_CONNECTION = Symbol('NATS_CONNECTION');

/** Payment only publishes (the relay) for now — ordering is the only consumer. */
@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
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
  constructor(
    @Inject(NATS_CONNECTION) private readonly nc: NatsConnection,
    private readonly relay: OutboxRelay,
  ) {}

  async onModuleInit(): Promise<void> {
    const jsm = await this.nc.jetstreamManager();
    await ensureStreams(jsm, ['PAYMENT']);
    this.relay.start();
  }

  /** Stops the relay before draining the connection — no publish races the close. */
  async onModuleDestroy(): Promise<void> {
    await this.relay.stop();
    await this.nc.drain();
  }
}
