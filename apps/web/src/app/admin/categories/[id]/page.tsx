import { notFound } from 'next/navigation';
import { adminCategoriesControllerList, type AdminCategoryResponseDto } from '@brewlite/api-client';
import { ButtonLink } from '@/components/vellum/Button';
import { DetailList } from '@/components/vellum/DetailList';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelHead } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { consoleCopy } from '@/i18n/console';
import { getLocale } from '@/i18n/locale.server';
import { formatDay, formatMoment, nullableText } from '@/lib/admin-format';
import { readPage } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export default async function AdminCategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const { t } = consoleCopy(locale);

  let rows: AdminCategoryResponseDto[] = [];
  let failed = false;
  try {
    const response = await adminCategoriesControllerList();
    rows = readPage<AdminCategoryResponseDto>(response.data).rows;
  } catch {
    failed = true;
  }

  const category = rows.find((row) => row.id === id);
  if (!failed && rows.length > 0 && !category) notFound();

  if (failed || !category) {
    return (
      <>
        <PageHead
          title={t('Chi tiết danh mục', 'Category detail')}
          meta={t('Không đọc được dữ liệu', 'Could not load the record')}
          actions={
            <ButtonLink href="/admin/categories" variant="quiet" size="sm">
              ← {t('Danh sách', 'Back to list')}
            </ButtonLink>
          }
        />
        <Notice tone="error" role="alert">
          {t(
            'Không tải được danh mục. Kiểm tra kết nối rồi thử lại.',
            'Could not load this category. Check the connection and try again.',
          )}
        </Notice>
      </>
    );
  }

  const deleted = Boolean(nullableText(category.deletedAt));

  return (
    <>
      <PageHead
        title={category.name.vi}
        meta={category.name.en}
        lede={t(
          'Tên hai ngôn ngữ, thứ tự hiển thị và trạng thái của danh mục trên menu.',
          'Both language names, menu order and availability for this category.',
        )}
        actions={
          <ButtonLink href="/admin/categories" variant="quiet" size="sm">
            ← {t('Danh sách', 'Back to list')}
          </ButtonLink>
        }
      />

      <div className="record-grid">
        <Panel>
          <PanelHead
            title={t('Thông tin', 'Details')}
            action={
              <Tag tone={deleted ? 'error' : category.isActive ? 'success' : 'muted'}>
                {deleted
                  ? t('Đã xóa', 'Deleted')
                  : category.isActive
                    ? t('Đang dùng', 'In use')
                    : t('Tạm ẩn', 'Hidden')}
              </Tag>
            }
          />
          <div className="panel-body">
            <DetailList
              rows={[
                { label: t('Tên tiếng Việt', 'Vietnamese name'), value: category.name.vi },
                { label: t('Tên tiếng Anh', 'English name'), value: category.name.en },
                { label: t('Thứ tự', 'Sort order'), value: category.sortOrder },
                {
                  label: t('Trạng thái', 'Status'),
                  value: category.isActive ? t('Đang dùng', 'In use') : t('Tạm ẩn', 'Hidden'),
                },
                { label: t('Ngày tạo', 'Created'), value: formatDay(category.createdAt, locale) },
                {
                  label: t('Đã xóa lúc', 'Deleted at'),
                  value: nullableText(category.deletedAt)
                    ? formatMoment(nullableText(category.deletedAt), locale)
                    : '—',
                },
                { label: 'ID', value: <span className="record-id">{category.id}</span> },
              ]}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHead title={t('Liên quan', 'Related')} />
          <div className="panel-body stack">
            <ButtonLink href={`/admin/products?categoryId=${category.id}`} variant="quiet">
              {t('Xem món trong danh mục', 'View products in this category')}
            </ButtonLink>
            <p className="fine">
              {t(
                'Gateway chưa có endpoint đọc một danh mục; trang này đọc từ danh sách quản trị.',
                'The gateway has no single-category endpoint yet; this page reads the admin list.',
              )}
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
