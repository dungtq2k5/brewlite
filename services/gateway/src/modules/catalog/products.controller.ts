import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiEnvelope, ApiErrors, Auth } from '@brewlite/nest-common';
import { ProductParamDto, ProductQueryDto } from './dto/product.dto.js';
import { ProductDetailResponseDto, ProductSummaryResponseDto } from './dto/product-response.dto.js';
import { ProductsService } from './products.service.js';

@Controller('products')
@Auth('PUBLIC')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiEnvelope(ProductSummaryResponseDto, { list: true })
  @ApiErrors('VALIDATION_FAILED', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_TIMEOUT')
  list(@Query() query: ProductQueryDto, @Req() req: Request): Promise<ProductSummaryResponseDto[]> {
    return this.products.listProducts(query.categoryId, req.id as string | undefined);
  }

  @Get(':id')
  @ApiEnvelope(ProductDetailResponseDto)
  @ApiErrors('VALIDATION_FAILED', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_TIMEOUT', 'RESOURCE_NOT_FOUND')
  get(@Param() params: ProductParamDto, @Req() req: Request): Promise<ProductDetailResponseDto> {
    return this.products.getProduct(params.id, req.id as string | undefined);
  }
}
