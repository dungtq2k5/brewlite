import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient, type Caller } from '@brewlite/nest-common';
import { CATALOG_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import type {
  ClearImageRequest,
  ClearImageResponse,
  CreateCategoryRequest,
  CreateCategoryResponse,
  CreateProductRequest,
  CreateProductResponse,
  CreateToppingRequest,
  CreateToppingResponse,
  DeleteCategoryRequest,
  DeleteCategoryResponse,
  DeleteProductRequest,
  DeleteProductResponse,
  DeleteToppingRequest,
  DeleteToppingResponse,
  AdminMenuServiceGetProductRequest,
  AdminMenuServiceGetProductResponse,
  AdminMenuServiceListCategoriesRequest,
  AdminMenuServiceListCategoriesResponse,
  AdminMenuServiceListProductsRequest,
  AdminMenuServiceListProductsResponse,
  AdminMenuServiceListToppingsRequest,
  AdminMenuServiceListToppingsResponse,
  ReplaceSizesRequest,
  ReplaceSizesResponse,
  ReplaceToppingsRequest,
  ReplaceToppingsResponse,
  RestoreCategoryRequest,
  RestoreCategoryResponse,
  RestoreProductRequest,
  RestoreProductResponse,
  RestoreToppingRequest,
  RestoreToppingResponse,
  SetImageRequest,
  SetImageResponse,
  UpdateCategoryRequest,
  UpdateCategoryResponse,
  UpdateProductRequest,
  UpdateProductResponse,
  UpdateToppingRequest,
  UpdateToppingResponse,
} from '@brewlite/contracts/generated/brewlite/catalog/admin_menu_service.js';
import type { Env } from '../../config/env.schema.js';

@Injectable()
export class CatalogAdminGrpcClient extends BaseGrpcClient {
  constructor(config: ConfigService<Env, true>) {
    super({
      serviceName: 'brewlite.catalog.AdminMenuService',
      protoFiles: CATALOG_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url: config.get('CATALOG_GRPC_URL', { infer: true }),
    });
  }

  // ---- Categories ----

  listCategories(
    request: AdminMenuServiceListCategoriesRequest,
    requestId?: string,
  ): Promise<AdminMenuServiceListCategoriesResponse> {
    return this.call('listCategories', request, { requestId });
  }

  createCategory(
    request: CreateCategoryRequest,
    requestId?: string,
  ): Promise<CreateCategoryResponse> {
    return this.call('createCategory', request, { requestId });
  }

  updateCategory(
    request: UpdateCategoryRequest,
    requestId?: string,
  ): Promise<UpdateCategoryResponse> {
    return this.call('updateCategory', request, { requestId });
  }

  deleteCategory(
    caller: Caller,
    request: DeleteCategoryRequest,
    requestId?: string,
  ): Promise<DeleteCategoryResponse> {
    return this.call('deleteCategory', request, { requestId, caller });
  }

  restoreCategory(
    request: RestoreCategoryRequest,
    requestId?: string,
  ): Promise<RestoreCategoryResponse> {
    return this.call('restoreCategory', request, { requestId });
  }

  // ---- Products ----

  listProducts(
    request: AdminMenuServiceListProductsRequest,
    requestId?: string,
  ): Promise<AdminMenuServiceListProductsResponse> {
    return this.call('listProducts', request, { requestId });
  }

  getProduct(
    request: AdminMenuServiceGetProductRequest,
    requestId?: string,
  ): Promise<AdminMenuServiceGetProductResponse> {
    return this.call('getProduct', request, { requestId });
  }

  createProduct(request: CreateProductRequest, requestId?: string): Promise<CreateProductResponse> {
    return this.call('createProduct', request, { requestId });
  }

  updateProduct(request: UpdateProductRequest, requestId?: string): Promise<UpdateProductResponse> {
    return this.call('updateProduct', request, { requestId });
  }

  replaceSizes(request: ReplaceSizesRequest, requestId?: string): Promise<ReplaceSizesResponse> {
    return this.call('replaceSizes', request, { requestId });
  }

  replaceToppings(
    request: ReplaceToppingsRequest,
    requestId?: string,
  ): Promise<ReplaceToppingsResponse> {
    return this.call('replaceToppings', request, { requestId });
  }

  setImage(request: SetImageRequest, requestId?: string): Promise<SetImageResponse> {
    return this.call('setImage', request, { requestId });
  }

  clearImage(request: ClearImageRequest, requestId?: string): Promise<ClearImageResponse> {
    return this.call('clearImage', request, { requestId });
  }

  deleteProduct(
    caller: Caller,
    request: DeleteProductRequest,
    requestId?: string,
  ): Promise<DeleteProductResponse> {
    return this.call('deleteProduct', request, { requestId, caller });
  }

  restoreProduct(
    request: RestoreProductRequest,
    requestId?: string,
  ): Promise<RestoreProductResponse> {
    return this.call('restoreProduct', request, { requestId });
  }

  // ---- Toppings ----

  listToppings(
    request: AdminMenuServiceListToppingsRequest,
    requestId?: string,
  ): Promise<AdminMenuServiceListToppingsResponse> {
    return this.call('listToppings', request, { requestId });
  }

  createTopping(request: CreateToppingRequest, requestId?: string): Promise<CreateToppingResponse> {
    return this.call('createTopping', request, { requestId });
  }

  updateTopping(request: UpdateToppingRequest, requestId?: string): Promise<UpdateToppingResponse> {
    return this.call('updateTopping', request, { requestId });
  }

  deleteTopping(
    caller: Caller,
    request: DeleteToppingRequest,
    requestId?: string,
  ): Promise<DeleteToppingResponse> {
    return this.call('deleteTopping', request, { requestId, caller });
  }

  restoreTopping(
    request: RestoreToppingRequest,
    requestId?: string,
  ): Promise<RestoreToppingResponse> {
    return this.call('restoreTopping', request, { requestId });
  }
}
