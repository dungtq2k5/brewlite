import { notFound } from 'next/navigation';
import { staffToppingsControllerList, type StaffToppingResponseDto } from '@brewlite/api-client';
import { ButtonLink } from '@/components/vellum/Button';
import { DetailList } from '@/components/vellum/DetailList';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelHead } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { consoleCopy } from '@/i18n/console';
import { formatVnd } from '@/i18n/format';
import { getLocale } from '@/i18n/locale.server';
import { unwrap } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export default async function StaffToppingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const { t } = consoleCopy(locale);

  let rows: StaffToppingResponseDto[] = [];
  let failed = false;
  try {
    const response = await staffToppingsControllerList();
    rows = unwrap<StaffToppingResponseDto[]>(response.data);
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
            <ButtonLink href="/staff/stock" variant="quiet" size="sm">
              ← {t('Kho & món', 'Stock & menu')}
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

  return (
    <>
      <PageHead
        title={topping.name.vi}
        meta={topping.name.en}
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
              <Tag tone={topping.isAvailable ? 'success' : 'warning'}>
                {topping.isAvailable ? t('Đang bán', 'On sale') : t('Ngừng bán', 'Stopped')}
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
                { label: 'ID', value: <span className="record-id">{topping.id}</span> },
              ]}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHead title={t('Liên quan', 'Related')} />
          <div className="panel-body stack">
            <ButtonLink href="/staff/stock" variant="quiet">
              {t('Đổi trạng thái ở Kho & món', 'Change availability in Stock & menu')}
            </ButtonLink>
          </div>
        </Panel>
      </div>
    </>
  );
}
