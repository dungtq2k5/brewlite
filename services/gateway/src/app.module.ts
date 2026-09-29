import { Module } from '@nestjs/common';
import { createConfigModule, BrewliteLoggerModule, OpsModule } from '@brewlite/nest-common';
import { envSchema } from './config/env.schema.js';
import { AuthPipelineModule } from './auth/auth.module.js';
import { AdminUsersModule } from './modules/admin-users/admin-users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    createConfigModule(envSchema),
    BrewliteLoggerModule,
    // The rate limiter fails open, so Redis is not required to serve — no NATS dependency yet either.
    OpsModule.forRoot({ packageJsonDir: __dirname }),
    AuthPipelineModule,
    AuthModule,
    UsersModule,
    AdminUsersModule,
    CatalogModule,
  ],
})
export class AppModule {}
