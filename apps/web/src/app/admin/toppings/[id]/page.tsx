import { notFound } from 'next/navigation';
import { adminToppingsControllerList, type AdminToppingResponseDto } from '@brewlite/api-client';
import { ButtonLink } from '@/components/vellum/Button';
import { DetailList } from '@/components/vellum/DetailList';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelHead } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { consoleCopy } from '@/i18n/console';
import { formatVnd } from '@/i18n/format';
import { getLocale } from '@/i18n/locale.server';
import { formatDay, formatMoment, nullableText } from '@/lib/admin-format';
import { readPage } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export default async function AdminToppingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const { t } = consoleCopy(locale);

  let rows: AdminToppingResponseDto[] = [];
  let failed = false;
  try {
    const response = await adminToppingsControllerList();
    rows = readPage<AdminToppingResponseDto>(response.data).rows;
  } catch {
    failed = true;
  }

  const topping = rows.find((row) => row.id === id);
  if (!failed && rows.length > 0 && !topping) notFound();

  if (failed || !topping) {
    return (
      <>
        <PageHead
          title={t('Chi tiết topping', 'Topping detail')}
          meta={t('Không đọc được dữ liệu', 'Could not load the record')}
          actions={
            <ButtonLink href="/admin/toppings" variant="quiet" size="sm">
              ← {t('Danh sách', 'Back to list')}
            </ButtonLink>
          }
        />
        <Notice tone="error" role="alert">
          {t(
            'Không tải được topping. Kiểm tra kết nối rồi thử lại.',
            'Could not load this topping. Check the connection and try again.',
          )}
        </Notice>
      </>
    );
  }

  const deleted = Boolean(nullableText(topping.deletedAt));

  return (
    <>
      <PageHead
        title={topping.name.vi}
        meta={topping.name.en}
        lede={t(
          'Giá cộng thêm, trạng thái bán và lịch sử tạo của topping.',
          'Extra price, availability and creation history for this topping.',
        )}
        actions={
          <ButtonLink href="/admin/toppings" variant="quiet" size="sm">
            ← {t('Danh sách', 'Back to list')}
          </ButtonLink>
        }
      />

      <div className="record-grid">
        <Panel>
          <PanelHead
            title={t('Thông tin', 'Details')}
            action={
              <Tag tone={deleted ? 'error' : topping.isAvailable ? 'success' : 'warning'}>
                {deleted
                  ? t('Đã xóa', 'Deleted')
                  : topping.isAvailable
                    ? t('Đang bán', 'On sale')
                    : t('Tạm hết', 'Unavailable')}
              </Tag>
            }
          />
          <div className="panel-body">
            <DetailList
              rows={[
                { label: t('Tên tiếng Việt', 'Vietnamese name'), value: topping.name.vi },
                { label: t('Tên tiếng Anh', 'English name'), value: topping.name.en },
                {
                  label: t('Giá cộng thêm', 'Extra price'),
                  value: formatVnd(topping.priceVnd, locale),
                },
                {
                  label: t('Trạng thái', 'Status'),
                  value: topping.isAvailable
                    ? t('Đang bán', 'On sale')
                    : t('Tạm hết', 'Unavailable'),
                },
                { label: t('Ngày tạo', 'Created'), value: formatDay(topping.createdAt, locale) },
                {
                  label: t('Đã xóa lúc', 'Deleted at'),
                  value: nullableText(topping.deletedAt)
                    ? formatMoment(nullableText(topping.deletedAt), locale)
                    : '—',
                },
                { label: 'ID', value: <span className="record-id">{topping.id}</span> },
              ]}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHead title={t('Liên quan', 'Related')} />
          <div className="panel-body stack">
            <ButtonLink href="/staff/stock" variant="quiet">
              {t('Bật/tắt nhanh ở Kho & món', 'Toggle quickly in Stock & menu')}
            </ButtonLink>
            <p className="fine">
              {t(
                'Gateway chưa có endpoint đọc một topping; trang này đọc từ danh sách quản trị.',
                'The gateway has no single-topping endpoint yet; this page reads the admin list.',
              )}
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
