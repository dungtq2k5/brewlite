import { Controller, Logger, UseInterceptors } from '@nestjs/common';
import { GrpcRequestContextInterceptor } from '@brewlite/nest-common';
import type {
  GetProductRequest,
  GetProductResponse,
  ListCategoriesRequest,
  ListCategoriesResponse,
  ListProductsRequest,
  ListProductsResponse,
  MenuServiceController,
  PriceItemsRequest,
  PriceItemsResponse,
} from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import { MenuServiceControllerMethods } from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import { MenuService } from './menu.service.js';

/**
 * One interceptor per method call, not a manual `runWithRequestId` wrap per method — a
 * fifth RPC that forgot the wrap would log without a request id (doc 02 §7a). Applied on
 * the controller rather than the hybrid app's global interceptors: whether
 * `app.useGlobalInterceptors` reaches a `connectMicroservice` app was doc 02's verify
 * item 4 — this sidesteps the question.
 */
@Controller()
@MenuServiceControllerMethods()
@UseInterceptors(GrpcRequestContextInterceptor)
export class MenuGrpcController implements MenuServiceController {
  private readonly logger = new Logger(MenuGrpcController.name);

  constructor(private readonly menu: MenuService) {}

  listCategories(request: ListCategoriesRequest): Promise<ListCategoriesResponse> {
    this.logger.log('listCategories');
    return this.menu.listCategories(request);
  }

  listProducts(request: ListProductsRequest): Promise<ListProductsResponse> {
    this.logger.log('listProducts');
    return this.menu.listProducts(request);
  }

  getProduct(request: GetProductRequest): Promise<GetProductResponse> {
    this.logger.log('getProduct');
    return this.menu.getProduct(request);
  }

  priceItems(request: PriceItemsRequest): Promise<PriceItemsResponse> {
    this.logger.log('priceItems');
    return this.menu.priceItems(request);
  }
}
