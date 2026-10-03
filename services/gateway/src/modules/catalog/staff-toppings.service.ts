import { Injectable } from '@nestjs/common';
import { CatalogStockGrpcClient } from './catalog-stock-grpc.client.js';
import { toStaffToppingResponseDto } from './staff.mapper.js';
import type { StaffToppingResponseDto } from './dto/staff-response.dto.js';
import type { SetAvailabilityDto } from './dto/set-availability.dto.js';

@Injectable()
export class StaffToppingsService {
  constructor(private readonly stock: CatalogStockGrpcClient) {}

  async setAvailability(
    id: string,
    dto: SetAvailabilityDto,
    requestId?: string,
  ): Promise<StaffToppingResponseDto> {
    const response = await this.stock.setToppingAvailability(
      { id, isAvailable: dto.isAvailable },
      requestId,
    );
    return toStaffToppingResponseDto(response.topping!);
  }
}
