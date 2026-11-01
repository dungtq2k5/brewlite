import { Injectable } from '@nestjs/common';
import { Paged, type Caller } from '@brewlite/nest-common';
import type { UserContext } from '../../auth/request-context.js';
import { PromotionAdminGrpcClient } from './promotion-admin-grpc.client.js';
import { toPromotionResponseDto } from './promotion.mapper.js';
import type {
  CreatePromotionDto,
  ListPromotionsQueryDto,
  PromotionResponseDto,
  UpdatePromotionDto,
} from './dto/promotion.dto.js';

type LimitFields = {
  maxUses?: number;
  perUserLimit?: number;
  unlimitedMaxUses?: true;
  unlimitedPerUserLimit?: true;
};

/** The API's limit — a number, `null` (unlimited) or absent — as the wire's number or `unlimited_*` flag. */
function limitFields(
  field: 'maxUses' | 'perUserLimit',
  value: number | null | undefined,
): LimitFields {
  if (value === null) {
    return field === 'maxUses' ? { unlimitedMaxUses: true } : { unlimitedPerUserLimit: true };
  }
  return value === undefined ? {} : { [field]: value };
}

function toCaller(ctx: UserContext): Caller {
  return { kind: 'USER', userId: ctx.userId, role: ctx.role };
}

@Injectable()
export class PromotionsService {
  constructor(private readonly promotions: PromotionAdminGrpcClient) {}

  async list(
    query: ListPromotionsQueryDto,
    requestId?: string,
  ): Promise<Paged<PromotionResponseDto>> {
    const response = await this.promotions.listPromotions(
      {
        page: { page: query.page, pageSize: query.pageSize, sort: query.sort },
        active: query.active,
        deleted: query.deleted,
        q: query.q,
      },
      requestId,
    );
    return Paged.page(response.promotions.map(toPromotionResponseDto), response.meta!);
  }

  async create(dto: CreatePromotionDto, requestId?: string): Promise<PromotionResponseDto> {
    const { maxUses, perUserLimit, ...rest } = dto;
    const response = await this.promotions.createPromotion(
      { ...rest, ...limitFields('maxUses', maxUses), ...limitFields('perUserLimit', perUserLimit) },
      requestId,
    );
    return toPromotionResponseDto(response.promotion!);
  }

  async get(id: string, requestId?: string): Promise<PromotionResponseDto> {
    const response = await this.promotions.getPromotion({ id }, requestId);
    return toPromotionResponseDto(response.promotion!);
  }

  async update(
    id: string,
    dto: UpdatePromotionDto,
    requestId?: string,
  ): Promise<PromotionResponseDto> {
    const response = await this.promotions.updatePromotion(
      {
        id,
        description: dto.description,
        clearDescription: dto.clearDescription,
        endsAt: dto.endsAt,
        ...limitFields('maxUses', dto.maxUses),
        ...limitFields('perUserLimit', dto.perUserLimit),
        isActive: dto.isActive,
      },
      requestId,
    );
    return toPromotionResponseDto(response.promotion!);
  }

  async delete(ctx: UserContext, id: string, requestId?: string): Promise<void> {
    await this.promotions.deletePromotion(toCaller(ctx), { id }, requestId);
  }

  async restore(id: string, requestId?: string): Promise<PromotionResponseDto> {
    const response = await this.promotions.restorePromotion({ id }, requestId);
    return toPromotionResponseDto(response.promotion!);
  }
}
