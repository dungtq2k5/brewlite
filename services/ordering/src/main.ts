import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import { ORDERING_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import { PROTO_LOADER_OPTIONS } from '@brewlite/nest-common';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.schema.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'brewlite.ordering',
      protoPath: ORDERING_PROTO_FILES,
      url: config.get('GRPC_URL', { infer: true }),
      loader: { ...PROTO_LOADER_OPTIONS, includeDirs: [PROTO_ROOT] },
    },
  });

  await app.startAllMicroservices();
  await app.listen(config.get('OPS_PORT', { infer: true }));
}

void bootstrap();
