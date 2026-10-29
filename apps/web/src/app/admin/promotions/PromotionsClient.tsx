'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PromotionResponseDto } from '@brewlite/api-client';
import { Button } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Modal } from '@/components/vellum/Modal';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Pagination } from '@/components/vellum/Pagination';
import { Panel } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { formatVnd } from '@/i18n/format';
import {
  discountLabel,
  formatDay,
  formatMoment,
  nullableNumber,
  nullableText,
  promotionState,
} from '@/lib/admin-format';
import {
  createPromotionAction,
  deletePromotionAction,
  getPromotionAction,
  restorePromotionAction,
  updatePromotionAction,
} from '@/lib/admin-actions';
import type { ActionResult } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';
import { ADMIN_PAGE_SIZE } from '@/lib/pagination';

type Failure = Extract<ActionResult<unknown>, { ok: false }>;
type DiscountType = 'PERCENT' | 'FIXED';

function failureMessage(result: Failure): string {
  return describeError(result.code, result.details as ApiErrorDetails, 'vi');
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function inDays(days: number): string {
  return toLocalInput(new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString());
}

export default function PromotionsClient({
  rows,
  total,
  pageNumber,
  deletedOnly,
  query,
  activeFilter,
  queryString,
}: {
  rows: PromotionResponseDto[];
  total: number | null;
  pageNumber: number;
  deletedOnly: boolean;
  query: string;
  activeFilter: 'true' | 'false' | '';
  queryString: string;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PromotionResponseDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromotionResponseDto | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENT');
  const [discountValue, setDiscountValue] = useState('10');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minSubtotal, setMinSubtotal] = useState('0');
  const [startsAt, setStartsAt] = useState(inDays(0));
  const [endsAt, setEndsAt] = useState(inDays(7));
  const [maxUses, setMaxUses] = useState('');
  const [perUserLimit, setPerUserLimit] = useState('');
  const [isActive, setIsActive] = useState(true);

  const close = () => {
    if (busy) return;
    setCreateOpen(false);
    setEditTarget(null);
    setDeleteTarget(null);
    setError(null);
  };

  const resetForm = () => {
    setCode('');
    setDescription('');
    setDiscountType('PERCENT');
    setDiscountValue('10');
    setMaxDiscount('');
    setMinSubtotal('0');
    setStartsAt(inDays(0));
    setEndsAt(inDays(7));
    setMaxUses('');
    setPerUserLimit('');
    setIsActive(true);
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = async (promotion: PromotionResponseDto) => {
    setLoadingId(promotion.id);
    setError(null);
    const result = await getPromotionAction(promotion.id);
    setLoadingId(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    const fresh = result.data;
    setDescription(fresh.description ?? '');
    setStartsAt(toLocalInput(fresh.startsAt));
    setEndsAt(toLocalInput(fresh.endsAt));
    setMaxUses(fresh.maxUses === null ? '' : String(fresh.maxUses));
    setPerUserLimit(fresh.perUserLimit === null ? '' : String(fresh.perUserLimit));
    setIsActive(fresh.isActive);
    setEditTarget(fresh);
  };

  const afterWrite = () => {
    setCreateOpen(false);
    setEditTarget(null);
    setDeleteTarget(null);
    setError(null);
    router.refresh();
  };

  const parsedDiscount = Number(discountValue);
  const discountInvalid =
    discountValue.trim() === '' ||
    !Number.isInteger(parsedDiscount) ||
    parsedDiscount < 1 ||
    parsedDiscount > 10_000_000 ||
    (discountType === 'PERCENT' && parsedDiscount > 100);
  const parsedMin = Number(minSubtotal);
  const minInvalid =
    minSubtotal.trim() === '' ||
    !Number.isInteger(parsedMin) ||
    parsedMin < 0 ||
    parsedMin > 10_000_000;
  const parsedMaxDiscount = maxDiscount.trim() === '' ? undefined : Number(maxDiscount);
  const maxDiscountInvalid =
    parsedMaxDiscount !== undefined &&
    (!Number.isInteger(parsedMaxDiscount) ||
      parsedMaxDiscount < 0 ||
      parsedMaxDiscount > 10_000_000);
  const parsedMaxUses = maxUses.trim() === '' ? undefined : Number(maxUses);
  const maxUsesInvalid =
    parsedMaxUses !== undefined &&
    (!Number.isInteger(parsedMaxUses) || parsedMaxUses < 0 || parsedMaxUses > 1_000_000);
  const parsedPerUser = perUserLimit.trim() === '' ? undefined : Number(perUserLimit);
  const perUserInvalid =
    parsedPerUser !== undefined &&
    (!Number.isInteger(parsedPerUser) || parsedPerUser < 0 || parsedPerUser > 1_000_000);
  const startTime = Date.parse(startsAt);
  const endTime = Date.parse(endsAt);
  const timeInvalid = Number.isNaN(startTime) || Number.isNaN(endTime) || endTime <= startTime;

  const submitCreate = async () => {
    if (
      discountInvalid ||
      minInvalid ||
      maxDiscountInvalid ||
      maxUsesInvalid ||
      perUserInvalid ||
      timeInvalid
    ) {
      return;
    }
    setBusy('create');
    setError(null);
    const result = await createPromotionAction({
      code,
      description: description.trim() || undefined,
      discountType,
      discountValue: parsedDiscount,
      maxDiscountVnd: discountType === 'PERCENT' ? parsedMaxDiscount : undefined,
      minSubtotalVnd: parsedMin,
      startsAt: new Date(startTime).toISOString(),
      endsAt: new Date(endTime).toISOString(),
      maxUses: parsedMaxUses,
      perUserLimit: parsedPerUser,
      isActive,
    });
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    resetForm();
    afterWrite();
  };

  const submitEdit = async () => {
    if (!editTarget || maxUsesInvalid || perUserInvalid || timeInvalid) return;
    setBusy('edit');
    setError(null);
    const result = await updatePromotionAction({
      promotionId: editTarget.id,
      description,
      endsAt: new Date(endTime).toISOString(),
      maxUses: parsedMaxUses,
      perUserLimit: parsedPerUser,
      isActive,
    });
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    afterWrite();
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setBusy('delete');
    setError(null);
    const result = await deletePromotionAction(deleteTarget.id);
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    afterWrite();
  };

  const restore = async (promotion: PromotionResponseDto) => {
    setBusy(promotion.id);
    setError(null);
    const result = await restorePromotionAction(promotion.id);
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    router.refresh();
  };

  const modalOpen = createOpen || editTarget !== null;

  return (
    <>
      <PageHead
        title="Khuyến mãi"
        meta={`${total ?? rows.length} mã`}
        lede="Tạo mã theo phần trăm hoặc số tiền, đặt thời gian, hạn mức và trạng thái. Mã đã dùng vẫn giữ lịch sử."
        actions={<Button onClick={openCreate}>Tạo mã</Button>}
      />

      {error && !modalOpen && !deleteTarget && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      <Panel>
        <form className="toolbar" action="/admin/promotions" method="get">
          <div className="field">
            <label htmlFor="promo-q">Tìm theo mã</label>
            <input
              id="promo-q"
              className="input"
              name="q"
              defaultValue={query}
              placeholder="Ví dụ: SUMMER15"
            />
          </div>
          <div className="field">
            <label htmlFor="promo-active">Trạng thái bật</label>
            <select id="promo-active" className="input" name="active" defaultValue={activeFilter}>
              <option value="">Tất cả</option>
              <option value="true">Đang bật</option>
              <option value="false">Đang tắt</option>
            </select>
          </div>
          <label className="check" style={{ flex: 'none' }}>
            <input type="checkbox" name="deleted" value="1" defaultChecked={deletedOnly} />
            <span>
              Chỉ mã đã xóa
              <small>Bật để khôi phục mã đã xóa mềm.</small>
            </span>
          </label>
          <Button type="submit">Lọc</Button>
          {(query || activeFilter || deletedOnly) && (
            <a className="btn btn--quiet btn--sm" href="/admin/promotions">
              Xóa lọc
            </a>
          )}
        </form>

        {rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState title={deletedOnly ? 'Không có mã đã xóa' : 'Chưa có khuyến mãi'}>
              {deletedOnly
                ? 'Không có mã nào bị xóa mềm khớp bộ lọc.'
                : 'Tạo mã đầu tiên để khách áp dụng khi thanh toán.'}
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
                  <th className="cell-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((promotion) => {
                  const state = promotionState(promotion);
                  const maxUsesValue = nullableNumber(promotion.maxUses);
                  const perUserValue = nullableNumber(promotion.perUserLimit);
                  const deleted = deletedOnly;
                  return (
                    <tr key={promotion.id}>
                      <td data-label="Mã">
                        <span className="cell-title">
                          <code>{promotion.code}</code>
                        </span>
                        {deleted && <span className="cell-meta">Đã xóa mềm</span>}
                      </td>
                      <td data-label="Mô tả">{nullableText(promotion.description) ?? '—'}</td>
                      <td data-label="Mức giảm">
                        {discountLabel(
                          promotion.discountType,
                          promotion.discountValue,
                          nullableNumber(promotion.maxDiscountVnd),
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
                          tối đa {maxUsesValue ?? 'Không giới hạn'}
                          {perUserValue === null ? '' : `, ${perUserValue}/khách`}
                        </span>
                      </td>
                      <td data-label="Trạng thái">
                        <Tag tone={state.tone}>{state.label}</Tag>
                      </td>
                      <td className="cell-actions" data-label="Thao tác">
                        {deleted ? (
                          <Button
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void restore(promotion)}
                          >
                            {busy === promotion.id ? 'Đang khôi phục…' : 'Khôi phục'}
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="quiet"
                              disabled={busy !== null || loadingId !== null}
                              onClick={() => void openEdit(promotion)}
                            >
                              {loadingId === promotion.id ? 'Đang tải…' : 'Sửa'}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy !== null}
                              onClick={() => {
                                setError(null);
                                setDeleteTarget(promotion);
                              }}
                            >
                              Xóa
                            </Button>
                          </>
                        )}
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
            query={queryString}
          />
        )}
      </Panel>

      {createOpen && (
        <Modal
          title="Tạo mã khuyến mãi"
          meta="Mã được chuẩn hóa thành chữ in hoa, không dấu cách."
          wide
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                Hủy
              </Button>
              <Button
                disabled={
                  busy !== null ||
                  code.trim().length === 0 ||
                  discountInvalid ||
                  minInvalid ||
                  maxDiscountInvalid ||
                  maxUsesInvalid ||
                  perUserInvalid ||
                  timeInvalid
                }
                onClick={() => void submitCreate()}
              >
                {busy === 'create' ? 'Đang tạo…' : 'Tạo mã'}
              </Button>
            </>
          }
        >
          {error && (
            <Notice tone="error" role="alert">
              {error}
            </Notice>
          )}

          <div className="form-grid">
            <div className="field">
              <label htmlFor="promo-code">Mã</label>
              <input
                id="promo-code"
                className="input"
                value={code}
                maxLength={32}
                placeholder="SUMMER15"
                style={{ textTransform: 'uppercase' }}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
              <p className="field-hint">3–32 ký tự: chữ, số, gạch ngang hoặc gạch dưới.</p>
            </div>
            <div className="field">
              <label htmlFor="promo-desc">Mô tả</label>
              <input
                id="promo-desc"
                className="input"
                value={description}
                maxLength={200}
                placeholder="Giảm 15% mùa hè"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="promo-type">Loại giảm</label>
              <select
                id="promo-type"
                className="input"
                value={discountType}
                onChange={(event) => setDiscountType(event.target.value as DiscountType)}
              >
                <option value="PERCENT">Phần trăm</option>
                <option value="FIXED">Số tiền</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="promo-value">
                {discountType === 'PERCENT' ? 'Phần trăm giảm' : 'Số tiền giảm (VND)'}
              </label>
              <input
                id="promo-value"
                className="input"
                type="number"
                min={1}
                max={discountType === 'PERCENT' ? 100 : 10000000}
                step={discountType === 'PERCENT' ? 1 : 1000}
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
              />
            </div>
          </div>

          {discountType === 'PERCENT' && (
            <div className="field">
              <label htmlFor="promo-max">Giảm tối đa (VND)</label>
              <input
                id="promo-max"
                className="input"
                type="number"
                min={0}
                max={10000000}
                step={1000}
                value={maxDiscount}
                placeholder="Để trống nếu không giới hạn"
                onChange={(event) => setMaxDiscount(event.target.value)}
              />
            </div>
          )}

          <div className="form-grid">
            <div className="field">
              <label htmlFor="promo-min">Đơn tối thiểu (VND)</label>
              <input
                id="promo-min"
                className="input"
                type="number"
                min={0}
                max={10000000}
                step={1000}
                value={minSubtotal}
                onChange={(event) => setMinSubtotal(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="promo-max-uses">Tổng lượt dùng</label>
              <input
                id="promo-max-uses"
                className="input"
                type="number"
                min={0}
                step={1}
                value={maxUses}
                placeholder="Không giới hạn"
                onChange={(event) => setMaxUses(event.target.value)}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="promo-start">Bắt đầu</label>
              <input
                id="promo-start"
                className="input"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="promo-end">Kết thúc</label>
              <input
                id="promo-end"
                className="input"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="promo-per-user">Lượt mỗi khách</label>
              <input
                id="promo-per-user"
                className="input"
                type="number"
                min={0}
                step={1}
                value={perUserLimit}
                placeholder="Không giới hạn"
                onChange={(event) => setPerUserLimit(event.target.value)}
              />
            </div>
            <label className="check" style={{ alignSelf: 'end' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              <span>
                Bật ngay
                <small>Mã vẫn phải nằm trong thời gian hiệu lực.</small>
              </span>
            </label>
          </div>
        </Modal>
      )}

      {editTarget && (
        <Modal
          title={`Sửa mã · ${editTarget.code}`}
          meta={`Tạo lúc ${formatMoment(editTarget.createdAt)} · ${discountLabel(
            editTarget.discountType,
            editTarget.discountValue,
            nullableNumber(editTarget.maxDiscountVnd),
          )}`}
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                Hủy
              </Button>
              <Button
                disabled={busy !== null || maxUsesInvalid || perUserInvalid || timeInvalid}
                onClick={() => void submitEdit()}
              >
                {busy === 'edit' ? 'Đang lưu…' : 'Lưu thay đổi'}
              </Button>
            </>
          }
        >
          {error && (
            <Notice tone="error" role="alert">
              {error}
            </Notice>
          )}
          <Notice tone="warning">
            Mã, mức giảm, đơn tối thiểu và ngày bắt đầu không sửa được sau khi tạo. Hãy tạo mã mới
            nếu cần đổi các thông số đó.
          </Notice>
          <div className="field">
            <label htmlFor="promo-edit-desc">Mô tả</label>
            <input
              id="promo-edit-desc"
              className="input"
              value={description}
              maxLength={200}
              onChange={(event) => setDescription(event.target.value)}
            />
            <p className="field-hint">Để trống để xóa mô tả.</p>
          </div>
          <div className="field">
            <label htmlFor="promo-edit-end">Kết thúc</label>
            <input
              id="promo-edit-end"
              className="input"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="promo-edit-max">Tổng lượt dùng</label>
              <input
                id="promo-edit-max"
                className="input"
                type="number"
                min={0}
                step={1}
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
              />
              <p className="field-hint">Để trống để giữ nguyên giới hạn hiện tại.</p>
            </div>
            <div className="field">
              <label htmlFor="promo-edit-per">Lượt mỗi khách</label>
              <input
                id="promo-edit-per"
                className="input"
                type="number"
                min={0}
                step={1}
                value={perUserLimit}
                onChange={(event) => setPerUserLimit(event.target.value)}
              />
              <p className="field-hint">Để trống để giữ nguyên giới hạn hiện tại.</p>
            </div>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <span>
              Đang bật
              <small>Bỏ chọn để tạm dừng áp dụng mã.</small>
            </span>
          </label>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={`Xóa mã · ${deleteTarget.code}`}
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                Giữ lại
              </Button>
              <Button
                variant="danger-fill"
                disabled={busy !== null}
                onClick={() => void submitDelete()}
              >
                {busy === 'delete' ? 'Đang xóa…' : 'Xóa mềm'}
              </Button>
            </>
          }
        >
          {error && (
            <Notice tone="error" role="alert">
              {error}
            </Notice>
          )}
          <Notice tone="warning">
            Mã sẽ không còn áp dụng cho đơn mới. Lịch sử lượt dùng vẫn được giữ lại.
          </Notice>
        </Modal>
      )}
    </>
  );
}
