import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Role } from '@brewlite/contracts';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { UsersService } from '../../src/modules/users/users.service.js';

const ACCOUNTS = [
  { email: 'admin@brewlite.test', fullName: 'Admin', role: Role.ADMIN },
  { email: 'staff@brewlite.test', fullName: 'Staff', role: Role.STAFF },
  { email: 'customer@brewlite.test', fullName: 'Customer', role: Role.CUSTOMER },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('seed:dev refuses to run when NODE_ENV=production');
    process.exit(1);
  }
  const password = process.env.SEED_ACCOUNT_PASSWORD;
  if (!password) {
    console.log('skipped: SEED_ACCOUNT_PASSWORD unset');
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const users = app.get(UsersService);

  let created = 0;
  for (const account of ACCOUNTS) {
    const existing = await prisma.user.findFirst({ where: { email: account.email } });
    if (existing) continue;
    await users.createWithPassword({ ...account, password });
    created += 1;
  }
  console.log(`${created} created`);

  await app.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
