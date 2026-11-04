'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PromotionResponseDto } from '@brewlite/api-client';
import { Button, ButtonLink } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Modal } from '@/components/vellum/Modal';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Pagination } from '@/components/vellum/Pagination';
import { Panel } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { useToast } from '@/components/feedback/ToastProvider';
import { useConsoleCopy } from '@/i18n/console-context';
import { formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
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
import { runAction, type ActionResult } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';
import { ADMIN_PAGE_SIZE } from '@/lib/pagination';

type Failure = Extract<ActionResult<unknown>, { ok: false }>;
type DiscountType = 'PERCENT' | 'FIXED';

function failureMessage(result: Failure, locale: Locale): string {
  return describeError(result.code, result.details as ApiErrorDetails, locale);
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
  const { t, locale } = useConsoleCopy();
  const { showToast } = useToast();
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
    try {
      const result = await runAction(getPromotionAction(promotion.id));
      if (!result.ok) {
        setError(failureMessage(result, locale));
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
    } finally {
      setLoadingId(null);
    }
  };

  const afterWrite = (message: string) => {
    setCreateOpen(false);
    setEditTarget(null);
    setDeleteTarget(null);
    setError(null);
    showToast(message);
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
    (!Number.isInteger(parsedMaxUses) || parsedMaxUses < 1 || parsedMaxUses > 1_000_000);
  const parsedPerUser = perUserLimit.trim() === '' ? undefined : Number(perUserLimit);
  const perUserInvalid =
    parsedPerUser !== undefined &&
    (!Number.isInteger(parsedPerUser) || parsedPerUser < 1 || parsedPerUser > 1_000_000);
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
    try {
      const result = await runAction(
        createPromotionAction({
          code,
          description: description.trim() || undefined,
          discountType,
          discountValue: parsedDiscount,
          maxDiscountVnd: discountType === 'PERCENT' ? parsedMaxDiscount : undefined,
          minSubtotalVnd: parsedMin,
          startsAt: new Date(startTime).toISOString(),
          endsAt: new Date(endTime).toISOString(),
          maxUses: parsedMaxUses ?? null,
          perUserLimit: parsedPerUser ?? null,
          isActive,
        }),
      );
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      resetForm();
      afterWrite(t('Đã tạo mã khuyến mãi.', 'Promotion created.'));
    } finally {
      setBusy(null);
    }
  };

  const submitEdit = async () => {
    if (!editTarget || maxUsesInvalid || perUserInvalid || timeInvalid) return;
    setBusy('edit');
    setError(null);
    try {
      const result = await runAction(
        updatePromotionAction({
          promotionId: editTarget.id,
          description,
          endsAt: new Date(endTime).toISOString(),
          maxUses: parsedMaxUses ?? null,
          perUserLimit: parsedPerUser ?? null,
          isActive,
        }),
      );
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      afterWrite(t('Đã lưu thay đổi.', 'Changes saved.'));
    } finally {
      setBusy(null);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setBusy('delete');
    setError(null);
    try {
      const result = await runAction(deletePromotionAction(deleteTarget.id));
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      afterWrite(t('Đã xóa mềm mã khuyến mãi.', 'Promotion soft-deleted.'));
    } finally {
      setBusy(null);
    }
  };

  const restore = async (promotion: PromotionResponseDto) => {
    setBusy(promotion.id);
    setError(null);
    try {
      const result = await runAction(restorePromotionAction(promotion.id));
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      showToast(t('Đã khôi phục mã khuyến mãi.', 'Promotion restored.'));
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const modalOpen = createOpen || editTarget !== null;

  return (
    <>
      <PageHead
        title={t('Khuyến mãi', 'Promotions')}
        meta={t(`${total ?? rows.length} mã`, `${total ?? rows.length} codes`)}
        lede={t(
          'Tạo mã theo phần trăm hoặc số tiền, đặt thời gian, hạn mức và trạng thái. Mã đã dùng vẫn giữ lịch sử.',
          'Create percentage or fixed-amount codes, set the schedule, usage limits and status. Used codes keep their history.',
        )}
        actions={<Button onClick={openCreate}>{t('Tạo mã', 'Create code')}</Button>}
      />

      {error && !modalOpen && !deleteTarget && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      <Panel>
        <form className="toolbar" action="/admin/promotions" method="get">
          <div className="field">
            <label htmlFor="promo-q">{t('Tìm theo mã', 'Search by code')}</label>
            <input
              id="promo-q"
              className="input"
              name="q"
              defaultValue={query}
              placeholder="SUMMER15"
            />
          </div>
          <div className="field">
            <label htmlFor="promo-active">{t('Trạng thái bật', 'Active status')}</label>
            <select id="promo-active" className="input" name="active" defaultValue={activeFilter}>
              <option value="">{t('Tất cả', 'All')}</option>
              <option value="true">{t('Đang bật', 'Active')}</option>
              <option value="false">{t('Đang tắt', 'Inactive')}</option>
            </select>
          </div>
          <label className="check" style={{ flex: 'none' }}>
            <input type="checkbox" name="deleted" value="1" defaultChecked={deletedOnly} />
            <span>
              {t('Chỉ mã đã xóa', 'Deleted codes only')}
              <small>
                {t('Bật để khôi phục mã đã xóa mềm.', 'Use this to restore soft-deleted codes.')}
              </small>
            </span>
          </label>
          <Button type="submit">{t('Lọc', 'Filter')}</Button>
          {(query || activeFilter || deletedOnly) && (
            <a className="btn btn--quiet btn--sm" href="/admin/promotions">
              {t('Xóa lọc', 'Clear filter')}
            </a>
          )}
        </form>

        {rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState
              title={
                deletedOnly
                  ? t('Không có mã đã xóa', 'No deleted codes')
                  : t('Chưa có khuyến mãi', 'No promotions yet')
              }
            >
              {deletedOnly
                ? t(
                    'Không có mã nào bị xóa mềm khớp bộ lọc.',
                    'No soft-deleted code matches the filter.',
                  )
                : t(
                    'Tạo mã đầu tiên để khách áp dụng khi thanh toán.',
                    'Create the first code for customers to use at checkout.',
                  )}
            </EmptyState>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack table--ledger">
              <thead>
                <tr>
                  <th>{t('Mã', 'Code')}</th>
                  <th>{t('Mô tả', 'Description')}</th>
                  <th>{t('Mức giảm', 'Discount')}</th>
                  <th>{t('Thời gian', 'Period')}</th>
                  <th>{t('Đã dùng', 'Used')}</th>
                  <th>{t('Trạng thái', 'Status')}</th>
                  <th className="cell-actions">{t('Thao tác', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((promotion) => {
                  const state = promotionState(promotion, locale);
                  const maxUsesValue = nullableNumber(promotion.maxUses);
                  const perUserValue = nullableNumber(promotion.perUserLimit);
                  const deleted = deletedOnly;
                  return (
                    <tr key={promotion.id}>
                      <td data-label={t('Mã', 'Code')}>
                        <span className="cell-title">
                          <code>{promotion.code}</code>
                        </span>
                        {deleted && (
                          <span className="cell-meta">{t('Đã xóa mềm', 'Soft-deleted')}</span>
                        )}
                      </td>
                      <td data-label={t('Mô tả', 'Description')}>
                        {nullableText(promotion.description) ?? '—'}
                      </td>
                      <td data-label={t('Mức giảm', 'Discount')}>
                        {discountLabel(
                          promotion.discountType,
                          promotion.discountValue,
                          nullableNumber(promotion.maxDiscountVnd),
                          locale,
                        )}
                        <span className="cell-meta">
                          {t('đơn từ', 'min. order')} {formatVnd(promotion.minSubtotalVnd, locale)}
                        </span>
                      </td>
                      <td data-label={t('Thời gian', 'Period')}>
                        {formatDay(promotion.startsAt, locale)} –{' '}
                        {formatDay(promotion.endsAt, locale)}
                      </td>
                      <td data-label={t('Đã dùng', 'Used')}>
                        {promotion.usedCount}
                        <span className="cell-meta">
                          {t('tối đa', 'max')} {maxUsesValue ?? t('Không giới hạn', 'Unlimited')}
                          {perUserValue === null
                            ? ''
                            : t(`, ${perUserValue}/khách`, `, ${perUserValue}/customer`)}
                        </span>
                      </td>
                      <td data-label={t('Trạng thái', 'Status')}>
                        <Tag tone={state.tone}>{state.label}</Tag>
                      </td>
                      <td className="cell-actions" data-label={t('Thao tác', 'Actions')}>
                        {deleted ? (
                          <Button
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void restore(promotion)}
                          >
                            {busy === promotion.id
                              ? t('Đang khôi phục…', 'Restoring…')
                              : t('Khôi phục', 'Restore')}
                          </Button>
                        ) : (
                          <>
                            <ButtonLink
                              href={`/admin/promotions/${promotion.id}`}
                              size="sm"
                              variant="quiet"
                            >
                              {t('Chi tiết', 'Details')}
                            </ButtonLink>
                            <Button
                              size="sm"
                              variant="quiet"
                              disabled={busy !== null || loadingId !== null}
                              onClick={() => void openEdit(promotion)}
                            >
                              {loadingId === promotion.id
                                ? t('Đang tải…', 'Loading…')
                                : t('Sửa', 'Edit')}
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
                              {t('Xóa', 'Delete')}
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
            label={t('mã', 'codes')}
            note={t('mới nhất trước', 'newest first')}
            query={queryString}
          />
        )}
      </Panel>

      {createOpen && (
        <Modal
          title={t('Tạo mã khuyến mãi', 'Create promotion')}
          meta={t(
            'Mã được chuẩn hóa thành chữ in hoa, không dấu cách.',
            'Codes are normalized to uppercase without spaces.',
          )}
          wide
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                {t('Hủy', 'Cancel')}
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
                {busy === 'create' ? t('Đang tạo…', 'Creating…') : t('Tạo mã', 'Create code')}
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
              <label htmlFor="promo-code">{t('Mã', 'Code')}</label>
              <input
                id="promo-code"
                className="input"
                value={code}
                maxLength={32}
                placeholder="SUMMER15"
                style={{ textTransform: 'uppercase' }}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
              <p className="field-hint">
                {t(
                  '3–32 ký tự: chữ, số, gạch ngang hoặc gạch dưới.',
                  '3–32 characters: letters, numbers, hyphen or underscore.',
                )}
              </p>
            </div>
            <div className="field">
              <label htmlFor="promo-desc">{t('Mô tả', 'Description')}</label>
              <input
                id="promo-desc"
                className="input"
                value={description}
                maxLength={200}
                placeholder={t('Giảm 15% mùa hè', '15% off summer')}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="promo-type">{t('Loại giảm', 'Discount type')}</label>
              <select
                id="promo-type"
                className="input"
                value={discountType}
                onChange={(event) => setDiscountType(event.target.value as DiscountType)}
              >
                <option value="PERCENT">{t('Phần trăm', 'Percentage')}</option>
                <option value="FIXED">{t('Số tiền', 'Fixed amount')}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="promo-value">
                {discountType === 'PERCENT'
                  ? t('Phần trăm giảm', 'Discount percentage')
                  : t('Số tiền giảm (VND)', 'Discount amount (VND)')}
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
              <label htmlFor="promo-max">{t('Giảm tối đa (VND)', 'Max discount (VND)')}</label>
              <input
                id="promo-max"
                className="input"
                type="number"
                min={0}
                max={10000000}
                step={1000}
                value={maxDiscount}
                placeholder={t('Để trống nếu không giới hạn', 'Leave empty for no cap')}
                onChange={(event) => setMaxDiscount(event.target.value)}
              />
            </div>
          )}

          <div className="form-grid">
            <div className="field">
              <label htmlFor="promo-min">{t('Đơn tối thiểu (VND)', 'Minimum order (VND)')}</label>
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
              <label htmlFor="promo-max-uses">{t('Tổng lượt dùng', 'Total uses')}</label>
              <input
                id="promo-max-uses"
                className="input"
                type="number"
                min={1}
                step={1}
                value={maxUses}
                placeholder={t('Không giới hạn', 'Unlimited')}
                onChange={(event) => setMaxUses(event.target.value)}
              />
              <p className="field-hint">
                {t('Để trống nghĩa là không giới hạn.', 'Leave empty for unlimited.')}
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="promo-start">{t('Bắt đầu', 'Starts')}</label>
              <input
                id="promo-start"
                className="input"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="promo-end">{t('Kết thúc', 'Ends')}</label>
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
              <label htmlFor="promo-per-user">{t('Lượt mỗi khách', 'Uses per customer')}</label>
              <input
                id="promo-per-user"
                className="input"
                type="number"
                min={1}
                step={1}
                value={perUserLimit}
                placeholder={t('Không giới hạn', 'Unlimited')}
                onChange={(event) => setPerUserLimit(event.target.value)}
              />
              <p className="field-hint">
                {t('Để trống nghĩa là không giới hạn.', 'Leave empty for unlimited.')}
              </p>
            </div>
            <label className="check" style={{ alignSelf: 'end' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              <span>
                {t('Bật ngay', 'Active now')}
                <small>
                  {t(
                    'Mã vẫn phải nằm trong thời gian hiệu lực.',
                    'The code still has to be within its active window.',
                  )}
                </small>
              </span>
            </label>
          </div>
        </Modal>
      )}

      {editTarget && (
        <Modal
          title={t(`Sửa mã · ${editTarget.code}`, `Edit code · ${editTarget.code}`)}
          meta={t(
            `Tạo lúc ${formatMoment(editTarget.createdAt, locale)} · ${discountLabel(
              editTarget.discountType,
              editTarget.discountValue,
              nullableNumber(editTarget.maxDiscountVnd),
              locale,
            )}`,
            `Created ${formatMoment(editTarget.createdAt, locale)} · ${discountLabel(
              editTarget.discountType,
              editTarget.discountValue,
              nullableNumber(editTarget.maxDiscountVnd),
              locale,
            )}`,
          )}
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                {t('Hủy', 'Cancel')}
              </Button>
              <Button
                disabled={busy !== null || maxUsesInvalid || perUserInvalid || timeInvalid}
                onClick={() => void submitEdit()}
              >
                {busy === 'edit' ? t('Đang lưu…', 'Saving…') : t('Lưu thay đổi', 'Save changes')}
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
            {t(
              'Mã, mức giảm, đơn tối thiểu và ngày bắt đầu không sửa được sau khi tạo. Hãy tạo mã mới nếu cần đổi các thông số đó.',
              'The code, discount, minimum order and start date cannot be changed after creation. Create a new code if you need different values.',
            )}
          </Notice>
          <div className="field">
            <label htmlFor="promo-edit-desc">{t('Mô tả', 'Description')}</label>
            <input
              id="promo-edit-desc"
              className="input"
              value={description}
              maxLength={200}
              onChange={(event) => setDescription(event.target.value)}
            />
            <p className="field-hint">
              {t('Để trống để xóa mô tả.', 'Leave empty to clear the description.')}
            </p>
          </div>
          <div className="field">
            <label htmlFor="promo-edit-end">{t('Kết thúc', 'Ends')}</label>
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
              <label htmlFor="promo-edit-max">{t('Tổng lượt dùng', 'Total uses')}</label>
              <input
                id="promo-edit-max"
                className="input"
                type="number"
                min={1}
                step={1}
                value={maxUses}
                placeholder={t('Không giới hạn', 'Unlimited')}
                onChange={(event) => setMaxUses(event.target.value)}
              />
              <p className="field-hint">
                {t('Để trống nghĩa là không giới hạn.', 'Leave empty for unlimited.')}
              </p>
            </div>
            <div className="field">
              <label htmlFor="promo-edit-per">{t('Lượt mỗi khách', 'Uses per customer')}</label>
              <input
                id="promo-edit-per"
                className="input"
                type="number"
                min={1}
                step={1}
                value={perUserLimit}
                placeholder={t('Không giới hạn', 'Unlimited')}
                onChange={(event) => setPerUserLimit(event.target.value)}
              />
              <p className="field-hint">
                {t('Để trống nghĩa là không giới hạn.', 'Leave empty for unlimited.')}
              </p>
            </div>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            <span>
              {t('Đang bật', 'Active')}
              <small>{t('Bỏ chọn để tạm dừng áp dụng mã.', 'Uncheck to pause this code.')}</small>
            </span>
          </label>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={t(`Xóa mã · ${deleteTarget.code}`, `Delete code · ${deleteTarget.code}`)}
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                {t('Giữ lại', 'Keep')}
              </Button>
              <Button
                variant="danger-fill"
                disabled={busy !== null}
                onClick={() => void submitDelete()}
              >
                {busy === 'delete' ? t('Đang xóa…', 'Deleting…') : t('Xóa mềm', 'Soft delete')}
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
            {t(
              'Mã sẽ không còn áp dụng cho đơn mới. Lịch sử lượt dùng vẫn được giữ lại.',
              'The code will no longer apply to new orders. Its usage history is kept.',
            )}
          </Notice>
        </Modal>
      )}
    </>
  );
}
