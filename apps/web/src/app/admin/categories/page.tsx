import { adminCategoriesControllerList, type AdminCategoryResponseDto } from '@brewlite/api-client';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { readPage } from '@/lib/api-server';
import CategoriesClient from './CategoriesClient';

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string | string[] }>;
}) {
  const params = await searchParams;
  const deletedParam = Array.isArray(params.deleted) ? params.deleted[0] : params.deleted;
  const deletedOnly = deletedParam === '1';

  let rows: AdminCategoryResponseDto[] = [];
  let failed = false;

  try {
    const response = await adminCategoriesControllerList(
      deletedOnly ? { deleted: 'true' } : undefined,
    );
    rows = readPage<AdminCategoryResponseDto>(response.data).rows;
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <>
        <PageHead title="Danh mục" meta="Không đọc được dữ liệu" />
        <Notice tone="error">
          <strong>Không tải được danh mục.</strong> Kiểm tra kết nối mạng rồi tải lại trang.
        </Notice>
      </>
    );
  }

  return <CategoriesClient rows={rows} deletedOnly={deletedOnly} />;
}
