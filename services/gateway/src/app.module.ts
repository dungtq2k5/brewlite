import { Module } from '@nestjs/common';
import { createConfigModule, BrewliteLoggerModule, OpsModule } from '@brewlite/nest-common';
import { EventsModule } from './events/events.module.js';
import { OrderEventsSource } from './events/order-events.source.js';
import { envSchema } from './config/env.schema.js';
import { AuthPipelineModule } from './auth/auth.module.js';
import { AdminUsersModule } from './modules/admin-users/admin-users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { LoyaltyModule } from './modules/loyalty/loyalty.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { PromotionsModule } from './modules/promotions/promotions.module.js';
import { StaffOrdersModule } from './modules/staff-orders/staff-orders.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    createConfigModule(envSchema),
    BrewliteLoggerModule,
    // The rate limiter fails open, so Redis is not required to serve. NATS is ready-checked
    // for the SSE streams only — a NATS outage answers 503 here while every other route serves.
    OpsModule.forRootAsync({
      packageJsonDir: __dirname,
      inject: [OrderEventsSource],
      useFactory: (source: OrderEventsSource) => [source.readinessCheck()],
    }),
    AuthPipelineModule,
    AuthModule,
    UsersModule,
    AdminUsersModule,
    CatalogModule,
    OrdersModule,
    PaymentsModule,
    PromotionsModule,
    LoyaltyModule,
    StaffOrdersModule,
    EventsModule,
  ],
})
export class AppModule {}
