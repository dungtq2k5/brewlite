import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Role } from '@brewlite/contracts';
import { live } from '@brewlite/nest-common';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { UsersService } from '../../src/modules/users/users.service.js';

/**
 * For the Compose `apps` profile and anywhere `seed:dev` refuses (`NODE_ENV=production`):
 * gives the course demo its first admin. A no-op once one exists — never a second.
 */
async function main(): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const users = app.get(UsersService);

  const existingAdmin = await prisma.user.findFirst({ where: { ...live, role: Role.ADMIN } });
  if (existingAdmin) {
    console.log('an admin already exists');
    await app.close();
    return;
  }

  await users.createWithPassword({ email, password, fullName: 'Admin', role: Role.ADMIN });
  console.log('created the first admin');

  await app.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
