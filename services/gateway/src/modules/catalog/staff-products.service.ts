import { Injectable } from '@nestjs/common';
import { CatalogStockGrpcClient } from './catalog-stock-grpc.client.js';
import { toStaffProductResponseDto } from './staff.mapper.js';
import type { StaffProductResponseDto } from './dto/staff-response.dto.js';
import type { SetAvailabilityDto } from './dto/set-availability.dto.js';
import type { SetStockQtyDto } from './dto/set-stock-qty.dto.js';

@Injectable()
export class StaffProductsService {
  constructor(private readonly stock: CatalogStockGrpcClient) {}

  async list(requestId?: string): Promise<StaffProductResponseDto[]> {
    const response = await this.stock.listStaffProducts({}, requestId);
    return response.products.map(toStaffProductResponseDto);
  }

  async setAvailability(
    id: string,
    dto: SetAvailabilityDto,
    requestId?: string,
  ): Promise<StaffProductResponseDto> {
    const response = await this.stock.setProductAvailability(
      { id, isAvailable: dto.isAvailable },
      requestId,
    );
    return toStaffProductResponseDto(response.product!);
  }

  async setStockQty(
    id: string,
    dto: SetStockQtyDto,
    requestId?: string,
  ): Promise<StaffProductResponseDto> {
    const response = await this.stock.setStockQty(
      { id, stockQty: dto.stockQty ?? undefined, expectedVersion: dto.expectedVersion },
      requestId,
    );
    return toStaffProductResponseDto(response.product!);
  }
}
