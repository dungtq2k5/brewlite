import { Module } from '@nestjs/common';
import { createConfigModule, BrewliteLoggerModule, OpsModule } from '@brewlite/nest-common';
import { envSchema } from './config/env.schema.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';

@Module({
  imports: [
    createConfigModule(envSchema),
    BrewliteLoggerModule,
    // No dependency declared yet — readiness equals liveness until Redis and NATS join.
    OpsModule.forRoot({ packageJsonDir: __dirname }),
    CatalogModule,
  ],
})
export class AppModule {}
