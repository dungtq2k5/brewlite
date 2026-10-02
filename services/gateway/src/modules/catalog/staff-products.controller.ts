import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiEnvelope, ApiErrors, RequirePermission } from '@brewlite/nest-common';
import { StaffProductsService } from './staff-products.service.js';
import { StaffProductResponseDto } from './dto/staff-response.dto.js';
import { SetAvailabilityDto } from './dto/set-availability.dto.js';
import { SetStockQtyDto } from './dto/set-stock-qty.dto.js';
import { ProductIdParamDto } from './dto/product-id-param.dto.js';

@Controller('staff/products')
@RequirePermission('stock.update')
export class StaffProductsController {
  constructor(private readonly staffProducts: StaffProductsService) {}

  @Get()
  @ApiEnvelope(StaffProductResponseDto, { list: true })
  list(@Req() req: Request): Promise<StaffProductResponseDto[]> {
    return this.staffProducts.list(req.id as string | undefined);
  }

  @Patch(':id/availability')
  @ApiEnvelope(StaffProductResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND')
  setAvailability(
    @Param() params: ProductIdParamDto,
    @Body() dto: SetAvailabilityDto,
    @Req() req: Request,
  ): Promise<StaffProductResponseDto> {
    return this.staffProducts.setAvailability(params.id, dto, req.id as string | undefined);
  }

  @Patch(':id/stock')
  @ApiEnvelope(StaffProductResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND', 'STOCK_VERSION_CONFLICT')
  setStockQty(
    @Param() params: ProductIdParamDto,
    @Body() dto: SetStockQtyDto,
    @Req() req: Request,
  ): Promise<StaffProductResponseDto> {
    return this.staffProducts.setStockQty(params.id, dto, req.id as string | undefined);
  }
}
