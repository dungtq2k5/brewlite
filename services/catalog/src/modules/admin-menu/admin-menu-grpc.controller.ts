import { Controller, UseInterceptors } from '@nestjs/common';
import type { Metadata } from '@grpc/grpc-js';
import { callerFrom, GrpcRequestContextInterceptor } from '@brewlite/nest-common';
import {
  AdminMenuServiceControllerMethods,
  type AdminMenuServiceController,
  type ClearImageRequest,
  type ClearImageResponse,
  type CreateCategoryRequest,
  type CreateCategoryResponse,
  type CreateProductRequest,
  type CreateProductResponse,
  type CreateToppingRequest,
  type CreateToppingResponse,
  type DeleteCategoryRequest,
  type DeleteCategoryResponse,
  type DeleteProductRequest,
  type DeleteProductResponse,
  type DeleteToppingRequest,
  type DeleteToppingResponse,
  type AdminMenuServiceGetProductRequest,
  type AdminMenuServiceGetProductResponse,
  type AdminMenuServiceListCategoriesRequest,
  type AdminMenuServiceListCategoriesResponse,
  type AdminMenuServiceListProductsRequest,
  type AdminMenuServiceListProductsResponse,
  type AdminMenuServiceListToppingsRequest,
  type AdminMenuServiceListToppingsResponse,
  type ReplaceSizesRequest,
  type ReplaceSizesResponse,
  type ReplaceToppingsRequest,
  type ReplaceToppingsResponse,
  type RestoreCategoryRequest,
  type RestoreCategoryResponse,
  type RestoreProductRequest,
  type RestoreProductResponse,
  type RestoreToppingRequest,
  type RestoreToppingResponse,
  type SetImageRequest,
  type SetImageResponse,
  type UpdateCategoryRequest,
  type UpdateCategoryResponse,
  type UpdateProductRequest,
  type UpdateProductResponse,
  type UpdateToppingRequest,
  type UpdateToppingResponse,
} from '@brewlite/contracts/generated/brewlite/catalog/admin_menu_service.js';
import { AdminCategoriesService } from './admin-categories.service.js';
import { AdminProductsService } from './admin-products.service.js';
import { AdminToppingsService } from './admin-toppings.service.js';

@Controller()
@AdminMenuServiceControllerMethods()
@UseInterceptors(GrpcRequestContextInterceptor)
export class AdminMenuGrpcController implements AdminMenuServiceController {
  constructor(
    private readonly categories: AdminCategoriesService,
    private readonly products: AdminProductsService,
    private readonly toppings: AdminToppingsService,
  ) {}

  // ---- Categories ----

  listCategories(
    request: AdminMenuServiceListCategoriesRequest,
  ): Promise<AdminMenuServiceListCategoriesResponse> {
    return this.categories.listCategories(request);
  }

  createCategory(request: CreateCategoryRequest): Promise<CreateCategoryResponse> {
    return this.categories.createCategory(request);
  }

  updateCategory(request: UpdateCategoryRequest): Promise<UpdateCategoryResponse> {
    return this.categories.updateCategory(request);
  }

  deleteCategory(
    request: DeleteCategoryRequest,
    metadata?: Metadata,
  ): Promise<DeleteCategoryResponse> {
    return this.categories.deleteCategory(request, callerFrom(metadata));
  }

  restoreCategory(request: RestoreCategoryRequest): Promise<RestoreCategoryResponse> {
    return this.categories.restoreCategory(request);
  }

  // ---- Products ----

  listProducts(
    request: AdminMenuServiceListProductsRequest,
  ): Promise<AdminMenuServiceListProductsResponse> {
    return this.products.listProducts(request);
  }

  getProduct(
    request: AdminMenuServiceGetProductRequest,
  ): Promise<AdminMenuServiceGetProductResponse> {
    return this.products.getProduct(request);
  }

  createProduct(request: CreateProductRequest): Promise<CreateProductResponse> {
    return this.products.createProduct(request);
  }

  updateProduct(request: UpdateProductRequest): Promise<UpdateProductResponse> {
    return this.products.updateProduct(request);
  }

  replaceSizes(request: ReplaceSizesRequest): Promise<ReplaceSizesResponse> {
    return this.products.replaceSizes(request);
  }

  replaceToppings(request: ReplaceToppingsRequest): Promise<ReplaceToppingsResponse> {
    return this.products.replaceToppings(request);
  }

  setImage(request: SetImageRequest): Promise<SetImageResponse> {
    return this.products.setImage(request);
  }

  clearImage(request: ClearImageRequest): Promise<ClearImageResponse> {
    return this.products.clearImage(request);
  }

  deleteProduct(
    request: DeleteProductRequest,
    metadata?: Metadata,
  ): Promise<DeleteProductResponse> {
    return this.products.deleteProduct(request, callerFrom(metadata));
  }

  restoreProduct(request: RestoreProductRequest): Promise<RestoreProductResponse> {
    return this.products.restoreProduct(request);
  }

  // ---- Toppings ----

  listToppings(
    request: AdminMenuServiceListToppingsRequest,
  ): Promise<AdminMenuServiceListToppingsResponse> {
    return this.toppings.listToppings(request);
  }

  createTopping(request: CreateToppingRequest): Promise<CreateToppingResponse> {
    return this.toppings.createTopping(request);
  }

  updateTopping(request: UpdateToppingRequest): Promise<UpdateToppingResponse> {
    return this.toppings.updateTopping(request);
  }

  deleteTopping(
    request: DeleteToppingRequest,
    metadata?: Metadata,
  ): Promise<DeleteToppingResponse> {
    return this.toppings.deleteTopping(request, callerFrom(metadata));
  }

  restoreTopping(request: RestoreToppingRequest): Promise<RestoreToppingResponse> {
    return this.toppings.restoreTopping(request);
  }
}
