import { Module } from '@nestjs/common';
import {
  createConfigModule,
  BrewliteLoggerModule,
  OpsModule,
  type ReadinessCheck,
} from '@brewlite/nest-common';
import { envSchema } from './config/env.schema.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { PrismaService } from './modules/prisma/prisma.service.js';
import { OrdersModule } from './modules/orders/orders.module.js';

@Module({
  imports: [
    createConfigModule(envSchema),
    BrewliteLoggerModule,
    PrismaModule,
    OpsModule.forRootAsync({
      packageJsonDir: __dirname,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): ReadinessCheck[] => [
        async () => {
          try {
            await prisma.$queryRaw`SELECT 1`;
            return true;
          } catch {
            return false;
          }
        },
      ],
    }),
    OrdersModule,
  ],
})
export class AppModule {}
