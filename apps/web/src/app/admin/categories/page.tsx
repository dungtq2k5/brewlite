import { adminCategoriesControllerList, type AdminCategoryResponseDto } from '@brewlite/api-client';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { readPage } from '@/lib/api-server';
import { consoleCopy } from '@/i18n/console';
import { getLocale } from '@/i18n/locale.server';
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
    const locale = await getLocale();
    const { t } = consoleCopy(locale);
    return (
      <>
        <PageHead
          title={t('Danh mục', 'Categories')}
          meta={t('Không đọc được dữ liệu', 'Could not read data')}
        />
        <Notice tone="error">
          <strong>{t('Không tải được danh mục.', 'Could not load categories.')}</strong>{' '}
          {t(
            'Kiểm tra kết nối mạng rồi tải lại trang.',
            'Check your connection and reload the page.',
          )}
        </Notice>
      </>
    );
  }

  return <CategoriesClient rows={rows} deletedOnly={deletedOnly} />;
}
