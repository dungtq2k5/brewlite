'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminToppingResponseDto } from '@brewlite/api-client';
import { Button, ButtonLink } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Modal } from '@/components/vellum/Modal';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { useToast } from '@/components/feedback/ToastProvider';
import { useConsoleCopy } from '@/i18n/console-context';
import { formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import { formatDay, nullableText } from '@/lib/admin-format';
import {
  createToppingAction,
  deleteToppingAction,
  restoreToppingAction,
  updateToppingAction,
} from '@/lib/admin-actions';
import { runAction, type ActionResult } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';

type Failure = Extract<ActionResult<unknown>, { ok: false }>;

function failureMessage(result: Failure, locale: Locale): string {
  return describeError(result.code, result.details as ApiErrorDetails, locale);
}

function ToppingStatus({ topping }: { topping: AdminToppingResponseDto }) {
  const { t } = useConsoleCopy();
  if (nullableText(topping.deletedAt)) return <Tag tone="error">{t('Đã xóa', 'Deleted')}</Tag>;
  if (!topping.isAvailable) return <Tag tone="warning">{t('Tạm hết', 'Sold out')}</Tag>;
  return <Tag tone="success">{t('Đang bán', 'Available')}</Tag>;
}

export default function ToppingsClient({
  rows,
  deletedOnly,
}: {
  rows: AdminToppingResponseDto[];
  deletedOnly: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useConsoleCopy();
  const { showToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminToppingResponseDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminToppingResponseDto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameVi, setNameVi] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [price, setPrice] = useState('0');
  const [isAvailable, setIsAvailable] = useState(true);

  const close = () => {
    if (busy) return;
    setCreateOpen(false);
    setEditTarget(null);
    setDeleteTarget(null);
    setError(null);
  };

  const resetForm = () => {
    setNameVi('');
    setNameEn('');
    setPrice('0');
    setIsAvailable(true);
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (topping: AdminToppingResponseDto) => {
    setNameVi(topping.name.vi);
    setNameEn(topping.name.en);
    setPrice(String(topping.priceVnd));
    setIsAvailable(topping.isAvailable);
    setError(null);
    setEditTarget(topping);
  };

  const afterWrite = (message: string) => {
    setCreateOpen(false);
    setEditTarget(null);
    setDeleteTarget(null);
    setError(null);
    showToast(message);
    router.refresh();
  };

  const parsedPrice = Number(price);
  const priceInvalid =
    price.trim() === '' ||
    !Number.isInteger(parsedPrice) ||
    parsedPrice < 0 ||
    parsedPrice > 10_000_000;

  const submitCreate = async () => {
    if (priceInvalid) return;
    setBusy('create');
    setError(null);
    try {
      const result = await runAction(
        createToppingAction({
          name: { vi: nameVi, en: nameEn },
          priceVnd: parsedPrice,
        }),
      );
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      resetForm();
      afterWrite(t('Đã thêm topping.', 'Topping added.'));
    } finally {
      setBusy(null);
    }
  };

  const submitEdit = async () => {
    if (!editTarget || priceInvalid) return;
    setBusy('edit');
    setError(null);
    try {
      const result = await runAction(
        updateToppingAction({
          toppingId: editTarget.id,
          name: { vi: nameVi, en: nameEn },
          priceVnd: parsedPrice,
          isAvailable,
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
      const result = await runAction(deleteToppingAction(deleteTarget.id));
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      afterWrite(t('Đã xóa mềm topping.', 'Topping soft-deleted.'));
    } finally {
      setBusy(null);
    }
  };

  const restore = async (topping: AdminToppingResponseDto) => {
    setBusy(topping.id);
    setError(null);
    try {
      const result = await runAction(restoreToppingAction(topping.id));
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      showToast(t('Đã khôi phục topping.', 'Topping restored.'));
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHead
        title={t('Topping', 'Toppings')}
        meta={t(`${rows.length} topping`, `${rows.length} toppings`)}
        lede={t(
          'Topping dùng chung cho các món. Bật/tắt nhanh ở Kho & món; tại đây sửa tên, giá và xóa mềm.',
          'Toppings are shared across products. Toggle availability in Stock & menu; edit names, prices and soft delete here.',
        )}
        actions={<Button onClick={openCreate}>{t('Thêm topping', 'Add topping')}</Button>}
      />

      {error && !createOpen && !editTarget && !deleteTarget && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      <Panel>
        <form className="toolbar" action="/admin/toppings" method="get">
          <label className="check" style={{ flex: 'none' }}>
            <input type="checkbox" name="deleted" value="1" defaultChecked={deletedOnly} />
            <span>
              {t('Chỉ topping đã xóa', 'Deleted toppings only')}
              <small>
                {t(
                  'Dùng để khôi phục topping đã xóa mềm.',
                  'Use this to restore soft-deleted toppings.',
                )}
              </small>
            </span>
          </label>
          <Button type="submit">{t('Lọc', 'Filter')}</Button>
          {deletedOnly && (
            <a className="btn btn--quiet btn--sm" href="/admin/toppings">
              {t('Xóa lọc', 'Clear filter')}
            </a>
          )}
        </form>

        {rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState
              title={
                deletedOnly
                  ? t('Không có topping đã xóa', 'No deleted toppings')
                  : t('Chưa có topping', 'No toppings yet')
              }
            >
              {deletedOnly
                ? t('Không có topping nào bị xóa mềm.', 'No topping has been soft-deleted.')
                : t(
                    'Thêm topping đầu tiên để khách chọn kèm món.',
                    'Add the first topping so customers can add it to a drink.',
                  )}
            </EmptyState>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack table--ledger">
              <thead>
                <tr>
                  <th>{t('Topping', 'Topping')}</th>
                  <th className="num">{t('Giá', 'Price')}</th>
                  <th>{t('Trạng thái', 'Status')}</th>
                  <th>{t('Ngày tạo', 'Created')}</th>
                  <th className="cell-actions">{t('Thao tác', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((topping) => {
                  const deleted = Boolean(nullableText(topping.deletedAt));
                  return (
                    <tr key={topping.id}>
                      <td data-label={t('Topping', 'Topping')}>
                        <span className="cell-title">{topping.name.vi}</span>
                        <span className="cell-meta">{topping.name.en}</span>
                      </td>
                      <td data-label={t('Giá', 'Price')} className="num">
                        {formatVnd(topping.priceVnd, locale)}
                      </td>
                      <td data-label={t('Trạng thái', 'Status')}>
                        <ToppingStatus topping={topping} />
                      </td>
                      <td data-label={t('Ngày tạo', 'Created')}>
                        {formatDay(topping.createdAt, locale)}
                      </td>
                      <td className="cell-actions" data-label={t('Thao tác', 'Actions')}>
                        {deleted ? (
                          <Button
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void restore(topping)}
                          >
                            {busy === topping.id
                              ? t('Đang khôi phục…', 'Restoring…')
                              : t('Khôi phục', 'Restore')}
                          </Button>
                        ) : (
                          <>
                            <ButtonLink
                              href={`/admin/toppings/${topping.id}`}
                              size="sm"
                              variant="quiet"
                            >
                              {t('Chi tiết', 'Details')}
                            </ButtonLink>
                            <Button
                              size="sm"
                              variant="quiet"
                              disabled={busy !== null}
                              onClick={() => openEdit(topping)}
                            >
                              {t('Sửa', 'Edit')}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy !== null}
                              onClick={() => {
                                setError(null);
                                setDeleteTarget(topping);
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
        <p className="pagination">
          <span>
            {t(
              `${rows.length} topping, gồm cả mục đã xóa mềm nếu có.`,
              `${rows.length} toppings, including soft-deleted entries when present.`,
            )}
          </span>
        </p>
      </Panel>

      {(createOpen || editTarget) && (
        <Modal
          title={
            editTarget
              ? t(`Sửa topping · ${editTarget.name.vi}`, `Edit topping · ${editTarget.name.vi}`)
              : t('Thêm topping', 'Add topping')
          }
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                {t('Hủy', 'Cancel')}
              </Button>
              <Button
                disabled={
                  busy !== null ||
                  nameVi.trim().length === 0 ||
                  nameEn.trim().length === 0 ||
                  priceInvalid
                }
                onClick={() => void (editTarget ? submitEdit() : submitCreate())}
              >
                {busy
                  ? t('Đang lưu…', 'Saving…')
                  : editTarget
                    ? t('Lưu thay đổi', 'Save changes')
                    : t('Thêm topping', 'Add topping')}
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
              <label htmlFor="topping-vi">{t('Tên tiếng Việt', 'Vietnamese name')}</label>
              <input
                id="topping-vi"
                className="input"
                value={nameVi}
                maxLength={60}
                onChange={(event) => setNameVi(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="topping-en">{t('Tên tiếng Anh', 'English name')}</label>
              <input
                id="topping-en"
                className="input"
                value={nameEn}
                maxLength={60}
                onChange={(event) => setNameEn(event.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="topping-price">{t('Giá cộng thêm (VND)', 'Extra price (VND)')}</label>
            <input
              id="topping-price"
              className="input"
              type="number"
              min={0}
              max={10000000}
              step={1000}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
            <p className="field-hint">
              {formatVnd(Number.isFinite(parsedPrice) ? parsedPrice : 0, locale)}
            </p>
          </div>
          {editTarget && (
            <label className="check">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(event) => setIsAvailable(event.target.checked)}
              />
              <span>
                {t('Đang bán', 'Available')}
                <small>
                  {t('Bỏ chọn để tạm ngừng topping này.', 'Uncheck to pause this topping.')}
                </small>
              </span>
            </label>
          )}
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={t(
            `Xóa topping · ${deleteTarget.name.vi}`,
            `Delete topping · ${deleteTarget.name.vi}`,
          )}
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
              'Topping sẽ bị gỡ khỏi món đang dùng. Có thể khôi phục ở bộ lọc “Chỉ topping đã xóa”.',
              'The topping will be removed from products that use it. Restore it with the “Deleted toppings only” filter.',
            )}
          </Notice>
        </Modal>
      )}
    </>
  );
}
