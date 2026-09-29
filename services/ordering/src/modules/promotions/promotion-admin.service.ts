import { Injectable } from '@nestjs/common';
import { DiscountType, MAX_PRICE_VND, newId } from '@brewlite/contracts';
import {
  isUniqueConstraintViolation,
  requireUser,
  rpcError,
  type Caller,
} from '@brewlite/nest-common';
import type {
  CreatePromotionRequest,
  CreatePromotionResponse,
  DeletePromotionRequest,
  DeletePromotionResponse,
  GetPromotionRequest,
  GetPromotionResponse,
  ListPromotionsRequest,
  ListPromotionsResponse,
  RestorePromotionRequest,
  RestorePromotionResponse,
  UpdatePromotionRequest,
  UpdatePromotionResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/promotion_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PROMOTION_SELECT, toProtoPromotion, type PromotionRow } from './promotion.mapper.js';

function toOrderBy(sort: string): Prisma.PromotionOrderByWithRelationInput[] {
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  return [{ [field]: descending ? 'desc' : 'asc' }, { id: 'asc' }];
}

function validationFailed(path: string): never {
  throw rpcError('VALIDATION_FAILED', { issues: [{ path, code: 'invalid_value' }] });
}

@Injectable()
export class PromotionAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listPromotions(request: ListPromotionsRequest): Promise<ListPromotionsResponse> {
    const page = request.page?.page ?? 1;
    const pageSize = request.page?.pageSize ?? 20;
    const where: Prisma.PromotionWhereInput = {
      deletedAt: request.deleted === true ? { not: null } : null,
      ...(request.active !== undefined && { isActive: request.active }),
      ...(request.q !== undefined && { code: { startsWith: request.q.toUpperCase() } }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.promotion.findMany({
        where,
        select: PROMOTION_SELECT,
        orderBy: toOrderBy(request.page?.sort ?? '-createdAt'),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.promotion.count({ where }),
    ]);

    return { promotions: rows.map(toProtoPromotion), meta: { page, pageSize, total } };
  }

  async createPromotion(request: CreatePromotionRequest): Promise<CreatePromotionResponse> {
    this.assertDiscountShape(request.discountType, request.discountValue, request.maxDiscountVnd);
    const startsAt = new Date(request.startsAt);
    const endsAt = new Date(request.endsAt);
    if (endsAt <= startsAt) validationFailed('/endsAt');

    let created;
    try {
      created = await this.prisma.promotion.create({
        data: {
          id: newId(),
          code: request.code.toUpperCase(),
          description: request.description,
          discountType: request.discountType,
          discountValue: request.discountValue,
          maxDiscountVnd: request.maxDiscountVnd,
          minSubtotalVnd: request.minSubtotalVnd ?? 0,
          startsAt,
          endsAt,
          maxUses: request.maxUses,
          perUserLimit: request.perUserLimit ?? 1,
          isActive: request.isActive ?? true,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error, 'promotions_code_key'))
        throw rpcError('PROMO_CODE_TAKEN');
      throw error;
    }
    return { promotion: toProtoPromotion(await this.findByIdIncludingDeleted(created.id)) };
  }

  async getPromotion(request: GetPromotionRequest): Promise<GetPromotionResponse> {
    return { promotion: toProtoPromotion(await this.findByIdIncludingDeleted(request.id)) };
  }

  /** Only `description`, `endsAt`, `maxUses`, `perUserLimit`, `isActive` — the discount never changes (rdm-spec O-4). */
  async updatePromotion(request: UpdatePromotionRequest): Promise<UpdatePromotionResponse> {
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt !== null) throw rpcError('INVALID_STATE', { status: 'DELETED' });

    let endsAt: Date | undefined;
    if (request.endsAt !== undefined) {
      endsAt = new Date(request.endsAt);
      if (endsAt <= target.startsAt) validationFailed('/endsAt');
    }

    if (request.maxUses !== undefined) {
      const { count } = await this.prisma.promotion.updateMany({
        where: { id: request.id, usedCount: { lte: request.maxUses } },
        data: { maxUses: request.maxUses },
      });
      if (count === 0) {
        const fresh = await this.findByIdIncludingDeleted(request.id);
        throw rpcError('PROMO_MAX_USES_BELOW_USED', { usedCount: fresh.usedCount });
      }
    }

    await this.prisma.promotion.update({
      where: { id: request.id },
      data: {
        ...(request.description !== undefined && { description: request.description }),
        ...(request.clearDescription === true && { description: null }),
        ...(endsAt !== undefined && { endsAt }),
        ...(request.perUserLimit !== undefined && { perUserLimit: request.perUserLimit }),
        ...(request.isActive !== undefined && { isActive: request.isActive }),
      },
    });
    return { promotion: toProtoPromotion(await this.findByIdIncludingDeleted(request.id)) };
  }

  async deletePromotion(
    request: DeletePromotionRequest,
    caller: Caller,
  ): Promise<DeletePromotionResponse> {
    const { userId: actorId } = requireUser(caller);
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt !== null) throw rpcError('INVALID_STATE', { status: 'DELETED' });

    await this.prisma.promotion.update({
      where: { id: request.id },
      data: { deletedAt: new Date(), deletedById: actorId },
    });
    return { promotion: toProtoPromotion(await this.findByIdIncludingDeleted(request.id)) };
  }

  async restorePromotion(request: RestorePromotionRequest): Promise<RestorePromotionResponse> {
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt === null) throw rpcError('INVALID_STATE', { status: 'ACTIVE' });

    await this.prisma.promotion.update({
      where: { id: request.id },
      data: { deletedAt: null, deletedById: null },
    });
    return { promotion: toProtoPromotion(await this.findByIdIncludingDeleted(request.id)) };
  }

  private assertDiscountShape(
    type: string,
    value: number,
    maxDiscountVnd: number | undefined,
  ): void {
    if (type === DiscountType.PERCENT) {
      if (value < 1 || value > 100) validationFailed('/discountValue');
    } else {
      if (value < 1 || value > MAX_PRICE_VND) validationFailed('/discountValue');
      if (maxDiscountVnd !== undefined) validationFailed('/maxDiscountVnd');
    }
  }

  private async findByIdIncludingDeleted(id: string): Promise<PromotionRow> {
    const row = await this.prisma.promotion.findFirst({ where: { id }, select: PROMOTION_SELECT });
    if (!row) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'PROMOTION' });
    return row;
  }
}
