import { Controller, Logger } from '@nestjs/common';
import type { Metadata } from '@grpc/grpc-js';
import { requestIdFromMetadata, runWithRequestId } from '@brewlite/nest-common';
import type {
  ListCategoriesRequest,
  ListCategoriesResponse,
  MenuServiceController,
} from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import { MenuServiceControllerMethods } from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import { MenuService } from './menu.service.js';

@Controller()
@MenuServiceControllerMethods()
export class MenuGrpcController implements MenuServiceController {
  private readonly logger = new Logger(MenuGrpcController.name);

  constructor(private readonly menu: MenuService) {}

  listCategories(
    request: ListCategoriesRequest,
    metadata?: Metadata,
  ): Promise<ListCategoriesResponse> {
    return runWithRequestId(requestIdFromMetadata(metadata), () => {
      this.logger.log('listCategories');
      return this.menu.listCategories(request);
    });
  }
}
