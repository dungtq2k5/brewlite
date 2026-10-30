import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  adminProductsControllerGet,
  adminToppingsControllerList,
  type AdminProductResponseDto,
  type AdminToppingResponseDto,
} from '@brewlite/api-client';
import { ButtonLink } from '@/components/vellum/Button';
import { DetailList } from '@/components/vellum/DetailList';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelHead } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { consoleCopy } from '@/i18n/console';
import { formatVnd, localized } from '@/i18n/format';
import { getLocale } from '@/i18n/locale.server';
import { formatDay, formatMoment, nullableText } from '@/lib/admin-format';
import { readPage, unwrap } from '@/lib/api-server';
import ProductDetailActions from './ProductDetailActions';
import ProductImageControl from '../ProductImageControl';

export const dynamic = 'force-dynamic';

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const { t } = consoleCopy(locale);

  let product: AdminProductResponseDto | null = null;
  let failed = false;
  try {
    const response = await adminProductsControllerGet(id);
    product = unwrap<AdminProductResponseDto>(response.data);
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    if (status === 404) notFound();
    failed = true;
  }

  if (failed || !product) {
    return (
      <>
        <PageHead
          title={t('Chi tiết sản phẩm', 'Product detail')}
          meta={t('Không đọc được dữ liệu', 'Could not load the record')}
          actions={
            <ButtonLink href="/admin/products" variant="quiet" size="sm">
              ← {t('Danh sách', 'Back to list')}
            </ButtonLink>
          }
        />
        <Notice tone="error" role="alert">
          {t(
            'Không tải được sản phẩm. Kiểm tra kết nối rồi thử lại.',
            'Could not load this product. Check the connection and try again.',
          )}
        </Notice>
      </>
    );
  }

  const toppings = new Map<string, AdminToppingResponseDto>();
  const toppingResults = await Promise.allSettled([
    adminToppingsControllerList(),
    adminToppingsControllerList({ deleted: 'true' }),
  ]);
  for (const result of toppingResults) {
    if (result.status !== 'fulfilled') continue;
    for (const row of readPage<AdminToppingResponseDto>(result.value.data).rows) {
      toppings.set(row.id, row);
    }
  }

  const deleted = Boolean(nullableText(product.deletedAt));
  const statusTone = deleted ? 'error' : product.isAvailable ? 'success' : 'warning';
  const statusLabel = deleted
    ? t('Đã xóa', 'Deleted')
    : product.isAvailable
      ? t('Đang bán', 'On sale')
      : t('Tạm ngừng', 'Paused');
  const description = product.description;
  const selectedToppings = product.toppingIds.map((toppingId) => ({
    id: toppingId,
    topping: toppings.get(toppingId),
  }));

  return (
    <>
      <PageHead
        title={localized(product.name, locale)}
        meta={localized(product.name, locale === 'vi' ? 'en' : 'vi')}
        lede={t(
          'Thông tin đọc trực tiếp từ catalog, gồm giá, size, topping và ảnh đang dùng.',
          'Catalog data read live, including price, sizes, toppings and the current image.',
        )}
        actions={
          <>
            <ProductDetailActions
              productId={product.id}
              productName={localized(product.name, locale)}
              isAvailable={product.isAvailable}
              deleted={deleted}
            />
            <ButtonLink href="/admin/products" variant="quiet" size="sm">
              ← {t('Danh sách', 'Back to list')}
            </ButtonLink>
          </>
        }
      />

      <div className="record-grid">
        <Panel>
          <PanelHead
            title={t('Thông tin', 'Details')}
            action={<Tag tone={statusTone}>{statusLabel}</Tag>}
          />
          <div className="panel-body">
            <DetailList
              rows={[
                { label: t('Tên tiếng Việt', 'Vietnamese name'), value: product.name.vi },
                { label: t('Tên tiếng Anh', 'English name'), value: product.name.en },
                {
                  label: t('Danh mục', 'Category'),
                  value: (
                    <Link className="text-link" href={`/admin/categories/${product.categoryId}`}>
                      {localized(product.categoryName, locale)}
                    </Link>
                  ),
                },
                {
                  label: t('Giá gốc', 'Base price'),
                  value: formatVnd(product.basePriceVnd, locale),
                },
                {
                  label: t('Tồn kho', 'Stock'),
                  value:
                    product.stockQty === null
                      ? t('Không theo dõi', 'Not tracked')
                      : String(product.stockQty),
                },
                { label: t('Thứ tự', 'Sort order'), value: product.sortOrder },
                { label: t('Phiên bản', 'Version'), value: `v${product.version}` },
                { label: t('Ngày tạo', 'Created'), value: formatDay(product.createdAt, locale) },
                {
                  label: t('Đã xóa lúc', 'Deleted at'),
                  value: nullableText(product.deletedAt)
                    ? formatMoment(nullableText(product.deletedAt), locale)
                    : '—',
                },
                {
                  label: t('Người xóa', 'Deleted by'),
                  value: nullableText(product.deletedById) ? (
                    <span className="record-id">{nullableText(product.deletedById)}</span>
                  ) : (
                    '—'
                  ),
                },
                { label: 'ID', value: <span className="record-id">{product.id}</span> },
              ]}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHead title={t('Ảnh sản phẩm', 'Product image')} />
          <div className="panel-body stack">
            <ProductImageControl
              productId={product.id}
              productName={product.name.vi}
              imageUrl={product.imageUrl}
            />
            <p className="fine">
              {t(
                'JPEG, PNG hoặc WebP, tối đa 2 MB. Ảnh dùng ngay trên menu khách.',
                'JPEG, PNG or WebP, up to 2 MB. The image appears on the customer menu immediately.',
              )}
            </p>
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title={t('Size và giá bán', 'Sizes and sale price')}
            action={<Tag tone="muted">{product.sizes.length}</Tag>}
          />
          <div className="panel-body">
            {product.sizes.length === 0 ? (
              <p className="muted">{t('Chưa cấu hình size.', 'No sizes configured.')}</p>
            ) : (
              <DetailList
                rows={product.sizes.map((size) => ({
                  label: `${t('Size', 'Size')} ${size.size}`,
                  value: `${t('Phụ thu', 'Surcharge')} ${formatVnd(
                    size.priceDeltaVnd,
                    locale,
                  )} · ${t('Giá bán', 'Sale price')} ${formatVnd(
                    product.basePriceVnd + size.priceDeltaVnd,
                    locale,
                  )}`,
                }))}
              />
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title={t('Topping', 'Toppings')}
            action={
              <ButtonLink href="/admin/toppings" variant="quiet" size="sm">
                {t('Quản lý', 'Manage')}
              </ButtonLink>
            }
          />
          <div className="panel-body">
            {selectedToppings.length === 0 ? (
              <p className="muted">
                {t('Món này chưa gắn topping.', 'No toppings on this product.')}
              </p>
            ) : (
              <div className="tag-cloud">
                {selectedToppings.map(({ id: toppingId, topping }) =>
                  topping ? (
                    <Tag key={toppingId} tone={topping.isAvailable ? 'muted' : 'warning'}>
                      {localized(topping.name, locale)} · +{formatVnd(topping.priceVnd, locale)}
                      {topping.isAvailable ? '' : ` · ${t('tạm ngừng', 'paused')}`}
                    </Tag>
                  ) : (
                    <Tag key={toppingId} tone="warning">
                      {t('Không tìm thấy topping', 'Topping not found')} · {toppingId}
                    </Tag>
                  ),
                )}
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHead title={t('Mô tả', 'Description')} />
          <div className="panel-body stack">
            {description && description.vi ? (
              <div>
                <p className="fine">{t('Tiếng Việt', 'Vietnamese')}</p>
                <p>{description.vi}</p>
              </div>
            ) : null}
            {description && description.en ? (
              <div>
                <p className="fine">{t('Tiếng Anh', 'English')}</p>
                <p>{description.en}</p>
              </div>
            ) : null}
            {!description || (!description.vi && !description.en) ? (
              <p className="muted">{t('Chưa có mô tả.', 'No description yet.')}</p>
            ) : null}
          </div>
        </Panel>
      </div>
    </>
  );
}
