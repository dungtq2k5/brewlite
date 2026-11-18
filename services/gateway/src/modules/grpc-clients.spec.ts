import * as grpc from '@grpc/grpc-js';
import type { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { newId, Role } from '@brewlite/contracts';
import { BaseGrpcClient, isGrpcServiceError, type Caller } from '@brewlite/nest-common';
import type { Env } from '../config/env.schema.js';
import { AdminOrderGrpcClient } from './admin-orders/admin-order-grpc.client.js';
import { ReportGrpcClient } from './admin-reports/report-grpc.client.js';
import { IdentityServiceGrpcClient } from './auth/identity-service-grpc.client.js';
import { CatalogAdminGrpcClient } from './catalog/catalog-admin-grpc.client.js';
import { CatalogServiceGrpcClient } from './catalog/catalog-service-grpc.client.js';
import { CatalogStockGrpcClient } from './catalog/catalog-stock-grpc.client.js';
import { LoyaltyGrpcClient } from './loyalty/loyalty-grpc.client.js';
import { OrderingServiceGrpcClient } from './orders/ordering-service-grpc.client.js';
import { PaymentServiceGrpcClient } from './payments/payment-service-grpc.client.js';
import { WebhookServiceGrpcClient } from './payments/webhook-service-grpc.client.js';
import { PromotionAdminGrpcClient } from './promotions/promotion-admin-grpc.client.js';
import { StaffOrdersGrpcClient } from './staff-orders/staff-orders-grpc.client.js';

/**
 * Every gateway gRPC client against one in-process fake peer that records what reached it:
 * the RPC path (a misspelt method name has no handler and fails here), the request as the
 * peer decodes it, the caller/request-id metadata and the deadline. The e2e tier stubs
 * these classes, so this is the only place their real wire behaviour is exercised.
 */

interface Received {
  path: string;
  request: Record<string, unknown>;
  metadata: Record<string, unknown>;
  deadlineMs: number;
}

const REQUEST_ID = 'req-grpc-clients';
const caller: Caller = { kind: 'USER', userId: newId(), role: Role.ADMIN };

let server: grpc.Server;
let received: Received[] = [];
let failWith: Partial<grpc.StatusObject> | undefined;
const registered = new Set<string>();

/** Registers a handler for every method of every service a client instance holds. */
function serve(client: object): void {
  const inner = Object.values(client).filter((v) => v instanceof BaseGrpcClient);
  for (const base of [client, ...inner]) {
    const channelClient = (base as unknown as { client?: grpc.Client }).client;
    if (!(channelClient instanceof grpc.Client)) continue;
    const definition = (channelClient.constructor as grpc.ServiceClientConstructor).service;
    const firstPath = Object.values(definition)[0]!.path;
    if (registered.has(firstPath)) continue;
    registered.add(firstPath);
    const impl: grpc.UntypedServiceImplementation = {};
    for (const [name, method] of Object.entries(definition)) {
      impl[name] = (
        call: grpc.ServerUnaryCall<unknown, unknown>,
        done: grpc.sendUnaryData<unknown>,
      ) => {
        const deadline = call.getDeadline();
        received.push({
          path: method.path,
          request: call.request as Record<string, unknown>,
          metadata: call.metadata.getMap(),
          deadlineMs: Number(deadline instanceof Date ? deadline.getTime() : deadline) - Date.now(),
        });
        if (failWith) done(failWith, null);
        else done(null, {});
      };
    }
    server.addService(definition, impl);
  }
}

let url = '';
const config = { get: () => url } as unknown as ConfigService<Env, true>;

beforeAll(async () => {
  server = new grpc.Server();
  const port = await new Promise<number>((resolve, reject) =>
    server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (err, p) =>
      err ? reject(err) : resolve(p),
    ),
  );
  url = `127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.tryShutdown(() => resolve()));
});

beforeEach(() => {
  received = [];
  failWith = undefined;
});

/** One row: the facade call, the RPC path it must reach, and the request the peer must see. */
type Row<C> = [
  rpc: string,
  invoke: (client: C) => Promise<unknown>,
  expected: Record<string, unknown>,
  withCaller: boolean,
];

function suite<C extends object>(
  name: string,
  Client: new (config: ConfigService<Env, true>) => C,
  rows: Row<C>[],
): void {
  describe(name, () => {
    let client: C;
    beforeAll(() => {
      client = new Client(config);
      serve(client);
    });

    it.each(rows)(
      '%s reaches the peer with its request and metadata',
      async (rpc, invoke, expected, withCaller) => {
        await expect(invoke(client)).resolves.toBeDefined();
        expect(received).toHaveLength(1);
        const [call] = received;
        expect(call!.path).toBe(rpc);
        expect(call!.request).toMatchObject(expected);
        expect(call!.metadata['x-request-id']).toBe(REQUEST_ID);
        if (withCaller) {
          expect(call!.metadata).toMatchObject({
            'x-user-id': caller.kind === 'USER' && caller.userId,
            'x-user-role': Role.ADMIN,
          });
        } else {
          expect(call!.metadata).not.toHaveProperty('x-user-id');
          expect(call!.metadata).not.toHaveProperty('x-user-role');
        }
      },
    );
  });
}

const id = newId();
const R = REQUEST_ID;
const page = { page: 2, pageSize: 10, sort: '-createdAt' };

suite('IdentityServiceGrpcClient', IdentityServiceGrpcClient, [
  [
    '/brewlite.identity.AuthService/Register',
    (c) =>
      c.register(
        { email: 'a@b.co', password: 'pw-123456', fullName: 'A', preferredLocale: 'vi' },
        R,
      ),
    { email: 'a@b.co', fullName: 'A', preferredLocale: 'vi' },
    false,
  ],
  [
    '/brewlite.identity.AuthService/Login',
    (c) => c.login({ email: 'a@b.co', password: 'pw' }, R),
    { email: 'a@b.co', password: 'pw' },
    false,
  ],
  [
    '/brewlite.identity.AuthService/SignInWithFirebase',
    (c) => c.signInWithFirebase({ idToken: 'tok' }, R),
    { idToken: 'tok' },
    false,
  ],
  [
    '/brewlite.identity.AuthService/Refresh',
    (c) => c.refresh({ refreshToken: 'rt' }, R),
    { refreshToken: 'rt' },
    false,
  ],
  [
    '/brewlite.identity.AuthService/Logout',
    (c) => c.logout({ refreshToken: 'rt' }, R),
    { refreshToken: 'rt' },
    false,
  ],
  ['/brewlite.identity.UserService/GetMe', (c) => c.getMe(caller, R), {}, true],
  [
    '/brewlite.identity.UserService/UpdateMe',
    (c) => c.updateMe(caller, { fullName: 'B', preferredLocale: 'en' }, R),
    { fullName: 'B', preferredLocale: 'en' },
    true,
  ],
  [
    '/brewlite.identity.UserService/ChangePassword',
    (c) =>
      c.changePassword(caller, { sessionId: 's', currentPassword: 'old', newPassword: 'new' }, R),
    { sessionId: 's', currentPassword: 'old', newPassword: 'new' },
    true,
  ],
  [
    '/brewlite.identity.AdminUserService/ListUsers',
    (c) => c.listUsers(caller, { page, q: 'ann', role: 'STAFF', locked: true, deleted: false }, R),
    { page, q: 'ann', role: 'STAFF', locked: true },
    true,
  ],
  [
    '/brewlite.identity.AdminUserService/GetUser',
    (c) => c.getUser(caller, { id }, R),
    { id },
    true,
  ],
  [
    '/brewlite.identity.AdminUserService/ListUserNames',
    (c) => c.listUserNames(caller, { ids: [id] }, R),
    { ids: [id] },
    true,
  ],
  [
    '/brewlite.identity.AdminUserService/ChangeRole',
    (c) => c.changeRole(caller, { id, role: 'STAFF' }, R),
    { id, role: 'STAFF' },
    true,
  ],
  [
    '/brewlite.identity.AdminUserService/LockUser',
    (c) => c.lockUser(caller, { id, reason: 'spam' }, R),
    { id, reason: 'spam' },
    true,
  ],
  [
    '/brewlite.identity.AdminUserService/UnlockUser',
    (c) => c.unlockUser(caller, { id }, R),
    { id },
    true,
  ],
  [
    '/brewlite.identity.AdminUserService/DeactivateUser',
    (c) => c.deactivateUser(caller, { id }, R),
    { id },
    true,
  ],
  [
    '/brewlite.identity.AdminUserService/RestoreUser',
    (c) => c.restoreUser(caller, { id }, R),
    { id },
    true,
  ],
]);

const name = { en: 'Tea', vi: 'Trà' };
suite('CatalogAdminGrpcClient', CatalogAdminGrpcClient, [
  [
    '/brewlite.catalog.AdminMenuService/ListCategories',
    (c) => c.listCategories({ deleted: true }, R),
    { deleted: true },
    false,
  ],
  [
    '/brewlite.catalog.AdminMenuService/CreateCategory',
    (c) => c.createCategory({ name, sortOrder: 2, isActive: true }, R),
    { name, sortOrder: 2, isActive: true },
    false,
  ],
  [
    '/brewlite.catalog.AdminMenuService/UpdateCategory',
    (c) => c.updateCategory({ id, name, sortOrder: 3 }, R),
    { id, name, sortOrder: 3 },
    false,
  ],
  [
    '/brewlite.catalog.AdminMenuService/DeleteCategory',
    (c) => c.deleteCategory(caller, { id }, R),
    { id },
    true,
  ],
  [
    '/brewlite.catalog.AdminMenuService/RestoreCategory',
    (c) => c.restoreCategory({ id }, R),
    { id },
    false,
  ],
  [
    '/brewlite.catalog.AdminMenuService/ListProducts',
    (c) => c.listProducts({ page, q: 'tea', categoryId: id, deleted: false }, R),
    { page, q: 'tea', categoryId: id },
    false,
  ],
  ['/brewlite.catalog.AdminMenuService/GetProduct', (c) => c.getProduct({ id }, R), { id }, false],
  [
    '/brewlite.catalog.AdminMenuService/CreateProduct',
    (c) =>
      c.createProduct(
        {
          categoryId: id,
          name,
          basePriceVnd: 30_000,
          sizes: [{ size: 'M', priceDeltaVnd: 5_000 }],
          toppingIds: [id],
          sortOrder: 1,
        },
        R,
      ),
    {
      categoryId: id,
      basePriceVnd: 30_000,
      sizes: [{ size: 'M', priceDeltaVnd: 5_000 }],
      toppingIds: [id],
    },
    false,
  ],
  [
    '/brewlite.catalog.AdminMenuService/UpdateProduct',
    (c) => c.updateProduct({ id, clearDescription: true, basePriceVnd: 31_000 }, R),
    { id, clearDescription: true, basePriceVnd: 31_000 },
    false,
  ],
  [
    '/brewlite.catalog.AdminMenuService/ReplaceSizes',
    (c) => c.replaceSizes({ id, sizes: [{ size: 'L', priceDeltaVnd: 9_000 }] }, R),
    { id, sizes: [{ size: 'L', priceDeltaVnd: 9_000 }] },
    false,
  ],
  [
    '/brewlite.catalog.AdminMenuService/ReplaceToppings',
    (c) => c.replaceToppings({ id, toppingIds: [id] }, R),
    { id, toppingIds: [id] },
    false,
  ],
  [
    '/brewlite.catalog.AdminMenuService/SetImage',
    (c) =>
      c.setImage(
        { id, content: Buffer.from([1, 2, 3]), contentType: 'image/png', extension: 'png' },
        R,
      ),
    { id, content: Buffer.from([1, 2, 3]), contentType: 'image/png', extension: 'png' },
    false,
  ],
  ['/brewlite.catalog.AdminMenuService/ClearImage', (c) => c.clearImage({ id }, R), { id }, false],
  [
    '/brewlite.catalog.AdminMenuService/DeleteProduct',
    (c) => c.deleteProduct(caller, { id }, R),
    { id },
    true,
  ],
  [
    '/brewlite.catalog.AdminMenuService/RestoreProduct',
    (c) => c.restoreProduct({ id }, R),
    { id },
    false,
  ],
  [
    '/brewlite.catalog.AdminMenuService/ListToppings',
    (c) => c.listToppings({ deleted: true }, R),
    { deleted: true },
    false,
  ],
  [
    '/brewlite.catalog.AdminMenuService/CreateTopping',
    (c) => c.createTopping({ name, priceVnd: 5_000 }, R),
    { name, priceVnd: 5_000 },
    false,
  ],
  [
    '/brewlite.catalog.AdminMenuService/UpdateTopping',
    (c) => c.updateTopping({ id, isAvailable: true }, R),
    { id, isAvailable: true },
    false,
  ],
  [
    '/brewlite.catalog.AdminMenuService/DeleteTopping',
    (c) => c.deleteTopping(caller, { id }, R),
    { id },
    true,
  ],
  [
    '/brewlite.catalog.AdminMenuService/RestoreTopping',
    (c) => c.restoreTopping({ id }, R),
    { id },
    false,
  ],
]);

suite('CatalogServiceGrpcClient', CatalogServiceGrpcClient, [
  ['/brewlite.catalog.MenuService/ListCategories', (c) => c.listCategories({}, R), {}, false],
  [
    '/brewlite.catalog.MenuService/ListProducts',
    (c) => c.listProducts({ categoryId: id }, R),
    { categoryId: id },
    false,
  ],
  ['/brewlite.catalog.MenuService/GetProduct', (c) => c.getProduct({ id }, R), { id }, false],
]);

suite('CatalogStockGrpcClient', CatalogStockGrpcClient, [
  [
    '/brewlite.catalog.StockService/ListStaffProducts',
    (c) => c.listStaffProducts({}, R),
    {},
    false,
  ],
  [
    '/brewlite.catalog.StockService/ListStaffToppings',
    (c) => c.listStaffToppings({}, R),
    {},
    false,
  ],
  [
    '/brewlite.catalog.StockService/SetProductAvailability',
    (c) => c.setProductAvailability({ id, isAvailable: true }, R),
    { id, isAvailable: true },
    false,
  ],
  [
    '/brewlite.catalog.StockService/SetStockQty',
    (c) => c.setStockQty({ id, stockQty: 7, expectedVersion: 3 }, R),
    { id, stockQty: 7, expectedVersion: 3 },
    false,
  ],
  [
    '/brewlite.catalog.StockService/SetToppingAvailability',
    (c) => c.setToppingAvailability({ id, isAvailable: true }, R),
    { id, isAvailable: true },
    false,
  ],
]);

suite('AdminOrderGrpcClient', AdminOrderGrpcClient, [
  [
    '/brewlite.ordering.AdminOrderService/ListOrders',
    (c) => c.listOrders(caller, { page, status: 'PAID', orderNo: 'A-1' }, R),
    { page, status: 'PAID', orderNo: 'A-1' },
    true,
  ],
  [
    '/brewlite.ordering.AdminOrderService/GetAdminOrder',
    (c) => c.getAdminOrder(caller, { id }, R),
    { id },
    true,
  ],
]);

suite('ReportGrpcClient', ReportGrpcClient, [
  [
    '/brewlite.ordering.ReportService/SalesReport',
    (c) => c.salesReport(caller, { from: '2026-11-01', to: '2026-11-18' }, R),
    { from: '2026-11-01', to: '2026-11-18' },
    true,
  ],
  [
    '/brewlite.ordering.ReportService/GetStaffStats',
    (c) => c.getStaffStats(caller, { userId: id, from: '2026-11-01', to: '2026-11-18' }, R),
    { userId: id },
    true,
  ],
]);

suite('LoyaltyGrpcClient', LoyaltyGrpcClient, [
  [
    '/brewlite.ordering.LoyaltyService/GetMyLoyalty',
    (c) => c.getMyLoyalty(caller, {}, R),
    {},
    true,
  ],
  [
    '/brewlite.ordering.LoyaltyService/GetLoyaltyForUser',
    (c) => c.getLoyaltyForUser(caller, { userId: id }, R),
    { userId: id },
    true,
  ],
]);

const items = [{ productId: id, size: 'M', qty: 2, toppingIds: [] }];
suite('OrderingServiceGrpcClient', OrderingServiceGrpcClient, [
  [
    '/brewlite.ordering.OrderService/Quote',
    (c) => c.quote(caller, { items, promoCode: 'TEN', pointsToRedeem: 0 }, R),
    { promoCode: 'TEN' },
    true,
  ],
  [
    '/brewlite.ordering.OrderService/PlaceOrder',
    (c) =>
      c.placeOrder(
        caller,
        { items, promoCode: '', note: 'no ice', idempotencyKey: 'k-1', pointsToRedeem: 0 },
        R,
      ),
    { note: 'no ice', idempotencyKey: 'k-1' },
    true,
  ],
  [
    '/brewlite.ordering.OrderService/ListMyOrders',
    (c) => c.listMyOrders(caller, { cursor: 'c', limit: 5, status: 'PAID' }, R),
    { cursor: 'c', limit: 5, status: 'PAID' },
    true,
  ],
  ['/brewlite.ordering.OrderService/GetOrder', (c) => c.getOrder(caller, { id }, R), { id }, true],
  [
    '/brewlite.ordering.OrderService/CancelOrder',
    (c) => c.cancelOrder(caller, { id }, R),
    { id },
    true,
  ],
]);

suite('PaymentServiceGrpcClient', PaymentServiceGrpcClient, [
  [
    '/brewlite.payment.PaymentService/CreatePayment',
    (c) => c.createPayment(caller, { orderId: id, idempotencyKey: 'k-2' }, R),
    { orderId: id, idempotencyKey: 'k-2' },
    true,
  ],
  [
    '/brewlite.payment.PaymentService/GetPayment',
    (c) => c.getPayment(caller, { id }, R),
    { id },
    true,
  ],
  [
    '/brewlite.payment.PaymentService/ListPaymentsForOrder',
    (c) => c.listPaymentsForOrder(caller, { orderId: id }, R),
    { orderId: id },
    true,
  ],
  [
    '/brewlite.payment.PaymentService/FakeConfirm',
    (c) => c.fakeConfirm(caller, { id, outcome: 'SUCCEEDED' }, R),
    { id, outcome: 'SUCCEEDED' },
    true,
  ],
]);

suite('WebhookServiceGrpcClient', WebhookServiceGrpcClient, [
  [
    '/brewlite.payment.WebhookService/HandleStripeEvent',
    (c) => c.handleStripeEvent({ payload: Buffer.from('{}'), signature: 'sig' }, R),
    { payload: Buffer.from('{}'), signature: 'sig' },
    false,
  ],
]);

suite('PromotionAdminGrpcClient', PromotionAdminGrpcClient, [
  [
    '/brewlite.ordering.PromotionAdminService/ListPromotions',
    (c) => c.listPromotions({ page, active: true, deleted: false, q: 'TEN' }, R),
    { page, active: true, q: 'TEN' },
    false,
  ],
  [
    '/brewlite.ordering.PromotionAdminService/CreatePromotion',
    (c) =>
      c.createPromotion(
        {
          code: 'TEN',
          discountType: 'PERCENT',
          discountValue: 10,
          minSubtotalVnd: 50_000,
          startsAt: '2026-11-01T00:00:00Z',
          endsAt: '2026-12-01T00:00:00Z',
          isActive: true,
          unlimitedMaxUses: true,
          unlimitedPerUserLimit: true,
        },
        R,
      ),
    {
      code: 'TEN',
      discountType: 'PERCENT',
      discountValue: 10,
      minSubtotalVnd: 50_000,
      unlimitedMaxUses: true,
    },
    false,
  ],
  [
    '/brewlite.ordering.PromotionAdminService/GetPromotion',
    (c) => c.getPromotion({ id }, R),
    { id },
    false,
  ],
  [
    '/brewlite.ordering.PromotionAdminService/UpdatePromotion',
    (c) => c.updatePromotion({ id, clearDescription: true, isActive: false }, R),
    { id, clearDescription: true },
    false,
  ],
  [
    '/brewlite.ordering.PromotionAdminService/DeletePromotion',
    (c) => c.deletePromotion(caller, { id }, R),
    { id },
    true,
  ],
  [
    '/brewlite.ordering.PromotionAdminService/RestorePromotion',
    (c) => c.restorePromotion({ id }, R),
    { id },
    false,
  ],
]);

suite('StaffOrdersGrpcClient', StaffOrdersGrpcClient, [
  [
    '/brewlite.ordering.StaffOrderService/ListBoard',
    (c) => c.listBoard(caller, { status: 'PAID' }, R),
    { status: 'PAID' },
    true,
  ],
  [
    '/brewlite.ordering.StaffOrderService/AdvanceStatus',
    (c) => c.advanceStatus(caller, { id, to: 'PREPARING' }, R),
    { id, to: 'PREPARING' },
    true,
  ],
  [
    '/brewlite.ordering.StaffOrderService/CancelPaid',
    (c) => c.cancelPaid(caller, { id, note: 'spilt' }, R),
    { id, note: 'spilt' },
    true,
  ],
]);

describe('gateway gRPC clients — deadlines and peer errors', () => {
  let ordering: OrderingServiceGrpcClient;
  let reports: ReportGrpcClient;
  let payments: PaymentServiceGrpcClient;
  let webhooks: WebhookServiceGrpcClient;

  beforeAll(() => {
    ordering = new OrderingServiceGrpcClient(config);
    reports = new ReportGrpcClient(config);
    payments = new PaymentServiceGrpcClient(config);
    webhooks = new WebhookServiceGrpcClient(config);
    for (const c of [ordering, reports, payments, webhooks]) serve(c);
  });

  it('gives an ordinary call the DEFAULT 2 s deadline', async () => {
    await ordering.getOrder(caller, { id });
    expect(received[0]!.deadlineMs).toBeGreaterThan(1_000);
    expect(received[0]!.deadlineMs).toBeLessThanOrEqual(2_000);
  });

  it.each([
    [
      'the sales report',
      () => reports.salesReport(caller, { from: '2026-11-01', to: '2026-11-18' }),
      5_000,
    ],
    [
      'creating a payment',
      () => payments.createPayment(caller, { orderId: id, idempotencyKey: 'k' }),
      12_000,
    ],
    [
      'a Stripe event',
      () => webhooks.handleStripeEvent({ payload: Buffer.from('{}'), signature: 's' }),
      10_000,
    ],
  ])('gives %s its own LONGER deadline', async (_label, invoke, deadlineMs) => {
    await invoke();
    expect(received[0]!.deadlineMs).toBeGreaterThan(deadlineMs - 1_000);
    expect(received[0]!.deadlineMs).toBeLessThanOrEqual(deadlineMs);
  });

  it('omits x-request-id when the caller has NONE', async () => {
    await ordering.getOrder(caller, { id });
    expect(received[0]!.metadata).not.toHaveProperty('x-request-id');
  });

  it("rejects with the peer's status and details UNCHANGED", async () => {
    failWith = { code: grpc.status.FAILED_PRECONDITION, details: 'INVALID_STATE' };
    const error: unknown = await ordering.cancelOrder(caller, { id }, R).catch((e: unknown) => e);
    expect(isGrpcServiceError(error)).toBe(true);
    expect(error).toMatchObject({
      code: grpc.status.FAILED_PRECONDITION,
      details: 'INVALID_STATE',
    });
  });
});
