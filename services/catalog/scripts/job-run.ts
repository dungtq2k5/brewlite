import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { ReservationsReleaseOrphansJob } from '../src/jobs/reservations-release-orphans.job.js';

const JOBS = {
  'reservations-release-orphans': ReservationsReleaseOrphansJob,
} as const;

/** `pnpm job:run <name>` — boots the app once, runs one job, exits (architecture §2.6). */
async function main(): Promise<void> {
  const name = process.argv[2];
  const JobClass = name ? JOBS[name as keyof typeof JOBS] : undefined;
  if (!JobClass) {
    console.error(`usage: job:run <${Object.keys(JOBS).join('|')}>`);
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  await app.get(JobClass).run();
  await app.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
