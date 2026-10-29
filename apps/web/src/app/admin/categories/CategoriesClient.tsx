'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminCategoryResponseDto } from '@brewlite/api-client';
import { Button } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Modal } from '@/components/vellum/Modal';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { formatDay, nullableText } from '@/lib/admin-format';
import {
  createCategoryAction,
  deleteCategoryAction,
  restoreCategoryAction,
  updateCategoryAction,
} from '@/lib/admin-actions';
import type { ActionResult } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';

type Failure = Extract<ActionResult<unknown>, { ok: false }>;

function failureMessage(result: Failure): string {
  return describeError(result.code, result.details as ApiErrorDetails, 'vi');
}

function CategoryStatus({ category }: { category: AdminCategoryResponseDto }) {
  if (nullableText(category.deletedAt)) return <Tag tone="error">Đã xóa</Tag>;
  if (!category.isActive) return <Tag tone="muted">Tạm ẩn</Tag>;
  return <Tag tone="success">Đang dùng</Tag>;
}

export default function CategoriesClient({
  rows,
  deletedOnly,
}: {
  rows: AdminCategoryResponseDto[];
  deletedOnly: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminCategoryResponseDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategoryResponseDto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameVi, setNameVi] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

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
    setSortOrder('0');
    setIsActive(true);
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (category: AdminCategoryResponseDto) => {
    setNameVi(category.name.vi);
    setNameEn(category.name.en);
    setSortOrder(String(category.sortOrder));
    setIsActive(category.isActive);
    setError(null);
    setEditTarget(category);
  };

  const afterWrite = () => {
    setCreateOpen(false);
    setEditTarget(null);
    setDeleteTarget(null);
    setError(null);
    router.refresh();
  };

  const parsedSort = sortOrder.trim() === '' ? undefined : Number(sortOrder);
  const sortInvalid =
    parsedSort !== undefined &&
    (!Number.isInteger(parsedSort) || parsedSort < 0 || parsedSort > 32767);

  const submitCreate = async () => {
    if (sortInvalid) return;
    setBusy('create');
    setError(null);
    const result = await createCategoryAction({
      name: { vi: nameVi, en: nameEn },
      sortOrder: parsedSort,
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
    if (!editTarget || sortInvalid) return;
    setBusy('edit');
    setError(null);
    const result = await updateCategoryAction({
      categoryId: editTarget.id,
      name: { vi: nameVi, en: nameEn },
      sortOrder: parsedSort,
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
    const result = await deleteCategoryAction(deleteTarget.id);
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    afterWrite();
  };

  const restore = async (category: AdminCategoryResponseDto) => {
    setBusy(category.id);
    setError(null);
    const result = await restoreCategoryAction(category.id);
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
        title="Danh mục"
        meta={`${rows.length} danh mục`}
        lede="Thứ tự hiển thị trên menu, tên hai ngôn ngữ và trạng thái bán. Xóa mềm để ẩn khỏi menu mà vẫn khôi phục được."
        actions={<Button onClick={openCreate}>Thêm danh mục</Button>}
      />

      {error && !createOpen && !editTarget && !deleteTarget && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      <Panel>
        <form className="toolbar" action="/admin/categories" method="get">
          <label className="check" style={{ flex: 'none' }}>
            <input type="checkbox" name="deleted" value="1" defaultChecked={deletedOnly} />
            <span>
              Chỉ danh mục đã xóa
              <small>Dùng để khôi phục danh mục đã xóa mềm.</small>
            </span>
          </label>
          <Button type="submit">Lọc</Button>
          {deletedOnly && (
            <a className="btn btn--quiet btn--sm" href="/admin/categories">
              Xóa lọc
            </a>
          )}
        </form>

        {rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState title={deletedOnly ? 'Không có danh mục đã xóa' : 'Chưa có danh mục'}>
              {deletedOnly
                ? 'Không có danh mục nào bị xóa mềm.'
                : 'Thêm danh mục đầu tiên để bắt đầu xếp menu.'}
            </EmptyState>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack table--ledger">
              <thead>
                <tr>
                  <th className="num">Thứ tự</th>
                  <th>Danh mục</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th className="cell-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((category) => {
                  const deleted = Boolean(nullableText(category.deletedAt));
                  return (
                    <tr key={category.id}>
                      <td data-label="Thứ tự" className="num">
                        {String(category.sortOrder).padStart(2, '0')}
                      </td>
                      <td data-label="Danh mục">
                        <span className="cell-title">{category.name.vi}</span>
                        <span className="cell-meta">{category.name.en}</span>
                      </td>
                      <td data-label="Trạng thái">
                        <CategoryStatus category={category} />
                      </td>
                      <td data-label="Ngày tạo">{formatDay(category.createdAt)}</td>
                      <td className="cell-actions" data-label="Thao tác">
                        {deleted ? (
                          <Button
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void restore(category)}
                          >
                            {busy === category.id ? 'Đang khôi phục…' : 'Khôi phục'}
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="quiet"
                              disabled={busy !== null}
                              onClick={() => openEdit(category)}
                            >
                              Sửa
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy !== null}
                              onClick={() => {
                                setError(null);
                                setDeleteTarget(category);
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
          <span>{rows.length} danh mục, sắp theo thứ tự hiển thị.</span>
        </p>
      </Panel>

      {(createOpen || editTarget) && (
        <Modal
          title={editTarget ? `Sửa danh mục · ${editTarget.name.vi}` : 'Thêm danh mục'}
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
                  sortInvalid
                }
                onClick={() => void (editTarget ? submitEdit() : submitCreate())}
              >
                {busy ? 'Đang lưu…' : editTarget ? 'Lưu thay đổi' : 'Thêm danh mục'}
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
              <label htmlFor="category-vi">Tên tiếng Việt</label>
              <input
                id="category-vi"
                className="input"
                value={nameVi}
                maxLength={60}
                onChange={(event) => setNameVi(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="category-en">Tên tiếng Anh</label>
              <input
                id="category-en"
                className="input"
                value={nameEn}
                maxLength={60}
                onChange={(event) => setNameEn(event.target.value)}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="category-sort">Thứ tự</label>
              <input
                id="category-sort"
                className="input"
                type="number"
                min={0}
                max={32767}
                step={1}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
              <p className="field-hint">Số nhỏ đứng trước trên menu.</p>
            </div>
            <label className="check" style={{ alignSelf: 'end' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              <span>
                Đang dùng
                <small>Bỏ chọn để ẩn khỏi menu khách.</small>
              </span>
            </label>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={`Xóa danh mục · ${deleteTarget.name.vi}`}
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
            Danh mục sẽ bị ẩn khỏi menu. Nếu còn món đang dùng, gateway có thể từ chối thao tác.
          </Notice>
        </Modal>
      )}
    </>
  );
}
