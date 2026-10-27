'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { MockTopping } from '@/mocks/admin-data';
import { useLocale } from '@/i18n/locale-context';
import { createToppingSchema, updateToppingSchema } from '@/lib/zod-schemas';
import { LocalizedInput } from '@/components/ui/localized-input';
import { Pagination } from '@/components/ui/pagination';
import { saveToppingAction, toggleToppingDeleteAction } from './actions';

export function ToppingsClient({ initialToppings }: { initialToppings: MockTopping[] }) {
  const { tx, tText, money } = useLocale();
  const [toppings, setToppings] = useState<MockTopping[]>(initialToppings);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'DELETED' | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [editing, setEditing] = useState<MockTopping | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<MockTopping | null>(null);
  const [deleting, setDeleting] = useState(false);

  function getFriendlyError(code?: string): string {
    if (!code) return tx('Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.');
    if (code.includes('TOPPING_NAME_TAKEN')) {
      return tx('Tên topping đã tồn tại trong hệ thống.', 'Topping name is already taken.');
    }
    if (code.includes('TOPPING_NOT_FOUND')) {
      return tx('Không tìm thấy topping.', 'Topping not found.');
    }
    if (code.includes('TOPPING_IN_USE')) {
      return tx('Không thể xóa topping đang có sản phẩm liên kết.', 'Cannot delete topping linked to products.');
    }
    return code;
  }

  const visibleToppings = toppings.filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchVi = t.name.vi?.toLowerCase().includes(q);
      const matchEn = t.name.en?.toLowerCase().includes(q);
      if (!matchVi && !matchEn) return false;
    }
    if (viewMode === 'ACTIVE') return !t.deletedAt;
    if (viewMode === 'DELETED') return Boolean(t.deletedAt);
    return true;
  });

  const pagedToppings = visibleToppings.slice((page - 1) * pageSize, page * pageSize);

  function openCreate() {
    setErrorMsg(null);
    setEditing({
      id: `top-${crypto.randomUUID().slice(0, 8)}`,
      name: { en: '', vi: '' },
      priceVnd: 10000,
      isAvailable: true,
      deletedAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editing || submitting) return;
    setErrorMsg(null);

    const isNew = !toppings.some((t) => t.id === editing.id);
    const parsed = isNew
      ? createToppingSchema.safeParse({ name: editing.name, priceVnd: editing.priceVnd })
      : updateToppingSchema.safeParse({
          name: editing.name,
          priceVnd: editing.priceVnd,
          isAvailable: editing.isAvailable,
        });

    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? tx('Dữ liệu Topping không hợp lệ', 'Invalid topping data'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await saveToppingAction(editing, isNew);
      if (res.ok) {
        const returned = res.data as Partial<MockTopping> | undefined;
        const saved: MockTopping = returned
          ? {
              id: returned.id ?? editing.id,
              name: returned.name ?? editing.name,
              priceVnd: returned.priceVnd ?? editing.priceVnd,
              isAvailable: returned.isAvailable ?? editing.isAvailable,
              deletedAt: null,
              createdAt: returned.createdAt ?? editing.createdAt,
            }
          : editing;
        setToppings((prev) => {
          const exists = prev.some((t) => t.id === saved.id);
          return exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved];
        });
        setEditing(null);
      } else {
        setErrorMsg(getFriendlyError(res.code));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmToggleDelete() {
    if (!confirmTarget || deleting) return;
    setErrorMsg(null);
    setDeleting(true);
    const shouldRestore = Boolean(confirmTarget.deletedAt);
    try {
      const res = await toggleToppingDeleteAction(confirmTarget.id, shouldRestore);
      if (res.ok) {
        setToppings((prev) =>
          prev.map((t) =>
            t.id === confirmTarget.id
              ? { ...t, deletedAt: shouldRestore ? null : new Date().toISOString() }
              : t,
          ),
        );
        setConfirmTarget(null);
      } else {
        setErrorMsg(getFriendlyError(res.code));
      }
    } finally {
      setDeleting(false);
    }
  }

  const isEditingNew = editing ? !toppings.some((t) => t.id === editing.id) : false;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-[#4E311E]">
            {tx('Quản lý Topping', 'Toppings Management')}
          </h1>
          <p className="text-xs text-[#8C6A50]">
            {tx(
              'Danh sách món thêm · Bật/tắt mở bán và quản lý giá',
              'Toppings list · Toggle availability and manage prices',
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] transition-colors"
        >
          + {tx('Thêm Topping', 'New Topping')}
        </button>
      </div>

      {/* Ô tìm kiếm Topping */}
      <div className="relative">
        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl text-[#9B7B60]">
          🔍
        </span>
        <input
          type="text"
          placeholder={tx('Tìm kiếm theo tên Topping...', 'Search toppings...')}
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
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#9B7B60] hover:text-[#4E311E]"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'ALL', label: tx('Tất cả', 'All') },
          { key: 'ACTIVE', label: tx('Đang dùng', 'Active') },
          { key: 'DELETED', label: tx('Thùng rác', 'Trash') },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setViewMode(item.key as typeof viewMode);
              setPage(1);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              viewMode === item.key
                ? 'bg-[#4E311E] text-white border-[#4E311E]'
                : 'bg-[#FCF9F2] text-[#4E311E] border-[#C9B29B]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="rounded-2xl bg-[#B83B2A] text-white px-4 py-2.5 text-xs font-bold">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="rounded-[28px] bg-[#FCF9F2] border-[1.5px] border-[#B59478] p-3.5 sm:p-6 space-y-3">
        {visibleToppings.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <div className="text-3xl">🍮</div>
            <p className="text-xs font-bold text-[#8C6A50]">
              {tx('Không có topping nào trong mục này.', 'No toppings found in this view.')}
            </p>
          </div>
        ) : (
          pagedToppings.map((top) => (
            <div
              key={top.id}
              className={`rounded-[24px] bg-[#F3ECE1] border border-[#9B7B60] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                top.deletedAt ? 'opacity-60' : ''
              }`}
            >
              <div>
                <div className="font-extrabold text-base text-[#4E311E] flex flex-wrap items-center gap-2">
                  <span>{tText(top.name)}</span>
                  <span className="text-sm font-extrabold text-[#B83B2A]">
                    +{money(top.priceVnd)}
                  </span>
                  {top.deletedAt ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#B83B2A] text-white text-[10px] font-bold">
                      {tx('Thùng rác', 'In Trash')}
                    </span>
                  ) : top.isAvailable ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#1F5C32] text-white text-[10px] font-bold">
                      {tx('Đang mở bán', 'Available')}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#A85D00] text-white text-[10px] font-bold">
                      {tx('Tạm hết', 'Sold Out')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#6E4F3A] mt-0.5">
                  VI: {top.name.vi} · EN: {top.name.en}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[#C9B29B]">
                <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer mr-2">
                  <input
                    type="checkbox"
                    className="toggle toggle-success toggle-sm"
                    checked={top.isAvailable}
                    disabled={Boolean(top.deletedAt)}
                    onChange={async (e) => {
                      const nextAvailable = e.target.checked;
                      const prevAvailable = top.isAvailable;
                      const updated = { ...top, isAvailable: nextAvailable };
                      setToppings((prev) =>
                        prev.map((t) => (t.id === top.id ? updated : t)),
                      );
                      const res = await saveToppingAction(updated, false);
                      if (!res.ok) {
                        setToppings((prev) =>
                          prev.map((t) => (t.id === top.id ? { ...t, isAvailable: prevAvailable } : t)),
                        );
                        setErrorMsg(getFriendlyError(res.code));
                      }
                    }}
                  />
                  <span>{tx('Mở bán', 'Available')}</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setEditing({ ...top, name: { ...top.name } });
                  }}
                  className="px-3.5 py-1 rounded-full border border-[#9B7B60] bg-[#FCF9F2] text-xs font-bold hover:bg-[#4E311E] hover:text-white transition-colors"
                >
                  {tx('Sửa', 'Edit')}
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmTarget(top)}
                  className={`px-3.5 py-1 rounded-full text-xs font-bold text-white transition-colors ${
                    top.deletedAt ? 'bg-[#2B5B6C] hover:bg-[#1E414D]' : 'bg-[#B83B2A] hover:bg-[#8F2D1F]'
                  }`}
                >
                  {top.deletedAt ? tx('Khôi phục', 'Restore') : tx('Đưa vào thùng rác', 'Move to Trash')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={visibleToppings.length}
        onPageChange={setPage}
      />

      {/* Modal Thêm / Sửa Topping */}
      {editing && (
        <div className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px] max-w-xl">
            <h3 className="font-bold text-lg text-[#4E311E] mb-4">
              {!isEditingNew
                ? tx('Chỉnh sửa Topping', 'Edit Topping')
                : tx('Thêm Topping mới', 'New Topping')}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <LocalizedInput
                label={tx('Tên Topping', 'Topping Name')}
                value={editing.name}
                onChange={(name) => setEditing({ ...editing, name })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <fieldset className="fieldset">
                  <legend className="fieldset-legend font-bold">
                    {tx('Giá Topping (VNĐ)', 'Price (VND)')}
                  </legend>
                  <input
                    type="number"
                    step={1000}
                    min={0}
                    max={10000000}
                    className="input input-bordered w-full bg-[#F3ECE1]"
                    value={editing.priceVnd}
                    required
                    onChange={(e) =>
                      setEditing({ ...editing, priceVnd: Number(e.target.value) })
                    }
                  />
                </fieldset>
                {!isEditingNew ? (
                  <label className="label cursor-pointer justify-start gap-3 sm:mt-6">
                    <input
                      type="checkbox"
                      className="toggle toggle-success"
                      checked={editing.isAvailable}
                      onChange={(e) => setEditing({ ...editing, isAvailable: e.target.checked })}
                    />
                    <span className="label-text font-bold">
                      {tx('Đang mở bán', 'Available')}
                    </span>
                  </label>
                ) : (
                  <div className="text-xs text-[#8C6A50] sm:mt-6 flex items-center gap-1.5 font-medium">
                    <span>ℹ️</span>
                    <span>{tx('Topping mới mặc định sẽ được mở bán ngay sau khi tạo.', 'New topping will be set to available by default.')}</span>
                  </div>
                )}
              </div>
              <div className="modal-action">
                <button
                  type="button"
                  disabled={submitting}
                  className="px-4 py-2 rounded-full border border-[#9B7B60] text-xs font-bold hover:bg-[#F3ECE1]"
                  onClick={() => setEditing(null)}
                >
                  {tx('Hủy', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] disabled:opacity-50"
                >
                  {submitting ? '...' : tx('Lưu thay đổi', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Đưa vào thùng rác / Khôi phục */}
      {confirmTarget && (
        <div className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px] max-w-md">
            <h3 className="font-bold text-lg text-[#4E311E] mb-2">
              {confirmTarget.deletedAt
                ? tx('Xác nhận khôi phục Topping?', 'Confirm restore topping?')
                : tx('Xác nhận đưa Topping vào thùng rác?', 'Move topping to trash?')}
            </h3>
            <p className="text-xs text-[#6E4F3A]">
              {confirmTarget.deletedAt
                ? tx(
                    `Topping "${tText(confirmTarget.name)}" sẽ được khôi phục và hiển thị lại trong thực đơn.`,
                    `Topping "${tText(confirmTarget.name)}" will be restored to the menu.`,
                  )
                : tx(
                    `Topping "${tText(confirmTarget.name)}" sẽ được ngừng áp dụng và chuyển vào mục Thùng rác. Bạn có thể khôi phục bất cứ lúc nào.`,
                    `Topping "${tText(confirmTarget.name)}" will be archived to trash. You can restore it anytime.`,
                  )}
            </p>
            <div className="modal-action">
              <button
                type="button"
                disabled={deleting}
                className="px-4 py-2 rounded-full border border-[#9B7B60] text-xs font-bold"
                onClick={() => setConfirmTarget(null)}
              >
                {tx('Hủy', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmToggleDelete}
                className={`px-5 py-2 rounded-full text-white text-xs font-bold disabled:opacity-50 ${
                  confirmTarget.deletedAt ? 'bg-[#2B5B6C]' : 'bg-[#B83B2A]'
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