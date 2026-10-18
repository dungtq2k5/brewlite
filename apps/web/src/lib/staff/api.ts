import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ApiClientError,
  configureApiClient,
  usersControllerGet,
  staffProductsControllerList,
  staffToppingsControllerList,
  staffOrdersControllerListBoard,
} from '@brewlite/api-client';
import {
  UsersControllerGetResponse,
  StaffProductsControllerListResponse,
  StaffToppingsControllerListResponse,
  StaffOrdersControllerListBoardResponse,
} from './contracts';
import type {
  StaffUser,
  StaffPermission,
  StaffError,
  Result,
  InventoryProduct,
  InventoryTopping,
  Order,
} from './contracts';
import { gatewayBaseUrl } from './env.schema';
import { logStaffDiagnostic } from './diagnostics';

type StaffReadEndpoint = '/users/me' | '/staff/products' | '/staff/toppings';

function responseShape(body: unknown) {
  const kind = (value: unknown) =>
    value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const data = body !== null && typeof body === 'object' && 'data' in body ? body.data : undefined;
  return {
    bodyType: kind(body),
    dataType: kind(data),
    ...(Array.isArray(data) ? { itemCount: data.length } : {}),
  };
}

async function readStaffApi<T>(
  endpoint: StaffReadEndpoint,
  request: () => Promise<{ status: number; data: unknown }>,
  parse: (body: unknown) => T,
): Promise<T> {
  logStaffDiagnostic('info', { endpoint, stage: 'request' });
  let response;
  try {
    response = await request();
  } catch (cause) {
    const networkCode =
      cause instanceof Error &&
      'cause' in cause &&
      cause.cause !== null &&
      typeof cause.cause === 'object' &&
      'code' in cause.cause &&
      typeof cause.cause.code === 'string' &&
      [
        'ECONNREFUSED',
        'ENOTFOUND',
        'EAI_AGAIN',
        'ETIMEDOUT',
        'ECONNRESET',
        'UND_ERR_CONNECT_TIMEOUT',
      ].includes(cause.cause.code)
        ? cause.cause.code
        : undefined;
    logStaffDiagnostic(
      'error',
      cause instanceof ApiClientError
        ? {
            endpoint,
            stage: 'http',
            status: cause.status,
            errorCode: [
              'UNAUTHENTICATED',
              'FORBIDDEN',
              'ROUTE_NOT_FOUND',
              'RESOURCE_NOT_FOUND',
              'INTERNAL',
              'SERVICE_UNAVAILABLE',
              'VALIDATION_FAILED',
              'RATE_LIMITED',
            ].includes(cause.code)
              ? cause.code
              : 'OTHER',
          }
        : {
            endpoint,
            stage: cause instanceof SyntaxError ? 'response-json' : 'transport',
            ...(networkCode ? { networkCode } : {}),
          },
      cause,
    );
    throw cause;
  }
  try {
    const data = parse(response.data);
    logStaffDiagnostic('info', {
      endpoint,
      stage: 'validated',
      status: response.status,
      ...responseShape(response.data),
    });
    return data;
  } catch (cause) {
    logStaffDiagnostic(
      'error',
      {
        endpoint,
        stage: 'schema',
        status: response.status,
        ...responseShape(response.data),
      },
      cause,
    );
    throw cause;
  }
}

export function configureStaffApi() {
  let baseUrl;
  try {
    baseUrl = gatewayBaseUrl();
  } catch (cause) {
    logStaffDiagnostic('error', { stage: 'configuration' }, cause);
    throw cause;
  }
  configureApiClient({
    baseUrl,
    getRequestHeaders: async (): Promise<Record<string, string>> => {
      const token = (await cookies()).get('bl_at')?.value;
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  });
}
export class StaffAccessError extends Error {
  constructor(public code: StaffError) {
    super(code);
  }
}
export function staffError(cause: unknown): StaffError {
  if (cause instanceof StaffAccessError) return cause.code;
  if (cause instanceof ApiClientError) {
    if (cause.status === 401) return 'unauthenticated';
    if (cause.status === 403) return 'forbidden';
    if (cause.code === 'STOCK_VERSION_CONFLICT') return 'conflict';
    if (cause.code === 'INVALID_STATE') return 'invalidState';
    if (cause.code === 'RESOURCE_NOT_FOUND') return 'notFound';
    if (cause.code === 'VALIDATION_FAILED') return 'invalidInput';
  }
  return 'requestFailed';
}
export async function requireStaff(permission?: StaffPermission): Promise<StaffUser> {
  if (!(await cookies()).get('bl_at')?.value) {
    logStaffDiagnostic('error', {
      endpoint: '/users/me',
      stage: 'session',
      reason: 'missing_access_cookie',
    });
    throw new StaffAccessError('unauthenticated');
  }
  configureStaffApi();
  const user = await readStaffApi(
    '/users/me',
    usersControllerGet,
    (body) => UsersControllerGetResponse.required().parse(body).data,
  );
  if (user.role !== 'STAFF' || (permission && !user.permissions.includes(permission))) {
    logStaffDiagnostic('error', {
      endpoint: '/users/me',
      stage: 'access',
      reason: user.role !== 'STAFF' ? 'staff_role_required' : 'missing_permission',
    });
    throw new StaffAccessError('forbidden');
  }
  return user;
}
export const staffSession = cache(async (): Promise<Result<StaffUser>> => {
  try {
    return { ok: true, data: await requireStaff() };
  } catch (cause) {
    return { ok: false, error: staffError(cause) };
  }
});
export async function staffPageSession() {
  const result = await staffSession();
  if (!result.ok && result.error === 'unauthenticated') redirect('/login?next=%2Fstaff');
  return result;
}
export async function loadInventory(): Promise<
  Result<{
    products: InventoryProduct[];
    toppings: InventoryTopping[];
  }>
> {
  try {
    await requireStaff('stock.update');
    const [products, toppings] = await Promise.all([
      readStaffApi(
        '/staff/products',
        staffProductsControllerList,
        (body) => StaffProductsControllerListResponse.required().parse(body).data,
      ),
      readStaffApi(
        '/staff/toppings',
        staffToppingsControllerList,
        (body) => StaffToppingsControllerListResponse.required().parse(body).data,
      ),
    ]);
    return {
      ok: true,
      data: {
        products,
        toppings,
      },
    };
  } catch (cause) {
    return { ok: false, error: staffError(cause) };
  }
}
export async function loadOrders(): Promise<Result<Order[]>> {
  try {
    await requireStaff('order.board.read');
    const response = await staffOrdersControllerListBoard();
    return {
      ok: true,
      data: StaffOrdersControllerListBoardResponse.required().parse(response.data).data,
    };
  } catch (cause) {
    return { ok: false, error: staffError(cause) };
  }
}
