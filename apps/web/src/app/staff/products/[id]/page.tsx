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

export default async function StaffProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const { t } = consoleCopy(locale);

  let products: StaffProductResponseDto[] = [];
  let categories: CategoryResponseDto[] = [];
  let failed = false;
  const [productResult, categoryResult] = await Promise.allSettled([
    staffProductsControllerList(),
    categoriesControllerList(),
  ]);
  if (productResult.status === 'fulfilled') {
    products = unwrap<StaffProductResponseDto[]>(productResult.value.data);
  } else {
    failed = true;
  }
  if (categoryResult.status === 'fulfilled') {
    categories = readPage<CategoryResponseDto>(categoryResult.value.data).rows;
  }

  const product = products.find((row) => row.id === id);
  if (!failed && products.length > 0 && !product) notFound();

  if (failed || !product) {
    return (
      <>
        <PageHead
          title={t('Chi tiết món', 'Product detail')}
          meta={t('Không đọc được dữ liệu', 'Could not load the record')}
          actions={
            <ButtonLink href="/staff/stock" variant="quiet" size="sm">
              ← {t('Kho & món', 'Stock & menu')}
            </ButtonLink>
          }
        />
        <Notice tone="error" role="alert">
          {t(
            'Không tải được món. Kiểm tra kết nối rồi thử lại.',
            'Could not load this product. Check the connection and try again.',
          )}
        </Notice>
      </>
    );
  }

  const category = categories.find((row) => row.id === product.categoryId);

  return (
    <>
      <PageHead
        title={localized(product.name, locale)}
        meta={localized(product.name, locale === 'vi' ? 'en' : 'vi')}
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
              <Tag tone={product.isAvailable ? 'success' : 'warning'}>
                {product.isAvailable ? t('Đang bán', 'On sale') : t('Ngừng bán', 'Stopped')}
              </Tag>
            }
          />
          <div className="panel-body">
            <DetailList
              rows={[
                { label: t('Tên tiếng Việt', 'Vietnamese name'), value: product.name.vi },
                { label: t('Tên tiếng Anh', 'English name'), value: product.name.en },
                {
                  label: t('Danh mục', 'Category'),
                  value: category ? (
                    <ButtonLink href={`/staff/categories/${category.id}`} variant="quiet" size="sm">
                      {localized(category.name, locale)}
                    </ButtonLink>
                  ) : (
                    '—'
                  ),
                },
                {
                  label: t('Tồn kho', 'Stock'),
                  value:
                    product.stockQty === null
                      ? t('Không giới hạn', 'Unlimited')
                      : String(product.stockQty),
                },
                {
                  label: t('Phiên bản kho', 'Stock version'),
                  value: `v${product.version}`,
                },
                { label: 'ID', value: <span className="record-id">{product.id}</span> },
              ]}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHead title={t('Liên quan', 'Related')} />
          <div className="panel-body stack">
            <ButtonLink href="/staff/stock" variant="quiet">
              {t('Cập nhật kho và trạng thái', 'Update stock and availability')}
            </ButtonLink>
            <p className="fine">
              {t(
                'Màn hình Staff chỉ đọc các trường vận hành: tên, danh mục, tồn kho và trạng thái bán.',
                'The staff surface only reads operational fields: name, category, stock and availability.',
              )}
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
