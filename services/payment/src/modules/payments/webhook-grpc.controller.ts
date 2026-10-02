import { Controller, UseInterceptors } from '@nestjs/common';
import { GrpcRequestContextInterceptor } from '@brewlite/nest-common';
import {
  WebhookServiceControllerMethods,
  type HandleStripeEventRequest,
  type HandleStripeEventResponse,
  type WebhookServiceController,
} from '@brewlite/contracts/generated/brewlite/payment/webhook_service.js';
import { WebhookService } from './webhook.service.js';

@Controller()
@WebhookServiceControllerMethods()
@UseInterceptors(GrpcRequestContextInterceptor)
export class WebhookGrpcController implements WebhookServiceController {
  constructor(private readonly webhook: WebhookService) {}

  handleStripeEvent(request: HandleStripeEventRequest): Promise<HandleStripeEventResponse> {
    return this.webhook.handleStripeEvent(request);
  }
}
