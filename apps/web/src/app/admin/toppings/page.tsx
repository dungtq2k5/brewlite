import { adminToppingsControllerList, type AdminToppingResponseDto } from '@brewlite/api-client';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { readPage } from '@/lib/api-server';
import ToppingsClient from './ToppingsClient';

export default async function AdminToppingsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string | string[] }>;
}) {
  const params = await searchParams;
  const deletedParam = Array.isArray(params.deleted) ? params.deleted[0] : params.deleted;
  const deletedOnly = deletedParam === '1';

  let rows: AdminToppingResponseDto[] = [];
  let failed = false;

  try {
    const response = await adminToppingsControllerList(
      deletedOnly ? { deleted: 'true' } : undefined,
    );
    rows = readPage<AdminToppingResponseDto>(response.data).rows;
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <>
        <PageHead title="Topping" meta="Không đọc được dữ liệu" />
        <Notice tone="error">
          <strong>Không tải được topping.</strong> Kiểm tra kết nối mạng rồi tải lại trang.
        </Notice>
      </>
    );
  }

  return <ToppingsClient rows={rows} deletedOnly={deletedOnly} />;
}
