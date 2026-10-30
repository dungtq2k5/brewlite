import { notFound } from 'next/navigation';
import { promotionsControllerGet, type PromotionResponseDto } from '@brewlite/api-client';
import { ButtonLink } from '@/components/vellum/Button';
import { DetailList } from '@/components/vellum/DetailList';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelHead } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { consoleCopy } from '@/i18n/console';
import { formatVnd } from '@/i18n/format';
import { getLocale } from '@/i18n/locale.server';
import {
  discountLabel,
  formatDay,
  formatMoment,
  nullableNumber,
  nullableText,
  promotionState,
} from '@/lib/admin-format';
import { unwrap } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export default async function AdminPromotionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const { t } = consoleCopy(locale);

  let promotion: PromotionResponseDto | null = null;
  let failed = false;
  try {
    const response = await promotionsControllerGet(id);
    promotion = unwrap<PromotionResponseDto>(response.data);
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    if (status === 404) notFound();
    failed = true;
  }

  if (failed || !promotion) {
    return (
      <>
        <PageHead
          title={t('Chi tiết khuyến mãi', 'Promotion detail')}
          meta={t('Không đọc được dữ liệu', 'Could not load the record')}
          actions={
            <ButtonLink href="/admin/promotions" variant="quiet" size="sm">
              ← {t('Danh sách', 'Back to list')}
            </ButtonLink>
          }
        />
        <Notice tone="error" role="alert">
          {t(
            'Không tải được khuyến mãi. Kiểm tra kết nối rồi thử lại.',
            'Could not load this promotion. Check the connection and try again.',
          )}
        </Notice>
      </>
    );
  }

  const state = promotionState(promotion, locale);
  const maxUses = nullableNumber(promotion.maxUses);
  const perUser = nullableNumber(promotion.perUserLimit);
  const maxDiscount = nullableNumber(promotion.maxDiscountVnd);

  return (
    <>
      <PageHead
        title={promotion.code}
        meta={nullableText(promotion.description) ?? t('Không có mô tả', 'No description')}
        lede={t(
          'Mức giảm, thời gian hiệu lực và giới hạn sử dụng của mã.',
          'Discount, validity window and usage limits for this code.',
        )}
        actions={
          <ButtonLink href="/admin/promotions" variant="quiet" size="sm">
            ← {t('Danh sách', 'Back to list')}
          </ButtonLink>
        }
      />

      <div className="record-grid">
        <Panel>
          <PanelHead
            title={t('Thông tin', 'Details')}
            action={<Tag tone={state.tone}>{state.label}</Tag>}
          />
          <div className="panel-body">
            <DetailList
              rows={[
                { label: t('Mã', 'Code'), value: <code>{promotion.code}</code> },
                {
                  label: t('Mô tả', 'Description'),
                  value: nullableText(promotion.description) ?? '—',
                },
                {
                  label: t('Mức giảm', 'Discount'),
                  value: discountLabel(
                    promotion.discountType,
                    promotion.discountValue,
                    maxDiscount,
                    locale,
                  ),
                },
                {
                  label: t('Giảm tối đa', 'Max discount'),
                  value: maxDiscount === null ? '—' : formatVnd(maxDiscount, locale),
                },
                {
                  label: t('Đơn tối thiểu', 'Minimum subtotal'),
                  value: formatVnd(promotion.minSubtotalVnd, locale),
                },
                {
                  label: t('Bắt đầu', 'Starts'),
                  value: formatMoment(promotion.startsAt, locale),
                },
                { label: t('Kết thúc', 'Ends'), value: formatMoment(promotion.endsAt, locale) },
                { label: t('Ngày tạo', 'Created'), value: formatDay(promotion.createdAt, locale) },
                { label: 'ID', value: <span className="record-id">{promotion.id}</span> },
              ]}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHead title={t('Sử dụng', 'Usage')} />
          <div className="panel-body">
            <DetailList
              rows={[
                {
                  label: t('Đã dùng', 'Used'),
                  value: `${promotion.usedCount}${maxUses === null ? '' : ` / ${maxUses}`}`,
                },
                {
                  label: t('Tổng lượt', 'Total limit'),
                  value: maxUses === null ? t('Không giới hạn', 'Unlimited') : String(maxUses),
                },
                {
                  label: t('Mỗi khách', 'Per customer'),
                  value: perUser === null ? t('Không giới hạn', 'Unlimited') : String(perUser),
                },
                {
                  label: t('Đang bật', 'Enabled'),
                  value: promotion.isActive ? t('Có', 'Yes') : t('Không', 'No'),
                },
              ]}
            />
          </div>
        </Panel>
      </div>
    </>
  );
}
