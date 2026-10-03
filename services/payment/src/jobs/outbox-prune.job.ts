import { Injectable } from '@nestjs/common';
import type { RunnableJob } from '@brewlite/nest-common';
import { PrismaService } from '../modules/prisma/prisma.service.js';

const RETENTION_MS = 7 * 24 * 60 * 60_000;

/** Deletes published outbox rows older than 7 days. An unpublished row is never touched, whatever its age. */
@Injectable()
export class OutboxPruneJob implements RunnableJob {
  constructor(private readonly prisma: PrismaService) {}

  async run(now: Date = new Date()): Promise<void> {
    await this.prisma.outboxEvent.deleteMany({
      where: { publishedAt: { lt: new Date(now.getTime() - RETENTION_MS) } },
    });
  }
}
