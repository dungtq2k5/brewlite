import { Injectable } from '@nestjs/common';
import type { Caller } from '@brewlite/nest-common';
import type { UserContext } from '../../auth/request-context.js';
import { CatalogAdminGrpcClient } from './catalog-admin-grpc.client.js';
import { toAdminToppingResponseDto } from './admin-topping.mapper.js';
import type {
  AdminToppingResponseDto,
  CreateToppingDto,
  UpdateToppingDto,
} from './dto/admin-topping.dto.js';

function toCaller(ctx: UserContext): Caller {
  return { kind: 'USER', userId: ctx.userId, role: ctx.role };
}

@Injectable()
export class AdminToppingsService {
  constructor(private readonly admin: CatalogAdminGrpcClient) {}

  async list(deleted: boolean | undefined, requestId?: string): Promise<AdminToppingResponseDto[]> {
    const response = await this.admin.listToppings({ deleted }, requestId);
    return response.toppings.map(toAdminToppingResponseDto);
  }

  async create(dto: CreateToppingDto, requestId?: string): Promise<AdminToppingResponseDto> {
    const response = await this.admin.createTopping(
      { name: dto.name, priceVnd: dto.priceVnd },
      requestId,
    );
    return toAdminToppingResponseDto(response.topping!);
  }

  async update(
    id: string,
    dto: UpdateToppingDto,
    requestId?: string,
  ): Promise<AdminToppingResponseDto> {
    const response = await this.admin.updateTopping(
      { id, name: dto.name, priceVnd: dto.priceVnd, isAvailable: dto.isAvailable },
      requestId,
    );
    return toAdminToppingResponseDto(response.topping!);
  }

  async delete(id: string, ctx: UserContext, requestId?: string): Promise<void> {
    await this.admin.deleteTopping(toCaller(ctx), { id }, requestId);
  }

  async restore(id: string, requestId?: string): Promise<AdminToppingResponseDto> {
    const response = await this.admin.restoreTopping({ id }, requestId);
    return toAdminToppingResponseDto(response.topping!);
  }
}
