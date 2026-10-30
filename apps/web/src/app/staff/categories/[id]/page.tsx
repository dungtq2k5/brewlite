import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  categoriesControllerList,
  staffProductsControllerList,
  type CategoryResponseDto,
  type StaffProductResponseDto,
} from '@brewlite/api-client';
import { ButtonLink } from '@/components/vellum/Button';
import { DetailList } from '@/components/vellum/DetailList';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelHead } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { consoleCopy } from '@/i18n/console';
import { localized } from '@/i18n/format';
import { getLocale } from '@/i18n/locale.server';
import { readPage, unwrap } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export default async function StaffCategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const { t } = consoleCopy(locale);

  let categories: CategoryResponseDto[] = [];
  let products: StaffProductResponseDto[] = [];
  let failed = false;
  const [categoryResult, productResult] = await Promise.allSettled([
    categoriesControllerList(),
    staffProductsControllerList(),
  ]);
  if (categoryResult.status === 'fulfilled') {
    categories = readPage<CategoryResponseDto>(categoryResult.value.data).rows;
  } else {
    failed = true;
  }
  if (productResult.status === 'fulfilled') {
    products = unwrap<StaffProductResponseDto[]>(productResult.value.data);
  }

  const category = categories.find((row) => row.id === id);
  if (!failed && categories.length > 0 && !category) notFound();

  if (failed || !category) {
    return (
      <>
        <PageHead
          title={t('Chi tiết danh mục', 'Category detail')}
          meta={t('Không đọc được dữ liệu', 'Could not load the record')}
          actions={
            <ButtonLink href="/staff/stock" variant="quiet" size="sm">
              ← {t('Kho & món', 'Stock & menu')}
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

  const rows = products.filter((product) => product.categoryId === category.id);

  return (
    <>
      <PageHead
        title={localized(category.name, locale)}
        meta={t('Danh mục trên menu', 'Menu category')}
        actions={
          <ButtonLink href="/staff/stock" variant="quiet" size="sm">
            ← {t('Kho & món', 'Stock & menu')}
          </ButtonLink>
        }
      />

      <div className="record-grid">
        <Panel>
          <PanelHead
            title={t('Thông tin', 'Details')}
            action={
              <Tag tone="muted">
                {rows.length} {t('món', 'products')}
              </Tag>
            }
          />
          <div className="panel-body">
            <DetailList
              rows={[
                { label: t('Tên tiếng Việt', 'Vietnamese name'), value: category.name.vi },
                { label: t('Tên tiếng Anh', 'English name'), value: category.name.en },
                { label: 'ID', value: <span className="record-id">{category.id}</span> },
              ]}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHead title={t('Món trong danh mục', 'Products in this category')} />
          {rows.length === 0 ? (
            <div className="panel-body">
              <p className="muted">{t('Chưa có món nào.', 'No products yet.')}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table table--stack">
                <thead>
                  <tr>
                    <th>{t('Món', 'Product')}</th>
                    <th>{t('Bán', 'On sale')}</th>
                    <th className="num">{t('Kho', 'Stock')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((product) => (
                    <tr key={product.id}>
                      <td data-label={t('Món', 'Product')}>
                        <Link className="text-link" href={`/staff/products/${product.id}`}>
                          {localized(product.name, locale)}
                        </Link>
                      </td>
                      <td data-label={t('Bán', 'On sale')}>
                        <Tag tone={product.isAvailable ? 'success' : 'warning'}>
                          {product.isAvailable
                            ? t('Đang bán', 'On sale')
                            : t('Ngừng bán', 'Stopped')}
                        </Tag>
                      </td>
                      <td data-label={t('Kho', 'Stock')} className="num">
                        {product.stockQty === null
                          ? t('Không giới hạn', 'Unlimited')
                          : product.stockQty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
