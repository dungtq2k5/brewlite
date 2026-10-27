import { adminToppingsControllerList, type AdminToppingResponseDto } from '@brewlite/api-client';
import { handlePageApiError, requireServerAuth } from '@/lib/api-server';
import { unwrapNullable } from '@/lib/zod-schemas';
import type { MockTopping } from '@/mocks/admin-data';
import { ToppingsClient } from './toppings-client';

function mapTop(dto: AdminToppingResponseDto): MockTopping {
  return {
    id: dto.id,
    name: dto.name,
    priceVnd: dto.priceVnd,
    isAvailable: dto.isAvailable,
    deletedAt: unwrapNullable(dto.deletedAt),
    createdAt: dto.createdAt,
  };
}

export default async function AdminToppingsPage() {
  await requireServerAuth();
  try {
    const [resActive, resDeleted] = await Promise.all([
      adminToppingsControllerList({ deleted: 'false' }),
      adminToppingsControllerList({ deleted: 'true' }),
    ]);

    const toppings = [
      ...((resActive.data as unknown as { data?: AdminToppingResponseDto[] })?.data ?? []),
      ...((resDeleted.data as unknown as { data?: AdminToppingResponseDto[] })?.data ?? []),
    ].map(mapTop);

    return <ToppingsClient initialToppings={toppings} />;
  } catch (err) {
    handlePageApiError(err);
  }
}