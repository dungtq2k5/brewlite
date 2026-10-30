'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminCategoryResponseDto } from '@brewlite/api-client';
import { Button, ButtonLink } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Modal } from '@/components/vellum/Modal';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { useToast } from '@/components/feedback/ToastProvider';
import { useConsoleCopy } from '@/i18n/console-context';
import type { Locale } from '@/i18n/locale';
import { formatDay, nullableText } from '@/lib/admin-format';
import {
  createCategoryAction,
  deleteCategoryAction,
  restoreCategoryAction,
  updateCategoryAction,
} from '@/lib/admin-actions';
import { runAction, type ActionResult } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';

type Failure = Extract<ActionResult<unknown>, { ok: false }>;

function failureMessage(result: Failure, locale: Locale): string {
  return describeError(result.code, result.details as ApiErrorDetails, locale);
}

function CategoryStatus({ category }: { category: AdminCategoryResponseDto }) {
  const { t } = useConsoleCopy();
  if (nullableText(category.deletedAt)) return <Tag tone="error">{t('Đã xóa', 'Deleted')}</Tag>;
  if (!category.isActive) return <Tag tone="muted">{t('Tạm ẩn', 'Hidden')}</Tag>;
  return <Tag tone="success">{t('Đang dùng', 'Active')}</Tag>;
}

export default function CategoriesClient({
  rows,
  deletedOnly,
}: {
  rows: AdminCategoryResponseDto[];
  deletedOnly: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useConsoleCopy();
  const { showToast } = useToast();
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

  const afterWrite = (message: string) => {
    setCreateOpen(false);
    setEditTarget(null);
    setDeleteTarget(null);
    setError(null);
    showToast(message);
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
    try {
      const result = await runAction(
        createCategoryAction({
          name: { vi: nameVi, en: nameEn },
          sortOrder: parsedSort,
          isActive,
        }),
      );
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      resetForm();
      afterWrite(t('Đã thêm danh mục.', 'Category added.'));
    } finally {
      setBusy(null);
    }
  };

  const submitEdit = async () => {
    if (!editTarget || sortInvalid) return;
    setBusy('edit');
    setError(null);
    try {
      const result = await runAction(
        updateCategoryAction({
          categoryId: editTarget.id,
          name: { vi: nameVi, en: nameEn },
          sortOrder: parsedSort,
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
      const result = await runAction(deleteCategoryAction(deleteTarget.id));
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      afterWrite(t('Đã xóa mềm danh mục.', 'Category soft-deleted.'));
    } finally {
      setBusy(null);
    }
  };

  const restore = async (category: AdminCategoryResponseDto) => {
    setBusy(category.id);
    setError(null);
    try {
      const result = await runAction(restoreCategoryAction(category.id));
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      showToast(t('Đã khôi phục danh mục.', 'Category restored.'));
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHead
        title={t('Danh mục', 'Categories')}
        meta={t(`${rows.length} danh mục`, `${rows.length} categories`)}
        lede={t(
          'Thứ tự hiển thị trên menu, tên hai ngôn ngữ và trạng thái bán. Xóa mềm để ẩn khỏi menu mà vẫn khôi phục được.',
          'Menu order, bilingual names and availability. Soft delete hides a category from the menu while keeping it restorable.',
        )}
        actions={<Button onClick={openCreate}>{t('Thêm danh mục', 'Add category')}</Button>}
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
              {t('Chỉ danh mục đã xóa', 'Deleted categories only')}
              <small>
                {t(
                  'Dùng để khôi phục danh mục đã xóa mềm.',
                  'Use this to restore soft-deleted categories.',
                )}
              </small>
            </span>
          </label>
          <Button type="submit">{t('Lọc', 'Filter')}</Button>
          {deletedOnly && (
            <a className="btn btn--quiet btn--sm" href="/admin/categories">
              {t('Xóa lọc', 'Clear filter')}
            </a>
          )}
        </form>

        {rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState
              title={
                deletedOnly
                  ? t('Không có danh mục đã xóa', 'No deleted categories')
                  : t('Chưa có danh mục', 'No categories yet')
              }
            >
              {deletedOnly
                ? t('Không có danh mục nào bị xóa mềm.', 'No category has been soft-deleted.')
                : t(
                    'Thêm danh mục đầu tiên để bắt đầu xếp menu.',
                    'Add the first category to start building the menu.',
                  )}
            </EmptyState>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack table--ledger">
              <thead>
                <tr>
                  <th className="num">{t('Thứ tự', 'Order')}</th>
                  <th>{t('Danh mục', 'Category')}</th>
                  <th>{t('Trạng thái', 'Status')}</th>
                  <th>{t('Ngày tạo', 'Created')}</th>
                  <th className="cell-actions">{t('Thao tác', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((category) => {
                  const deleted = Boolean(nullableText(category.deletedAt));
                  return (
                    <tr key={category.id}>
                      <td data-label={t('Thứ tự', 'Order')} className="num">
                        {String(category.sortOrder).padStart(2, '0')}
                      </td>
                      <td data-label={t('Danh mục', 'Category')}>
                        <span className="cell-title">{category.name.vi}</span>
                        <span className="cell-meta">{category.name.en}</span>
                      </td>
                      <td data-label={t('Trạng thái', 'Status')}>
                        <CategoryStatus category={category} />
                      </td>
                      <td data-label={t('Ngày tạo', 'Created')}>
                        {formatDay(category.createdAt, locale)}
                      </td>
                      <td className="cell-actions" data-label={t('Thao tác', 'Actions')}>
                        {deleted ? (
                          <Button
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void restore(category)}
                          >
                            {busy === category.id
                              ? t('Đang khôi phục…', 'Restoring…')
                              : t('Khôi phục', 'Restore')}
                          </Button>
                        ) : (
                          <>
                            <ButtonLink
                              href={`/admin/categories/${category.id}`}
                              size="sm"
                              variant="quiet"
                            >
                              {t('Chi tiết', 'Details')}
                            </ButtonLink>
                            <Button
                              size="sm"
                              variant="quiet"
                              disabled={busy !== null}
                              onClick={() => openEdit(category)}
                            >
                              {t('Sửa', 'Edit')}
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
              `${rows.length} danh mục, sắp theo thứ tự hiển thị.`,
              `${rows.length} categories, sorted by display order.`,
            )}
          </span>
        </p>
      </Panel>

      {(createOpen || editTarget) && (
        <Modal
          title={
            editTarget
              ? t(`Sửa danh mục · ${editTarget.name.vi}`, `Edit category · ${editTarget.name.vi}`)
              : t('Thêm danh mục', 'Add category')
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
                  sortInvalid
                }
                onClick={() => void (editTarget ? submitEdit() : submitCreate())}
              >
                {busy
                  ? t('Đang lưu…', 'Saving…')
                  : editTarget
                    ? t('Lưu thay đổi', 'Save changes')
                    : t('Thêm danh mục', 'Add category')}
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
              <label htmlFor="category-vi">{t('Tên tiếng Việt', 'Vietnamese name')}</label>
              <input
                id="category-vi"
                className="input"
                value={nameVi}
                maxLength={60}
                onChange={(event) => setNameVi(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="category-en">{t('Tên tiếng Anh', 'English name')}</label>
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
              <label htmlFor="category-sort">{t('Thứ tự', 'Order')}</label>
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
              <p className="field-hint">
                {t('Số nhỏ đứng trước trên menu.', 'Lower numbers appear first on the menu.')}
              </p>
            </div>
            <label className="check" style={{ alignSelf: 'end' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              <span>
                {t('Đang dùng', 'Active')}
                <small>
                  {t('Bỏ chọn để ẩn khỏi menu khách.', 'Uncheck to hide from the customer menu.')}
                </small>
              </span>
            </label>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={t(
            `Xóa danh mục · ${deleteTarget.name.vi}`,
            `Delete category · ${deleteTarget.name.vi}`,
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
              'Danh mục sẽ bị ẩn khỏi menu. Nếu còn món đang dùng, gateway có thể từ chối thao tác.',
              'The category will be hidden from the menu. If products still use it, the gateway may reject the action.',
            )}
          </Notice>
        </Modal>
      )}
    </>
  );
}
