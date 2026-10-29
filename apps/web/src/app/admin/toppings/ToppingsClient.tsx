'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminToppingResponseDto } from '@brewlite/api-client';
import { Button } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Modal } from '@/components/vellum/Modal';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { formatVnd } from '@/i18n/format';
import { formatDay, nullableText } from '@/lib/admin-format';
import {
  createToppingAction,
  deleteToppingAction,
  restoreToppingAction,
  updateToppingAction,
} from '@/lib/admin-actions';
import type { ActionResult } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';

type Failure = Extract<ActionResult<unknown>, { ok: false }>;

function failureMessage(result: Failure): string {
  return describeError(result.code, result.details as ApiErrorDetails, 'vi');
}

function ToppingStatus({ topping }: { topping: AdminToppingResponseDto }) {
  if (nullableText(topping.deletedAt)) return <Tag tone="error">Đã xóa</Tag>;
  if (!topping.isAvailable) return <Tag tone="warning">Tạm hết</Tag>;
  return <Tag tone="success">Đang bán</Tag>;
}

export default function ToppingsClient({
  rows,
  deletedOnly,
}: {
  rows: AdminToppingResponseDto[];
  deletedOnly: boolean;
}) {
  const router = useRouter();
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

  const afterWrite = () => {
    setCreateOpen(false);
    setEditTarget(null);
    setDeleteTarget(null);
    setError(null);
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
    const result = await createToppingAction({
      name: { vi: nameVi, en: nameEn },
      priceVnd: parsedPrice,
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
    if (!editTarget || priceInvalid) return;
    setBusy('edit');
    setError(null);
    const result = await updateToppingAction({
      toppingId: editTarget.id,
      name: { vi: nameVi, en: nameEn },
      priceVnd: parsedPrice,
      isAvailable,
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
    const result = await deleteToppingAction(deleteTarget.id);
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    afterWrite();
  };

  const restore = async (topping: AdminToppingResponseDto) => {
    setBusy(topping.id);
    setError(null);
    const result = await restoreToppingAction(topping.id);
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    router.refresh();
  };

  return (
    <>
      <PageHead
        title="Topping"
        meta={`${rows.length} topping`}
        lede="Topping dùng chung cho các món. Bật/tắt nhanh ở Kho & món; tại đây sửa tên, giá và xóa mềm."
        actions={<Button onClick={openCreate}>Thêm topping</Button>}
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
              Chỉ topping đã xóa
              <small>Dùng để khôi phục topping đã xóa mềm.</small>
            </span>
          </label>
          <Button type="submit">Lọc</Button>
          {deletedOnly && (
            <a className="btn btn--quiet btn--sm" href="/admin/toppings">
              Xóa lọc
            </a>
          )}
        </form>

        {rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState title={deletedOnly ? 'Không có topping đã xóa' : 'Chưa có topping'}>
              {deletedOnly
                ? 'Không có topping nào bị xóa mềm.'
                : 'Thêm topping đầu tiên để khách chọn kèm món.'}
            </EmptyState>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack table--ledger">
              <thead>
                <tr>
                  <th>Topping</th>
                  <th className="num">Giá</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th className="cell-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((topping) => {
                  const deleted = Boolean(nullableText(topping.deletedAt));
                  return (
                    <tr key={topping.id}>
                      <td data-label="Topping">
                        <span className="cell-title">{topping.name.vi}</span>
                        <span className="cell-meta">{topping.name.en}</span>
                      </td>
                      <td data-label="Giá" className="num">
                        {formatVnd(topping.priceVnd, 'vi')}
                      </td>
                      <td data-label="Trạng thái">
                        <ToppingStatus topping={topping} />
                      </td>
                      <td data-label="Ngày tạo">{formatDay(topping.createdAt)}</td>
                      <td className="cell-actions" data-label="Thao tác">
                        {deleted ? (
                          <Button
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void restore(topping)}
                          >
                            {busy === topping.id ? 'Đang khôi phục…' : 'Khôi phục'}
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="quiet"
                              disabled={busy !== null}
                              onClick={() => openEdit(topping)}
                            >
                              Sửa
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
        <p className="pagination">
          <span>{rows.length} topping, gồm cả mục đã xóa mềm nếu có.</span>
        </p>
      </Panel>

      {(createOpen || editTarget) && (
        <Modal
          title={editTarget ? `Sửa topping · ${editTarget.name.vi}` : 'Thêm topping'}
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                Hủy
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
                {busy ? 'Đang lưu…' : editTarget ? 'Lưu thay đổi' : 'Thêm topping'}
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
              <label htmlFor="topping-vi">Tên tiếng Việt</label>
              <input
                id="topping-vi"
                className="input"
                value={nameVi}
                maxLength={60}
                onChange={(event) => setNameVi(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="topping-en">Tên tiếng Anh</label>
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
            <label htmlFor="topping-price">Giá cộng thêm (VND)</label>
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
              {formatVnd(Number.isFinite(parsedPrice) ? parsedPrice : 0, 'vi')}
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
                Đang bán
                <small>Bỏ chọn để tạm ngừng topping này.</small>
              </span>
            </label>
          )}
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={`Xóa topping · ${deleteTarget.name.vi}`}
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
            Topping sẽ bị gỡ khỏi món đang dùng. Có thể khôi phục ở bộ lọc “Chỉ topping đã xóa”.
          </Notice>
        </Modal>
      )}
    </>
  );
}
