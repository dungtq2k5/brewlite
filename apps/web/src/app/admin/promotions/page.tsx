import { promotionsControllerList, type PromotionResponseDto } from '@brewlite/api-client';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Pagination } from '@/components/vellum/Pagination';
import { Panel } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { formatVnd } from '@/i18n/format';
import {
  discountLabel,
  formatDay,
  nullableNumber,
  nullableText,
  promotionState,
} from '@/lib/admin-format';
import { readPage } from '@/lib/api-server';
import { ADMIN_PAGE_SIZE, parsePageParam } from '@/lib/pagination';

export default async function AdminPromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  let pageNumber = parsePageParam((await searchParams).page);
  let rows: PromotionResponseDto[] = [];
  let total: number | null = null;
  let failed = false;

  try {
    const load = (page: number) =>
      promotionsControllerList({ page, pageSize: ADMIN_PAGE_SIZE, sort: '-createdAt' });

    let response = await load(pageNumber);
    let page = readPage<PromotionResponseDto>(response.data);
    const totalPages = Math.max(1, Math.ceil((page.total ?? page.rows.length) / ADMIN_PAGE_SIZE));
    if (pageNumber > totalPages) {
      pageNumber = totalPages;
      response = await load(pageNumber);
      page = readPage<PromotionResponseDto>(response.data);
    }
    rows = page.rows;
    total = page.total;
  } catch {
    failed = true;
  }

  return (
    <>
      <PageHead
        title="Khuyến mãi"
        meta={failed ? 'Không đọc được dữ liệu' : `${total ?? rows.length} mã`}
        lede="Mã, mức giảm và đơn tối thiểu đọc từ hệ thống khuyến mãi. Tạo và sửa mã chưa hỗ trợ trên giao diện."
      />

      {failed ? (
        <Notice tone="error">
          <strong>Không tải được khuyến mãi.</strong> Kiểm tra kết nối mạng rồi tải lại trang.
        </Notice>
      ) : (
        <Panel>
          {rows.length === 0 ? (
            <div className="panel-body">
              <EmptyState title="Chưa có khuyến mãi">
                Hệ thống chưa trả về mã nào. Mã mới sẽ xuất hiện ở đây.
              </EmptyState>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table table--stack table--ledger">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Mô tả</th>
                    <th>Mức giảm</th>
                    <th>Thời gian</th>
                    <th>Đã dùng</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((promotion) => {
                    const state = promotionState(promotion);
                    const maxUses = nullableNumber(promotion.maxUses);
                    const perUserLimit = nullableNumber(promotion.perUserLimit);
                    return (
                      <tr key={promotion.id}>
                        <td data-label="Mã">
                          <span className="cell-title">
                            <code>{promotion.code}</code>
                          </span>
                        </td>
                        <td data-label="Mô tả">{nullableText(promotion.description) ?? '—'}</td>
                        <td data-label="Mức giảm">
                          {discountLabel(
                            promotion.discountType,
                            promotion.discountValue,
                            promotion.maxDiscountVnd,
                          )}
                          <span className="cell-meta">
                            đơn từ {formatVnd(promotion.minSubtotalVnd, 'vi')}
                          </span>
                        </td>
                        <td data-label="Thời gian">
                          {formatDay(promotion.startsAt)} – {formatDay(promotion.endsAt)}
                        </td>
                        <td data-label="Đã dùng">
                          {promotion.usedCount}
                          <span className="cell-meta">
                            tối đa {maxUses ?? 'Không giới hạn'}
                            {perUserLimit === null ? '' : `, ${perUserLimit}/khách`}
                          </span>
                        </td>
                        <td data-label="Trạng thái">
                          <Tag tone={state.tone}>{state.label}</Tag>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {(total ?? rows.length) > 0 && (
            <Pagination
              basePath="/admin/promotions"
              page={pageNumber}
              pageSize={ADMIN_PAGE_SIZE}
              total={total ?? rows.length}
              label="mã"
              note="mới nhất trước"
            />
          )}
        </Panel>
      )}
    </>
  );
}
