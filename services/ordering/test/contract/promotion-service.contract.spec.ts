import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import type { Metadata } from '@grpc/grpc-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId, Role } from '@brewlite/contracts';
import { ORDERING_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import { BaseGrpcClient, PROTO_LOADER_OPTIONS, type Caller } from '@brewlite/nest-common';
import type {
  CreatePromotionRequest,
  CreatePromotionResponse,
  DeletePromotionRequest,
  DeletePromotionResponse,
  GetMyLoyaltyResponse,
  GetPromotionRequest,
  GetPromotionResponse,
  ListPromotionsRequest,
  ListPromotionsResponse,
  RestorePromotionRequest,
  RestorePromotionResponse,
  UpdatePromotionRequest,
  UpdatePromotionResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/promotion_service.js';
import { envSchema } from '../../src/config/env.schema.js';
import { LoyaltyModule } from '../../src/modules/loyalty/loyalty.module.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { PromotionsModule } from '../../src/modules/promotions/promotions.module.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

const configModule = ConfigModule.forRoot({
  isGlobal: true,
  validate: () => envSchema.parse({ ...testEnv, DATABASE_URL: testEnv.DATABASE_URL_TEST }),
});

@Module({ imports: [configModule, PrismaModule, PromotionsModule, LoyaltyModule] })
class RealPromotionModule {}

const admin: Caller = { kind: 'USER', userId: newId(), role: Role.ADMIN };

class TestPromotionAdminClient extends BaseGrpcClient {
  constructor(url: string) {
    super({
      serviceName: 'brewlite.ordering.PromotionAdminService',
      protoFiles: ORDERING_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url,
    });
  }
  listPromotions(request: ListPromotionsRequest): Promise<ListPromotionsResponse> {
    return this.call('listPromotions', request, { caller: admin });
  }
  createPromotion(request: CreatePromotionRequest): Promise<CreatePromotionResponse> {
    return this.call('createPromotion', request, { caller: admin });
  }
  getPromotion(request: GetPromotionRequest): Promise<GetPromotionResponse> {
    return this.call('getPromotion', request, { caller: admin });
  }
  updatePromotion(request: UpdatePromotionRequest): Promise<UpdatePromotionResponse> {
    return this.call('updatePromotion', request, { caller: admin });
  }
  deletePromotion(request: DeletePromotionRequest): Promise<DeletePromotionResponse> {
    return this.call('deletePromotion', request, { caller: admin });
  }
  restorePromotion(request: RestorePromotionRequest): Promise<RestorePromotionResponse> {
    return this.call('restorePromotion', request, { caller: admin });
  }
}

class TestLoyaltyClient extends BaseGrpcClient {
  constructor(url: string) {
    super({
      serviceName: 'brewlite.ordering.LoyaltyService',
      protoFiles: ORDERING_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url,
    });
  }
  getMyLoyalty(caller: Caller): Promise<GetMyLoyaltyResponse> {
    return this.call('getMyLoyalty', {}, { caller });
  }
}

const codeOf = (error: unknown) =>
  (error as { metadata: Metadata }).metadata.get('bl-error-code')[0];

describe('PromotionAdminService and LoyaltyService.GetMyLoyalty gRPC contract', () => {
  const url = 'localhost:25088';
  let app: Awaited<ReturnType<typeof NestFactory.createMicroservice>>;
  let promotions: TestPromotionAdminClient;
  let loyalty: TestLoyaltyClient;

  beforeAll(async () => {
    app = await NestFactory.createMicroservice<MicroserviceOptions>(RealPromotionModule, {
      transport: Transport.GRPC,
      options: {
        package: 'brewlite.ordering',
        protoPath: ORDERING_PROTO_FILES,
        url,
        loader: { ...PROTO_LOADER_OPTIONS, includeDirs: [PROTO_ROOT] },
      },
    });
    await app.listen();
    promotions = new TestPromotionAdminClient(url);
    loyalty = new TestLoyaltyClient(url);
  });

  afterAll(async () => {
    await app.close();
  });

  it('round-trips the whole lifecycle: create, get, update, list, delete, restore', async () => {
    const { promotion } = await promotions.createPromotion({
      code: 'wire10',
      description: 'over the wire',
      discountType: 'PERCENT',
      discountValue: 10,
      minSubtotalVnd: 0,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 86_400_000).toISOString(),
      maxUses: 100,
    });
    const id = promotion!.id;
    expect(promotion).toMatchObject({ code: 'WIRE10', maxUses: 100, perUserLimit: 1 });

    expect((await promotions.getPromotion({ id })).promotion?.description).toBe('over the wire');

    const updated = await promotions.updatePromotion({ id, unlimitedMaxUses: true });
    expect(updated.promotion?.maxUses).toBeUndefined(); // the unlimited flag crosses the wire

    const listed = await promotions.listPromotions({
      page: { page: 1, pageSize: 20, sort: 'code' },
    });
    expect(listed.promotions.map((p) => p.id)).toEqual([id]);
    expect(listed.meta).toEqual({ page: 1, pageSize: 20, total: 1 });

    await promotions.deletePromotion({ id });
    // The deleting admin comes from the caller metadata, not the request.
    const row = await prisma.promotion.findUniqueOrThrow({ where: { id } });
    expect(row.deletedById).toBe(admin.kind === 'USER' ? admin.userId : undefined);

    await promotions.restorePromotion({ id });
    expect(
      (await promotions.listPromotions({ page: undefined, deleted: true })).promotions,
    ).toEqual([]);
  });

  it('answers PROMO_CODE_TAKEN and RESOURCE_NOT_FOUND over the wire', async () => {
    const request = {
      code: 'TWICE',
      discountType: 'FIXED',
      discountValue: 10_000,
      minSubtotalVnd: 0,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 86_400_000).toISOString(),
    };
    await promotions.createPromotion(request);
    await expect(promotions.createPromotion(request)).rejects.toSatisfy(
      (error) => codeOf(error) === 'PROMO_CODE_TAKEN',
    );
    await expect(promotions.getPromotion({ id: newId() })).rejects.toSatisfy(
      (error) => codeOf(error) === 'RESOURCE_NOT_FOUND',
    );
  });

  it('GetMyLoyalty reads the calling user from metadata — zeros for a user with no ledger', async () => {
    const customer: Caller = { kind: 'USER', userId: newId(), role: Role.CUSTOMER };
    await prisma.loyaltyAccount.create({
      data: { userId: customer.userId, balance: 7, lifetimeEarned: 9 },
    });

    await expect(loyalty.getMyLoyalty(customer)).resolves.toMatchObject({
      balance: 7,
      lifetimeEarned: 9,
    });
    await expect(
      loyalty.getMyLoyalty({ kind: 'USER', userId: newId(), role: Role.CUSTOMER }),
    ).resolves.toMatchObject({ balance: 0, lifetimeEarned: 0 });
  });
});
