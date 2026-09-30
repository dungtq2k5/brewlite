import { Module } from '@nestjs/common';
import { createConfigModule, BrewliteLoggerModule, OpsModule } from '@brewlite/nest-common';
import { envSchema } from './config/env.schema.js';
import { AuthPipelineModule } from './auth/auth.module.js';
import { AdminUsersModule } from './modules/admin-users/admin-users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { LoyaltyModule } from './modules/loyalty/loyalty.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { PromotionsModule } from './modules/promotions/promotions.module.js';
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
    OrdersModule,
    PaymentsModule,
    PromotionsModule,
    LoyaltyModule,
  ],
})
export class AppModule {}
