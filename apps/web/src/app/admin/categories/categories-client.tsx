'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { MockCategory, MockProduct } from '@/mocks/admin-data';
import { useLocale } from '@/i18n/locale-context';
import { LocalizedInput } from '@/components/ui/localized-input';
import { Pagination } from '@/components/ui/pagination';
import {
  createCategoryWithShiftAction,
  saveCategoryAction,
  toggleCategoryDeleteAction,
} from './actions';

interface CategoriesClientProps {
  initialCategories: MockCategory[];
  products: MockProduct[];
}

export function CategoriesClient({ initialCategories, products }: CategoriesClientProps) {
  const { tx, tText } = useLocale();
  const [categories, setCategories] = useState<MockCategory[]>(initialCategories);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'DELETED' | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [editing, setEditing] = useState<MockCategory | null>(null);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<MockCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  function getFriendlyError(code?: string): string {
    if (!code) return tx('Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.');
    if (code.includes('CATEGORY_NAME_TAKEN')) {
      return tx(
        'Tên danh mục này đã tồn tại trong hệ thống (vui lòng kiểm tra lại cả tiếng Việt và tiếng Anh).',
        'Category name is already taken in Vietnamese or English.',
      );
    }
    if (code.includes('CATEGORY_IN_USE')) {
      return tx('Không thể xóa danh mục đang có sản phẩm liên kết.', 'Cannot delete category with associated products.');
    }
    if (code.includes('CATEGORY_NOT_FOUND')) {
      return tx('Không tìm thấy danh mục.', 'Category not found.');
    }
    if (code.includes('VALIDATION_FAILED')) {
      return tx(
        'Dữ liệu danh mục không hợp lệ. Vui lòng điền đủ tên tiếng Việt, tiếng Anh và thứ tự hợp lệ.',
        'Invalid category data. Please provide Vietnamese & English names and a valid position.',
      );
    }
    return code;
  }

  const isEditingNew = editing ? !categories.some((c) => c.id === editing.id) : false;
  const activeCategories = categories.filter((c) => !c.deletedAt);
  const maxPosition = isEditingNew
    ? activeCategories.length + 1
    : Math.max(1, activeCategories.length);

  const visibleCategories = [...categories]
    .filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchVi = c.name.vi?.toLowerCase().includes(q);
        const matchEn = c.name.en?.toLowerCase().includes(q);
        if (!matchVi && !matchEn) return false;
      }
      if (viewMode === 'ACTIVE') return !c.deletedAt;
      if (viewMode === 'DELETED') return Boolean(c.deletedAt);
      return true;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const pagedCategories = visibleCategories.slice((page - 1) * pageSize, page * pageSize);

  function countActiveProducts(categoryId: string): number {
    return products.filter((p) => p.categoryId === categoryId && !p.deletedAt).length;
  }

  function openCreate() {
    setErrorMsg(null);
    setShowCreateConfirm(false);
    const active = categories.filter((c) => !c.deletedAt);
    const maxPos = active.length + 1;
    setEditing({
      id: `cat-${crypto.randomUUID().slice(0, 8)}`,
      name: { en: '', vi: '' },
      sortOrder: maxPos,
      isActive: true,
      deletedAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  function openEdit(cat: MockCategory) {
    setErrorMsg(null);
    setShowCreateConfirm(false);
    setEditing({ ...cat, name: { ...cat.name } });
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editing || submitting) return;
    setErrorMsg(null);

    const viName = editing.name.vi.trim();
    const enName = editing.name.en.trim();

    if (!viName) {
      setErrorMsg(tx('Vui lòng nhập tên danh mục tiếng Việt.', 'Please enter category name in Vietnamese.'));
      return;
    }
    if (!enName) {
      setErrorMsg(tx('Vui lòng nhập tên danh mục tiếng Anh.', 'Please enter category name in English.'));
      return;
    }

    const pos = Math.max(1, Math.min(maxPosition, Number(editing.sortOrder) || 1));

    if (isEditingNew) {
      // Hiển thị hộp thoại xác nhận trước khi gọi API tạo danh mục
      setShowCreateConfirm(true);
    } else {
      // Chế độ chỉnh sửa: lưu trực tiếp
      void handleSaveEdit({ ...editing, name: { vi: viName, en: enName }, sortOrder: pos });
    }
  }

  async function handleConfirmCreate() {
    if (!editing || submitting) return;
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const active = categories.filter((c) => !c.deletedAt);
      const targetPos = Math.max(1, Math.min(active.length + 1, Number(editing.sortOrder) || (active.length + 1)));

      const res = await createCategoryWithShiftAction(
        {
          name: {
            vi: editing.name.vi.trim(),
            en: editing.name.en.trim(),
          },
          sortOrder: targetPos,
          isActive: editing.isActive,
        },
        active.map((c) => ({ id: c.id, sortOrder: c.sortOrder })),
      );

      if (res.ok && res.data) {
        const { created, shifted } = res.data;
        const shiftMap = new Map(shifted.map((s) => [s.id, s.sortOrder]));
        setCategories((prev) => {
          const updated = prev.map((c) =>
            shiftMap.has(c.id) ? { ...c, sortOrder: shiftMap.get(c.id)! } : c,
          );
          return [...updated, created];
        });
        // Đóng hộp thoại xác nhận và form tạo, không hiển thị toast popup thành công
        setShowCreateConfirm(false);
        setEditing(null);
      } else {
        setShowCreateConfirm(false);
        setErrorMsg(getFriendlyError(res.code));
      }
    } catch {
      setShowCreateConfirm(false);
      setErrorMsg(tx('Lỗi kết nối khi thêm danh mục.', 'Network error while creating category.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit(catToSave: MockCategory) {
    setSubmitting(true);
    try {
      const res = await saveCategoryAction(catToSave, false);
      if (res.ok) {
        const returned = res.data as Partial<MockCategory> | undefined;
        const saved: MockCategory = returned
          ? {
              id: returned.id ?? catToSave.id,
              name: returned.name ?? catToSave.name,
              sortOrder: returned.sortOrder ?? catToSave.sortOrder,
              isActive: returned.isActive ?? catToSave.isActive,
              deletedAt: catToSave.deletedAt,
              createdAt: returned.createdAt ?? catToSave.createdAt,
            }
          : catToSave;

        setCategories((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
        setEditing(null);
      } else {
        setErrorMsg(getFriendlyError(res.code));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handlePromptDelete(cat: MockCategory) {
    setErrorMsg(null);
    const isDeleted = Boolean(cat.deletedAt);
    if (!isDeleted) {
      const activeProds = countActiveProducts(cat.id);
      if (activeProds > 0) {
        setErrorMsg(
          tx(
            `Không thể xóa danh mục "${cat.name.vi}" vì vẫn còn ${activeProds} sản phẩm đang hoạt động thuộc danh mục này.`,
            `Cannot delete category "${cat.name.en}" because it still contains ${activeProds} active products.`,
          ),
        );
        return;
      }
    }
    setConfirmTarget(cat);
  }

  async function handleConfirmToggleDelete() {
    if (!confirmTarget || deleting) return;
    setErrorMsg(null);
    setDeleting(true);
    const isDeleted = Boolean(confirmTarget.deletedAt);
    try {
      const res = await toggleCategoryDeleteAction(confirmTarget.id, isDeleted);
      if (res.ok && res.data) {
        const nextDeletedAt = res.data.deletedAt;
        setCategories((prev) =>
          prev.map((c) => (c.id === confirmTarget.id ? { ...c, deletedAt: nextDeletedAt } : c)),
        );
        setConfirmTarget(null);
      } else {
        setErrorMsg(getFriendlyError(res.code));
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-[#4E311E]">
            {tx('Quản lý Danh mục', 'Categories Management')}
          </h1>
          <p className="text-xs text-[#8C6A50]">
            {tx(
              'Danh mục thực đơn · Thứ tự hiển thị và trạng thái kích hoạt',
              'Menu categories · Display order and active status',
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] transition-colors"
        >
          + {tx('Thêm danh mục', 'New Category')}
        </button>
      </div>

      {/* Ô tìm kiếm danh mục */}
      <div className="relative">
        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl text-[#9B7B60]">
          🔍
        </span>
        <input
          type="text"
          placeholder={tx('Tìm kiếm theo tên danh mục...', 'Search categories...')}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          className="w-full h-12 pl-12 pr-10 rounded-full bg-[#FCF9F2] border-[1.5px] border-[#9B7B60] text-sm text-[#4E311E] placeholder-[#9B7B60] focus:outline-none focus:border-[#4E311E]"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setPage(1);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#9B7B60] hover:text-[#4E311E] transition-colors"
            aria-label={tx('Xóa tìm kiếm', 'Clear search')}
          >
            ✕
          </button>
        )}
      </div>

      {/* Bộ lọc trạng thái */}
      <div className="flex items-center justify-between text-xs px-2">
        <span className="text-[#6E4F3A]">
          {tx('Hiển thị', 'Showing')} <strong>{visibleCategories.length}</strong>{' '}
          {tx('danh mục', 'categories')}
        </span>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'ALL', label: tx('Tất cả', 'All') },
            { key: 'ACTIVE', label: tx('Đang dùng', 'Active') },
            { key: 'DELETED', label: tx('Thùng rác', 'Trash') },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setViewMode(tab.key as typeof viewMode);
                setPage(1);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                viewMode === tab.key
                  ? 'bg-[#4E311E] text-white border-[#4E311E]'
                  : 'bg-[#FCF9F2] text-[#4E311E] border-[#C9B29B] hover:bg-[#F3ECE1]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Thông báo lỗi ở danh sách */}
      {errorMsg && !editing && (
        <div className="rounded-2xl bg-[#B83B2A] text-white p-3 text-xs font-bold flex justify-between items-center shadow-sm">
          <span>⚠️ {errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-white hover:opacity-80 transition-opacity p-1"
            aria-label={tx('Đóng thông báo', 'Dismiss alert')}
          >
            ✕
          </button>
        </div>
      )}

      {/* Danh sách danh mục */}
      <div className="space-y-3">
        {pagedCategories.length === 0 ? (
          <div className="p-8 text-center rounded-[28px] bg-[#FCF9F2] border-[1.5px] border-[#B59478] text-[#8C6A50]">
            {searchQuery
              ? tx('Không tìm thấy danh mục phù hợp.', 'No categories matching search.')
              : tx('Chưa có danh mục nào.', 'No categories available.')}
          </div>
        ) : (
          pagedCategories.map((cat) => {
            const isDeleted = Boolean(cat.deletedAt);
            const activeProds = countActiveProducts(cat.id);

            return (
              <div
                key={cat.id}
                className={`rounded-[24px] bg-[#FCF9F2] border-[1.5px] border-[#B59478] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
                  isDeleted ? 'opacity-65' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-[#4E311E] text-white flex items-center justify-center font-extrabold text-sm shrink-0">
                    #{cat.sortOrder}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-extrabold text-[#4E311E] flex flex-wrap items-center gap-2">
                      <span className="truncate">{cat.name.vi}</span>
                      <span className="text-xs text-[#8C6A50] font-normal">
                        ({cat.name.en})
                      </span>
                      {isDeleted ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#B83B2A] text-white text-[10px] font-bold">
                          {tx('Thùng rác', 'Trash')}
                        </span>
                      ) : !cat.isActive ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#8C6A50] text-white text-[10px] font-bold">
                          {tx('Tạm ẩn', 'Hidden')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-[#1F5C32] text-white text-[10px] font-bold">
                          {tx('Hiển thị', 'Visible')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#6E4F3A] mt-0.5">
                      {tx('Sản phẩm liên kết:', 'Linked products:')}{' '}
                      <strong>{activeProds}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[#C9B29B]">
                  <button
                    type="button"
                    onClick={() => openEdit(cat)}
                    className="px-3.5 py-1.5 rounded-full border border-[#9B7B60] bg-[#FCF9F2] text-xs font-bold text-[#4E311E] hover:bg-[#4E311E] hover:text-white transition-colors"
                  >
                    {tx('Sửa', 'Edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePromptDelete(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold text-white transition-colors ${
                      isDeleted
                        ? 'bg-[#2B5B6C] hover:bg-[#1E414D]'
                        : 'bg-[#B83B2A] hover:bg-[#8F2D1F]'
                    }`}
                  >
                    {isDeleted ? tx('Khôi phục', 'Restore') : tx('Đưa vào thùng rác', 'Move to Trash')}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={visibleCategories.length}
        onPageChange={setPage}
      />

      {/* Modal Thêm / Sửa Danh mục */}
      {editing && (
        <div className="modal modal-open modal-bottom sm:modal-middle z-50">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px] max-w-lg">
            <h3 className="font-bold text-lg text-[#4E311E]">
              {isEditingNew
                ? tx('Thêm danh mục mới', 'New Category')
                : tx('Chỉnh sửa danh mục', 'Edit Category')}
            </h3>

            {errorMsg && (
              <div className="rounded-xl bg-[#B83B2A] text-white p-3 mt-3 text-xs font-bold flex justify-between items-center shadow-sm">
                <span>⚠️ {errorMsg}</span>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="text-white hover:opacity-80 transition-opacity p-1"
                  aria-label={tx('Đóng thông báo', 'Dismiss alert')}
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 mt-4">
              <LocalizedInput
                label={tx('Tên danh mục', 'Category Name')}
                value={editing.name}
                required
                onChange={(val) => setEditing({ ...editing, name: val })}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <fieldset className="fieldset">
                  <legend className="fieldset-legend font-bold">
                    {tx('Thứ tự hiển thị', 'Display Position')} (1 - {maxPosition}) <span className="text-red-500">*</span>
                  </legend>
                  <input
                    type="number"
                    min={1}
                    max={maxPosition}
                    className="input input-bordered w-full bg-[#F3ECE1] font-bold text-[#4E311E]"
                    value={editing.sortOrder}
                    required
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setEditing({
                        ...editing,
                        sortOrder: isNaN(val) ? 1 : Math.max(1, Math.min(maxPosition, val)),
                      });
                    }}
                  />
                </fieldset>

                <label className="label cursor-pointer justify-start gap-3 sm:mt-6">
                  <input
                    type="checkbox"
                    className="toggle toggle-success"
                    checked={editing.isActive}
                    onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                  />
                  <span className="label-text font-bold">
                    {tx('Trạng thái hoạt động', 'Active Status')}
                  </span>
                </label>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  disabled={submitting}
                  className="px-4 py-2 rounded-full border border-[#9B7B60] text-xs font-bold hover:bg-[#F3ECE1] transition-colors"
                  onClick={() => {
                    setEditing(null);
                    setShowCreateConfirm(false);
                  }}
                >
                  {tx('Hủy', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] disabled:opacity-50 transition-colors"
                >
                  {submitting
                    ? '...'
                    : isEditingNew
                      ? tx('Thêm danh mục', 'Add Category')
                      : tx('Lưu thay đổi', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hộp thoại Xác nhận Thêm Danh mục */}
      {showCreateConfirm && editing && (
        <div className="modal modal-open modal-bottom sm:modal-middle z-[60]">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px] max-w-md shadow-2xl">
            <h3 className="font-bold text-lg text-[#4E311E] mb-2">
              {tx('Xác nhận thêm danh mục', 'Confirm Add Category')}
            </h3>
            <p className="text-xs text-[#6E4F3A]">
              {tx(
                'Bạn có chắc chắn muốn thêm danh mục này không?',
                'Are you sure you want to add this category?',
              )}
            </p>

            <div className="mt-3 p-3.5 rounded-2xl bg-[#F3ECE1] border border-[#C9B29B] text-xs space-y-1.5">
              <div>
                <span className="text-[#8C6A50]">{tx('Tên danh mục:', 'Category Name:')}</span>{' '}
                <strong className="text-[#4E311E]">{editing.name.vi} ({editing.name.en})</strong>
              </div>
              <div>
                <span className="text-[#8C6A50]">{tx('Vị trí chèn:', 'Insert Position:')}</span>{' '}
                <strong className="text-[#4E311E]">#{editing.sortOrder}</strong>
              </div>
            </div>

            <div className="modal-action">
              <button
                type="button"
                disabled={submitting}
                className="px-4 py-2 rounded-full border border-[#9B7B60] text-xs font-bold hover:bg-[#F3ECE1] transition-colors"
                onClick={() => setShowCreateConfirm(false)}
              >
                {tx('Hủy', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmCreate}
                className="px-5 py-2 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] disabled:opacity-50 transition-colors"
              >
                {submitting ? '...' : tx('Xác nhận thêm', 'Confirm Add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Đưa vào thùng rác / Khôi phục Danh mục */}
      {confirmTarget && (
        <div className="modal modal-open modal-bottom sm:modal-middle z-50">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px] max-w-md">
            <h3 className="font-bold text-lg text-[#4E311E] mb-2">
              {confirmTarget.deletedAt
                ? tx('Xác nhận khôi phục Danh mục?', 'Confirm restore category?')
                : tx('Xác nhận đưa Danh mục vào thùng rác?', 'Move category to trash?')}
            </h3>
            <p className="text-xs text-[#6E4F3A]">
              {confirmTarget.deletedAt
                ? tx(
                    `Danh mục "${tText(confirmTarget.name)}" sẽ được khôi phục trở lại hệ thống.`,
                    `Category "${tText(confirmTarget.name)}" will be restored.`,
                  )
                : tx(
                    `Danh mục "${tText(confirmTarget.name)}" sẽ được chuyển vào Thùng rác. Bạn có thể khôi phục lại bất kỳ lúc nào.`,
                    `Category "${tText(confirmTarget.name)}" will be moved to trash. You can restore it anytime.`,
                  )}
            </p>
            <div className="modal-action">
              <button
                type="button"
                disabled={deleting}
                className="px-4 py-2 rounded-full border border-[#9B7B60] text-xs font-bold hover:bg-[#F3ECE1] transition-colors"
                onClick={() => setConfirmTarget(null)}
              >
                {tx('Hủy', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmToggleDelete}
                className={`px-5 py-2 rounded-full text-white text-xs font-bold disabled:opacity-50 transition-colors ${
                  confirmTarget.deletedAt
                    ? 'bg-[#2B5B6C] hover:bg-[#1E414D]'
                    : 'bg-[#B83B2A] hover:bg-[#8F2D1F]'
                }`}
              >
                {deleting
                  ? '...'
                  : confirmTarget.deletedAt
                    ? tx('Xác nhận Khôi phục', 'Confirm Restore')
                    : tx('Đưa vào thùng rác', 'Move to Trash')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}