import { Injectable } from '@nestjs/common';
import type { RunnableJob } from '@brewlite/nest-common';
import { PrismaService } from '../modules/prisma/prisma.service.js';

/** Deletes expired sessions daily. */
@Injectable()
export class SessionsPruneJob implements RunnableJob {
  constructor(private readonly prisma: PrismaService) {}

  async run(now: Date = new Date()): Promise<void> {
    await this.prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  }
}
