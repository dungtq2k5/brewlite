import { Global, Module } from '@nestjs/common';
import { OrderingServiceGrpcClient } from '../modules/orders/ordering-service-grpc.client.js';
import { EventsController } from './events.controller.js';
import { OrderEventsSource } from './order-events.source.js';
import { SseStreams } from './sse-streams.service.js';

/** Global so `OpsModule`'s readiness factory can see the source without pulling this module in early. */
@Global()
@Module({
  controllers: [EventsController],
  providers: [OrderEventsSource, SseStreams, OrderingServiceGrpcClient],
  exports: [OrderEventsSource],
})
export class EventsModule {}
