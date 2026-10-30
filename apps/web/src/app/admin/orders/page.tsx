import { ButtonLink } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel } from '@/components/vellum/Panel';
import { consoleCopy } from '@/i18n/console';
import { getLocale } from '@/i18n/locale.server';

export default async function AdminOrdersPage() {
  const locale = await getLocale();
  const { t } = consoleCopy(locale);
  return (
    <>
      <PageHead
        title={t('Đơn hàng', 'Orders')}
        meta={t('Dùng bảng đơn của Staff', 'Use the Staff order board')}
        lede={t(
          'Danh sách đơn toàn hệ thống chưa được bật. Vận hành tại quầy dùng bảng đơn Staff, nơi có đủ đơn đang pha và đơn đã hoàn tất.',
          'The system-wide order list is not enabled yet. Counter operations use the Staff board, which covers brewing and completed orders.',
        )}
        actions={
          <ButtonLink href="/staff">{t('Mở bảng đơn Staff', 'Open Staff board')}</ButtonLink>
        }
      />

      <Panel>
        <div className="panel-body">
          <EmptyState
            title={t('Chưa có danh sách đơn riêng cho admin', 'No admin-specific order list yet')}
            action={
              <ButtonLink href="/staff">{t('Mở bảng đơn Staff', 'Open Staff board')}</ButtonLink>
            }
          >
            {t(
              'Bảng đơn Staff hiển thị đơn đang chờ pha, đang pha và chờ khách nhận. Đơn hoàn tất hoặc đã hủy tự rời bảng.',
              'The Staff board shows waiting, brewing and ready orders. Completed or cancelled orders leave the board automatically.',
            )}
          </EmptyState>
        </div>
      </Panel>
    </>
  );
}
