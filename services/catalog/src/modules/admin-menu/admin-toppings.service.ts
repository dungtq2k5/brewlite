import { Injectable } from '@nestjs/common';
import { Locale, MAX_ADMIN_TOPPINGS, newId } from '@brewlite/contracts';
import {
  isUniqueConstraintViolation,
  requireUser,
  rpcError,
  type Caller,
} from '@brewlite/nest-common';
import type {
  CreateToppingRequest,
  CreateToppingResponse,
  DeleteToppingRequest,
  DeleteToppingResponse,
  AdminMenuServiceListToppingsRequest,
  AdminMenuServiceListToppingsResponse,
  RestoreToppingRequest,
  RestoreToppingResponse,
  UpdateToppingRequest,
  UpdateToppingResponse,
} from '@brewlite/contracts/generated/brewlite/catalog/admin_menu_service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MenuCache } from '../menu/menu-cache.service.js';
import {
  ADMIN_TOPPING_SELECT,
  toProtoAdminTopping,
  type AdminToppingRow,
} from './admin-topping.mapper.js';

function throwIfNameTaken(error: unknown): void {
  if (isUniqueConstraintViolation(error, 'toppings_name_en_live_key')) {
    throw rpcError('TOPPING_NAME_TAKEN', { locale: Locale.EN });
  }
  if (isUniqueConstraintViolation(error, 'toppings_name_vi_live_key')) {
    throw rpcError('TOPPING_NAME_TAKEN', { locale: Locale.VI });
  }
}

@Injectable()
export class AdminToppingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: MenuCache,
  ) {}

  async listToppings(
    request: AdminMenuServiceListToppingsRequest,
  ): Promise<AdminMenuServiceListToppingsResponse> {
    const rows = await this.prisma.topping.findMany({
      where: request.deleted === true ? { deletedAt: { not: null } } : { deletedAt: null },
      orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
      take: MAX_ADMIN_TOPPINGS,
      select: ADMIN_TOPPING_SELECT,
    });
    return { toppings: rows.map(toProtoAdminTopping) };
  }

  async createTopping(request: CreateToppingRequest): Promise<CreateToppingResponse> {
    let created;
    try {
      created = await this.prisma.topping.create({
        data: {
          id: newId(),
          nameEn: request.name!.en,
          nameVi: request.name!.vi,
          priceVnd: request.priceVnd,
        },
      });
    } catch (error) {
      throwIfNameTaken(error);
      throw error;
    }
    await this.cache.invalidate();
    return { topping: toProtoAdminTopping(await this.findByIdIncludingDeleted(created.id)) };
  }

  async updateTopping(request: UpdateToppingRequest): Promise<UpdateToppingResponse> {
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt !== null) throw rpcError('INVALID_STATE', { status: 'DELETED' });

    try {
      await this.prisma.topping.update({
        where: { id: request.id },
        data: {
          ...(request.name !== undefined && { nameEn: request.name.en, nameVi: request.name.vi }),
          ...(request.priceVnd !== undefined && { priceVnd: request.priceVnd }),
          ...(request.isAvailable !== undefined && { isAvailable: request.isAvailable }),
        },
      });
    } catch (error) {
      throwIfNameTaken(error);
      throw error;
    }
    await this.cache.invalidate();
    return { topping: toProtoAdminTopping(await this.findByIdIncludingDeleted(request.id)) };
  }

  /** Leaves product links in place — the public detail and PriceItems already filter live toppings, and a restore brings the links back with it. */
  async deleteTopping(
    request: DeleteToppingRequest,
    caller: Caller,
  ): Promise<DeleteToppingResponse> {
    const { userId: actorId } = requireUser(caller);
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt !== null) throw rpcError('INVALID_STATE', { status: 'DELETED' });

    await this.prisma.topping.update({
      where: { id: request.id },
      data: { deletedAt: new Date(), deletedById: actorId },
    });
    await this.cache.invalidate();
    return { topping: toProtoAdminTopping(await this.findByIdIncludingDeleted(request.id)) };
  }

  async restoreTopping(request: RestoreToppingRequest): Promise<RestoreToppingResponse> {
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt === null) throw rpcError('INVALID_STATE', { status: 'ACTIVE' });

    try {
      await this.prisma.topping.update({
        where: { id: request.id },
        data: { deletedAt: null, deletedById: null },
      });
    } catch (error) {
      throwIfNameTaken(error);
      throw error;
    }
    await this.cache.invalidate();
    return { topping: toProtoAdminTopping(await this.findByIdIncludingDeleted(request.id)) };
  }

  private async findByIdIncludingDeleted(id: string): Promise<AdminToppingRow> {
    const row = await this.prisma.topping.findFirst({
      where: { id },
      select: ADMIN_TOPPING_SELECT,
    });
    if (!row) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'TOPPING' });
    return row;
  }
}
