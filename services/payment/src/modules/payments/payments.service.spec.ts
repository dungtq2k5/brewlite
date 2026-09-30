import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { describe, expect, it, vi } from 'vitest';
import { Role } from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
import { PaymentsService } from './payments.service.js';

const caller: Caller = { kind: 'USER', userId: 'u1', role: Role.CUSTOMER };

function errorCodeOf(exception: unknown): string | undefined {
  if (!(exception && typeof exception === 'object' && 'getError' in exception)) return undefined;
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  return metadata.get('bl-error-code')[0] as string | undefined;
}

describe('PaymentsService.fakeConfirm — production guard', () => {
  it('answers ROUTE_NOT_FOUND without touching the database, as if the route did not exist', async () => {
    const config = { get: vi.fn().mockReturnValue('production') };
    const prisma = { payment: { findFirst: vi.fn() } };
    const service = new PaymentsService(
      prisma as never,
      config as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const error = await service
      .fakeConfirm({ id: 'p1', outcome: 'SUCCEEDED' }, caller)
      .catch((e: unknown) => e);

    expect(errorCodeOf(error)).toBe('ROUTE_NOT_FOUND');
    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
  });
});
