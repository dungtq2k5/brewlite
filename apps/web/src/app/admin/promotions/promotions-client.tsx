'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { DiscountType, MockPromotion } from '@/mocks/admin-data';
import { useLocale } from '@/i18n/locale-context';
import { createPromotionSchema, updatePromotionSchema } from '@/lib/zod-schemas';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import {
  savePromotionAction,
  togglePromotionActiveAction,
  togglePromotionDeleteAction,
} from './actions';

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function PromotionsClient({ initialPromotions }: { initialPromotions: MockPromotion[] }) {
  const { tx, money, dateTime } = useLocale();
  const [promotions, setPromotions] = useState<MockPromotion[]>(initialPromotions);
  const [searchCode, setSearchCode] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [deletedFilter, setDeletedFilter] = useState<'ALL' | 'ACTIVE' | 'DELETED'>('ALL');
  const [sortBy, setSortBy] = useState<'createdAt_desc' | 'code_asc'>('createdAt_desc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);

  const [editing, setEditing] = useState<MockPromotion | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [detailPromo, setDetailPromo] = useState<MockPromotion | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<MockPromotion | null>(null);
  const [deleting, setDeleting] = useState(false);

  function toDateTimeLocalInput(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function getFriendlyError(code?: string, details?: unknown): string {
    if (
      details &&
      typeof details === 'object' &&
      'issues' in details &&
      Array.isArray((details as { issues: Array<{ path?: string; code?: string; message?: string }> }).issues)
    ) {
      const issues = (details as { issues: Array<{ path?: string; code?: string; message?: string }> }).issues;
      const invalidPaths = issues.map((i) => i.path).filter(Boolean).join(', ');
      if (invalidPaths.includes('discountValue')) {
        return tx(
          'Giá trị giảm giá không hợp lệ (phần trăm từ 1% - 100%, số tiền từ 1 VNĐ đến 10 triệu VNĐ).',
          'Invalid discount value (1-100% or 1 to 10M VND).',
        );
      }
      if (invalidPaths.includes('maxDiscountVnd')) {
        return tx(
          'Mức giảm tối đa không áp dụng cho loại giảm số tiền cố định.',
          'Max discount is not applicable for fixed discounts.',
        );
      }
      if (invalidPaths.includes('endsAt')) {
        return tx(
          'Thời gian kết thúc phải diễn ra sau thời gian bắt đầu.',
          'End date must be after start date.',
        );
      }
      if (invalidPaths.includes('description')) {
        return tx(
          'Mô tả khuyến mãi không hợp lệ (tối đa 200 ký tự).',
          'Invalid description (max 200 chars).',
        );
      }
      if (invalidPaths.includes('code')) {
        return tx(
          'Mã khuyến mãi không hợp lệ (chỉ gồm chữ hoa và số, từ 3 đến 32 ký tự).',
          'Invalid promo code (uppercase alphanumeric, 3-32 chars).',
        );
      }
    }

    if (!code) return tx('Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.');
    if (code.includes('PROMO_CODE_TAKEN')) {
      return tx('Mã khuyến mãi này đã tồn tại trong hệ thống.', 'Promotion code is already taken.');
    }
    if (code.includes('PROMO_MAX_USES_BELOW_USED')) {
      return tx(
        'Số lượt dùng tối đa không được nhỏ hơn số lượt đã sử dụng thực tế.',
        'Max uses cannot be less than times already used.',
      );
    }
    if (code.includes('PROMO_NOT_FOUND') || code.includes('RESOURCE_NOT_FOUND')) {
      return tx('Không tìm thấy khuyến mãi.', 'Promotion not found.');
    }
    if (code.includes('INVALID_STATE')) {
      return tx(
        'Thao tác không hợp lệ với trạng thái hiện tại của khuyến mãi (có thể khuyến mãi đã được xóa hoặc khôi phục trước đó).',
        'Invalid operation for current promotion state (it may have already been deleted or restored).',
      );
    }
    if (code.includes('PROMO_CANNOT_CHANGE_CODE')) {
      return tx('Không thể sửa mã khuyến mãi sau khi đã tạo.', 'Cannot change code of existing promotion.');
    }
    if (code.includes('PROMO_CANNOT_CHANGE_DISCOUNT')) {
      return tx(
        'Không thể sửa loại giảm giá của khuyến mãi đã tạo.',
        'Cannot change discount type of existing promotion.',
      );
    }
    if (code.includes('PROMO_CANNOT_CHANGE_MIN_SUBTOTAL')) {
      return tx(
        'Không thể sửa đơn tối thiểu của khuyến mãi đã tạo.',
        'Cannot change min subtotal of existing promotion.',
      );
    }
    if (code.includes('PROMO_ENDS_BEFORE_STARTS')) {
      return tx('Thời gian kết thúc phải diễn ra sau thời gian bắt đầu.', 'End date must be after start date.');
    }
    if (code.includes('VALIDATION_FAILED')) {
      return tx(
        'Dữ liệu không đúng quy định của hệ thống. Vui lòng kiểm tra lại các trường trong biểu mẫu.',
        'Validation failed. Please verify form fields.',
      );
    }
    return code;
  }

  const filtered = promotions
    .filter((p) => {
      const matchCode = p.code.toLowerCase().includes(searchCode.toLowerCase());
      const matchActive =
        activeFilter === 'ALL' || (activeFilter === 'ACTIVE' ? p.isActive : !p.isActive);
      const matchDel =
        deletedFilter === 'ALL' ||
        (deletedFilter === 'DELETED' ? Boolean(p.deletedAt) : !p.deletedAt);
      return matchCode && matchActive && matchDel;
    })
    .sort((a, b) => {
      if (sortBy === 'code_asc') return compareStrings(a.code, b.code);
      return compareStrings(b.createdAt, a.createdAt);
    });

  const pagedPromotions = filtered.slice((page - 1) * pageSize, page * pageSize);

  function openCreate() {
    setIsEditMode(false);
    setFormError(null);
    setSuccessMsg(null);
    setErrorMsg(null);
    const now = new Date();
    const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    setEditing({
      id: `promo-${crypto.randomUUID().slice(0, 8)}`,
      code: '',
      description: '',
      discountType: 'FIXED',
      discountValue: 20000,
      maxDiscountVnd: null,
      minSubtotalVnd: 50000,
      startsAt: toDateTimeLocalInput(now),
      endsAt: toDateTimeLocalInput(oneMonthLater),
      maxUses: null,
      perUserLimit: 1,
      usedCount: 0,
      isActive: true,
      createdAt: now.toISOString(),
      deletedAt: null,
    });
  }

  function openEdit(promo: MockPromotion) {
    if (promo.deletedAt) {
      setErrorMsg(
        tx(
          'Không thể chỉnh sửa khuyến mãi đang trong thùng rác. Vui lòng khôi phục trước khi sửa.',
          'Cannot edit promotion in trash. Please restore it first.',
        ),
      );
      return;
    }
    setIsEditMode(true);
    setFormError(null);
    setSuccessMsg(null);
    setErrorMsg(null);
    const toLocal = (iso: string) => {
      try {
        const d = new Date(iso);
        return isNaN(d.getTime()) ? iso.slice(0, 16) : toDateTimeLocalInput(d);
      } catch {
        return iso.slice(0, 16);
      }
    };
    setEditing({
      ...promo,
      startsAt: toLocal(promo.startsAt),
      endsAt: toLocal(promo.endsAt),
    });
  }

  async function handleToggleActive(promo: MockPromotion) {
    if (promo.deletedAt) {
      setErrorMsg(
        tx(
          'Không thể bật/tắt khuyến mãi trong thùng rác. Vui lòng khôi phục trước.',
          'Cannot toggle status of promotion in trash. Please restore it first.',
        ),
      );
      return;
    }
    setErrorMsg(null);
    const nextActive = !promo.isActive;
    const res = await togglePromotionActiveAction(promo.id, nextActive);
    if (res.ok) {
      setPromotions((prev) =>
        prev.map((p) => (p.id === promo.id ? { ...p, isActive: nextActive } : p)),
      );
      setSuccessMsg(
        nextActive
          ? tx(`Đã kích hoạt mã "${promo.code}".`, `Activated promo code "${promo.code}".`)
          : tx(`Đã tạm tắt mã "${promo.code}".`, `Deactivated promo code "${promo.code}".`),
      );
    } else {
      setErrorMsg(getFriendlyError(res.code, res.details));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editing || submitting) return;
    setFormError(null);
    setSuccessMsg(null);

    if (!editing.startsAt || isNaN(new Date(editing.startsAt).getTime())) {
      setFormError(tx('Vui lòng chọn thời gian bắt đầu hợp lệ.', 'Please select a valid start date.'));
      return;
    }
    if (!editing.endsAt || isNaN(new Date(editing.endsAt).getTime())) {
      setFormError(tx('Vui lòng chọn thời gian kết thúc hợp lệ.', 'Please select a valid end date.'));
      return;
    }

    const startsDate = new Date(editing.startsAt);
    const endsDate = new Date(editing.endsAt);

    if (endsDate.getTime() <= startsDate.getTime()) {
      setFormError(tx('Thời gian kết thúc phải diễn ra sau thời gian bắt đầu.', 'End date must be after start date.'));
      return;
    }

    const startsIso = startsDate.toISOString();
    const endsIso = endsDate.toISOString();
    const cleanDesc = editing.description?.trim() || undefined;

    if (isEditMode) {
      const check = updatePromotionSchema.safeParse({
        description: cleanDesc,
        clearDescription: !cleanDesc,
        endsAt: endsIso,
        maxUses: editing.maxUses && editing.maxUses > 0 ? editing.maxUses : null,
        perUserLimit: editing.perUserLimit && editing.perUserLimit > 0 ? editing.perUserLimit : null,
        isActive: editing.isActive,
      });
      if (!check.success) {
        setFormError(check.error.issues[0]?.message ?? tx('Dữ liệu cập nhật không hợp lệ', 'Invalid data'));
        return;
      }
    } else {
      const check = createPromotionSchema.safeParse({
        code: editing.code.trim().toUpperCase(),
        description: cleanDesc,
        discountType: editing.discountType,
        discountValue: Number(editing.discountValue),
        maxDiscountVnd:
          editing.discountType === 'PERCENT'
            ? editing.maxDiscountVnd && editing.maxDiscountVnd > 0
              ? Number(editing.maxDiscountVnd)
              : null
            : null,
        minSubtotalVnd:
          editing.minSubtotalVnd != null && Number(editing.minSubtotalVnd) >= 0
            ? Number(editing.minSubtotalVnd)
            : 0,
        startsAt: startsIso,
        endsAt: endsIso,
        maxUses: editing.maxUses && editing.maxUses > 0 ? Number(editing.maxUses) : null,
        perUserLimit:
          editing.perUserLimit && editing.perUserLimit > 0 ? Number(editing.perUserLimit) : null,
        isActive: editing.isActive,
      });
      if (!check.success) {
        setFormError(check.error.issues[0]?.message ?? tx('Dữ liệu tạo mới không hợp lệ', 'Invalid data'));
        return;
      }
    }

    setSubmitting(true);
    try {
      const normalized: MockPromotion = {
        ...editing,
        code: editing.code.trim().toUpperCase(),
        description: cleanDesc || null,
        discountValue: Number(editing.discountValue),
        maxDiscountVnd:
          editing.discountType === 'PERCENT'
            ? editing.maxDiscountVnd && editing.maxDiscountVnd > 0
              ? Number(editing.maxDiscountVnd)
              : null
            : null,
        minSubtotalVnd:
          editing.minSubtotalVnd != null && Number(editing.minSubtotalVnd) >= 0
            ? Number(editing.minSubtotalVnd)
            : 0,
        startsAt: startsIso,
        endsAt: endsIso,
        maxUses: editing.maxUses && editing.maxUses > 0 ? Number(editing.maxUses) : null,
        perUserLimit:
          editing.perUserLimit && editing.perUserLimit > 0 ? Number(editing.perUserLimit) : null,
      };
      const res = await savePromotionAction(normalized, isEditMode);
      if (res.ok) {
        const returned = res.data as Partial<MockPromotion> | undefined;
        const saved: MockPromotion = returned
          ? {
              id: returned.id ?? normalized.id,
              code: returned.code ?? normalized.code,
              description: returned.description !== undefined ? returned.description : normalized.description,
              discountType: returned.discountType ?? normalized.discountType,
              discountValue: returned.discountValue ?? normalized.discountValue,
              maxDiscountVnd: returned.maxDiscountVnd !== undefined ? returned.maxDiscountVnd : normalized.maxDiscountVnd,
              minSubtotalVnd: returned.minSubtotalVnd ?? normalized.minSubtotalVnd,
              startsAt: returned.startsAt ?? normalized.startsAt,
              endsAt: returned.endsAt ?? normalized.endsAt,
              maxUses: returned.maxUses !== undefined ? returned.maxUses : normalized.maxUses,
              perUserLimit: returned.perUserLimit !== undefined ? returned.perUserLimit : normalized.perUserLimit,
              usedCount: returned.usedCount ?? normalized.usedCount,
              isActive: returned.isActive !== undefined ? returned.isActive : normalized.isActive,
              createdAt: returned.createdAt ?? normalized.createdAt,
              deletedAt: null,
            }
          : normalized;
        setPromotions((prev) => {
          const exists = prev.some((p) => p.id === saved.id);
          return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
        });
        setSuccessMsg(
          isEditMode
            ? tx(`Cập nhật mã khuyến mãi "${saved.code}" thành công!`, `Updated promo code "${saved.code}" successfully!`)
            : tx(`Tạo mã khuyến mãi "${saved.code}" thành công!`, `Created promo code "${saved.code}" successfully!`),
        );
        setEditing(null);
      } else {
        setFormError(getFriendlyError(res.code, res.details));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmToggleDelete() {
    if (!confirmTarget || deleting) return;
    setDeleting(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    const shouldRestore = Boolean(confirmTarget.deletedAt);
    try {
      const res = await togglePromotionDeleteAction(confirmTarget.id, shouldRestore);
      if (res.ok) {
        setPromotions((prev) =>
          prev.map((p) =>
            p.id === confirmTarget.id
              ? { ...p, deletedAt: shouldRestore ? null : new Date().toISOString() }
              : p,
          ),
        );
        setSuccessMsg(
          shouldRestore
            ? tx(`Đã khôi phục mã khuyến mãi "${confirmTarget.code}".`, `Restored promo code "${confirmTarget.code}".`)
            : tx(`Đã chuyển mã khuyến mãi "${confirmTarget.code}" vào thùng rác.`, `Moved promo code "${confirmTarget.code}" to trash.`),
        );
        setConfirmTarget(null);
      } else {
        const err = getFriendlyError(res.code, res.details);
        setErrorMsg(err);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Ô tìm kiếm khuyến mãi */}
      <div className="relative">
        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl text-[#9B7B60]">
          🔍
        </span>
        <input
          type="text"
          placeholder={tx('Tìm theo mã khuyến mãi (VD: BREW20)...', 'Search promo code (e.g. BREW20)...')}
          value={searchCode}
          onChange={(e) => {
            setSearchCode(e.target.value);
            setPage(1);
          }}
          className="w-full h-13 pl-13 pr-36 rounded-full bg-[#FCF9F2] border-[1.5px] border-[#9B7B60] text-base text-[#4E311E] uppercase font-mono placeholder:normal-case placeholder:font-sans placeholder-[#9B7B60] focus:outline-none focus:border-[#4E311E]"
        />
        {searchCode && (
          <button
            type="button"
            onClick={() => {
              setSearchCode('');
              setPage(1);
            }}
            className="absolute right-36 top-1/2 -translate-y-1/2 text-xs text-[#9B7B60] hover:text-[#4E311E] transition-colors p-1"
            aria-label={tx('Xóa tìm kiếm', 'Clear search')}
          >
            ✕
          </button>
        )}
        <button
          type="button"
          onClick={openCreate}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] transition-colors shadow-sm"
        >
          + {tx('Tạo mã', 'New Code')}
        </button>
      </div>

      {/* Thông báo thành công */}
      {successMsg && (
        <div className="rounded-2xl bg-[#1E3329] text-[#F5EFE6] border border-[#2E5A44] p-3 text-sm font-bold flex items-center justify-between shadow-sm">
          <span>✅ {successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-xs px-2 py-0.5 rounded-full bg-[#F5EFE6]/20 hover:bg-[#F5EFE6]/30 text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Thông báo lỗi */}
      {errorMsg && (
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

      {/* Thanh tab lọc và công cụ */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'ALL', label: tx('Tất cả', 'All') },
            { key: 'ACTIVE', label: tx('Đang dùng', 'Active') },
            { key: 'DELETED', label: tx('Thùng rác', 'Trash') },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setDeletedFilter(tab.key as typeof deletedFilter);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                deletedFilter === tab.key
                  ? 'bg-[#4E311E] text-white border-[#4E311E]'
                  : 'bg-[#FCF9F2] text-[#4E311E] border-[#C9B29B] hover:bg-[#F3ECE1]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#6E4F3A] hover:text-[#4E311E]"
        >
          <span>{tx('Bộ lọc', 'Filters')}</span>
          <span className="text-lg leading-none">☰</span>
        </button>
      </div>

      {showFilters && (
        <div className="rounded-3xl bg-[#FCF9F2] border border-[#B59478] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            className="select select-bordered select-sm rounded-full bg-[#F3ECE1] border-[#9B7B60]"
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value as typeof activeFilter);
              setPage(1);
            }}
          >
            <option value="ALL">{tx('Hiệu lực: Tất cả', 'Status: All')}</option>
            <option value="ACTIVE">{tx('Đang kích hoạt', 'Active')}</option>
            <option value="INACTIVE">{tx('Tạm tắt', 'Inactive')}</option>
          </select>
          <select
            className="select select-bordered select-sm rounded-full bg-[#F3ECE1] border-[#9B7B60]"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as typeof sortBy);
              setPage(1);
            }}
          >
            <option value="createdAt_desc">{tx('Sắp xếp: Mới nhất', 'Sort: Newest')}</option>
            <option value="code_asc">{tx('Sắp xếp: Mã A → Z', 'Sort: Code A → Z')}</option>
          </select>
        </div>
      )}

      {/* Danh sách thẻ khuyến mãi */}
      <div className="rounded-[28px] bg-[#FCF9F2] border-[1.5px] border-[#B59478] p-3.5 sm:p-6 space-y-3.5">
        {pagedPromotions.length === 0 ? (
          deletedFilter === 'DELETED' ? (
            <div className="rounded-2xl border border-dashed border-[#C9B29B] bg-[#FDFBF7] p-8 text-center space-y-2">
              <p className="text-3xl">🗑️</p>
              <p className="font-bold text-[#4E311E] text-sm">
                {tx('Thùng rác trống', 'Trash is empty')}
              </p>
              <p className="text-xs text-[#8C6A50]">
                {tx('Không có mã khuyến mãi nào trong thùng rác.', 'No deleted promotions in trash.')}
              </p>
            </div>
          ) : (
            <EmptyState />
          )
        ) : (
          pagedPromotions.map((promo) => (
            <div
              key={promo.id}
              className={`rounded-3xl bg-[#1E3329] text-[#F5EFE6] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                promo.deletedAt ? 'opacity-55' : ''
              }`}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-0.5 rounded-full border border-[#F5EFE6]/40 bg-[#F5EFE6]/10 font-mono font-extrabold text-sm">
                    {promo.code}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FCF9F2] text-[#1E3329] text-[10px] font-extrabold">
                    {promo.discountType === 'PERCENT'
                      ? `-${promo.discountValue}%`
                      : `-${money(promo.discountValue)}`}
                  </span>
                  {promo.deletedAt ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#B83B2A] text-white text-[10px] font-bold">
                      {tx('Thùng rác', 'In Trash')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleActive(promo)}
                      title={promo.isActive ? tx('Nhấn để tạm tắt', 'Click to deactivate') : tx('Nhấn để kích hoạt', 'Click to activate')}
                      className={`px-2.5 py-0.5 rounded-full text-white text-[10px] font-bold transition-all cursor-pointer hover:opacity-90 ${
                        promo.isActive ? 'bg-[#1F5C32]' : 'bg-[#A85D00]'
                      }`}
                    >
                      {promo.isActive ? `● ${tx('Đang hoạt động', 'Active')}` : `○ ${tx('Tạm tắt', 'Inactive')}`}
                    </button>
                  )}
                </div>
                <p className="text-sm font-bold">{promo.description || '-'}</p>
                <div className="text-xs text-[#C9B29B] flex flex-wrap gap-x-4 gap-y-0.5">
                  <span>
                    {tx('Đơn tối thiểu:', 'Min order:')} <strong>{money(promo.minSubtotalVnd)}</strong>
                  </span>
                  <span>
                    {tx('Đã dùng:', 'Used:')} <strong>{promo.usedCount}</strong>/{promo.maxUses ?? '∞'} ({tx('Tối đa/người:', 'Per user:')} {promo.perUserLimit ?? '∞'})
                  </span>
                  <span>
                    {tx('Hết hạn:', 'Ends:')} {dateTime(promo.endsAt)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDetailPromo(promo)}
                  className="px-3.5 py-1.5 rounded-full bg-[#F5EFE6]/15 hover:bg-[#F5EFE6]/25 text-white text-xs font-bold transition-colors"
                >
                  {tx('Chi tiết', 'Details')}
                </button>
                {!promo.deletedAt && (
                  <button
                    type="button"
                    onClick={() => openEdit(promo)}
                    className="px-3.5 py-1.5 rounded-full bg-[#FCF9F2] text-[#1E3329] text-xs font-bold hover:bg-[#E6D7C3] transition-colors"
                  >
                    {tx('Sửa', 'Edit')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setConfirmTarget(promo);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold text-white transition-colors ${
                    promo.deletedAt ? 'bg-[#2B5B6C] hover:bg-[#1E414D]' : 'bg-[#B83B2A] hover:bg-[#8F2D1F]'
                  }`}
                >
                  {promo.deletedAt ? tx('Khôi phục', 'Restore') : tx('Đưa vào thùng rác', 'Move to Trash')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={filtered.length}
        onPageChange={setPage}
      />

      {/* Modal Thêm mới / Chỉnh sửa */}
      {editing && (
        <div className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px] max-w-2xl">
            <h3 className="font-bold text-lg text-[#4E311E] mb-2">
              {isEditMode
                ? `${tx('Sửa Khuyến mãi:', 'Edit Promotion:')} ${editing.code}`
                : tx('Tạo Khuyến mãi mới', 'Create Promotion')}
            </h3>
            {formError && (
              <div className="rounded-xl bg-[#B83B2A] text-white p-2.5 text-xs font-bold mb-3">
                ⚠️ {formError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <fieldset className="fieldset">
                  <legend className="fieldset-legend font-bold">
                    {tx('Mã khuyến mãi', 'Promo Code')} <span className="text-red-500">*</span>
                  </legend>
                  <input
                    type="text"
                    className="input input-bordered font-mono uppercase w-full bg-[#F3ECE1]"
                    placeholder={tx('VD: BREW20', 'e.g. BREW20')}
                    value={editing.code}
                    disabled={isEditMode}
                    required
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                      })
                    }
                  />
                  <span className="text-[11px] text-[#6E4F3A]">
                    {tx('3-32 ký tự chữ hoa & số', '3-32 uppercase alphanumeric chars')}
                  </span>
                </fieldset>
                <fieldset className="fieldset">
                  <legend className="fieldset-legend font-bold">
                    {tx('Loại giảm giá', 'Discount Type')} <span className="text-red-500">*</span>
                  </legend>
                  <select
                    className="select select-bordered w-full bg-[#F3ECE1]"
                    value={editing.discountType}
                    disabled={isEditMode}
                    onChange={(e) => {
                      const nextType = e.target.value as DiscountType;
                      setEditing({
                        ...editing,
                        discountType: nextType,
                        discountValue:
                          nextType === 'PERCENT'
                            ? editing.discountValue > 100
                              ? 10
                              : editing.discountValue
                            : editing.discountValue <= 100
                              ? 20000
                              : editing.discountValue,
                        maxDiscountVnd: nextType === 'FIXED' ? null : editing.maxDiscountVnd,
                      });
                    }}
                  >
                    <option value="FIXED">{tx('Số tiền cố định (VNĐ)', 'Fixed Amount (VND)')}</option>
                    <option value="PERCENT">{tx('Phần trăm (%)', 'Percentage (%)')}</option>
                  </select>
                </fieldset>
                <fieldset className="fieldset">
                  <legend className="fieldset-legend font-bold">
                    {tx('Giá trị giảm', 'Discount Value')} ({editing.discountType === 'PERCENT' ? '%' : 'VNĐ'}){' '}
                    <span className="text-red-500">*</span>
                  </legend>
                  <input
                    type="number"
                    min={1}
                    max={editing.discountType === 'PERCENT' ? 100 : 10000000}
                    className="input input-bordered w-full bg-[#F3ECE1]"
                    value={editing.discountValue || ''}
                    disabled={isEditMode}
                    required
                    onChange={(e) =>
                      setEditing({ ...editing, discountValue: Number(e.target.value) })
                    }
                  />
                  <span className="text-[11px] text-[#6E4F3A]">
                    {editing.discountType === 'PERCENT'
                      ? tx('Từ 1% đến 100%', 'From 1% to 100%')
                      : tx('Từ 1 VNĐ đến 10.000.000 VNĐ', 'From 1 VND to 10,000,000 VND')}
                  </span>
                </fieldset>
              </div>

              <fieldset className="fieldset">
                <legend className="fieldset-legend font-bold">
                  {tx('Mô tả khuyến mãi', 'Description')}{' '}
                  <span className="font-normal text-xs text-[#8B6B50]">
                    ({tx('không bắt buộc', 'optional')})
                  </span>
                </legend>
                <input
                  type="text"
                  maxLength={200}
                  className="input input-bordered w-full bg-[#F3ECE1]"
                  placeholder={tx('VD: Giảm 20k cho đơn từ 50k chào mừng khách hàng mới...', 'e.g. 20k off for orders from 50k...')}
                  value={editing.description ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                />
              </fieldset>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <fieldset className="fieldset">
                  <legend className="fieldset-legend font-bold">
                    {tx('Giảm tối đa (VNĐ)', 'Max Discount (VND)')}
                    {editing.discountType === 'FIXED' && (
                      <span className="text-xs text-[#8B6B50] font-normal ml-1">
                        ({tx('Chỉ áp dụng khi giảm theo %', 'Only for % discount')})
                      </span>
                    )}
                  </legend>
                  <input
                    type="number"
                    step={1000}
                    min={0}
                    className="input input-bordered w-full bg-[#F3ECE1] disabled:opacity-40 disabled:bg-[#ECE4D8]"
                    value={editing.discountType === 'FIXED' ? '' : (editing.maxDiscountVnd ?? '')}
                    placeholder={
                      editing.discountType === 'FIXED'
                        ? tx('Không áp dụng cho giảm cố định', 'Not applicable for fixed discount')
                        : tx('0 hoặc để trống = Không giới hạn', '0 or blank = Unlimited')
                    }
                    disabled={isEditMode || editing.discountType === 'FIXED'}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : Number(e.target.value);
                      setEditing({ ...editing, maxDiscountVnd: val && val > 0 ? val : null });
                    }}
                  />
                </fieldset>
                <fieldset className="fieldset">
                  <legend className="fieldset-legend font-bold">
                    {tx('Đơn tối thiểu (VNĐ)', 'Min Order Subtotal (VND)')} <span className="text-red-500">*</span>
                  </legend>
                  <input
                    type="number"
                    step={5000}
                    min={0}
                    className="input input-bordered w-full bg-[#F3ECE1]"
                    value={editing.minSubtotalVnd ?? 0}
                    disabled={isEditMode}
                    required
                    onChange={(e) =>
                      setEditing({ ...editing, minSubtotalVnd: Math.max(0, Number(e.target.value)) })
                    }
                  />
                </fieldset>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <fieldset className="fieldset">
                  <legend className="fieldset-legend font-bold">
                    {tx('Thời điểm bắt đầu', 'Start Date & Time')} <span className="text-red-500">*</span>
                  </legend>
                  <input
                    type="datetime-local"
                    className="input input-bordered w-full bg-[#F3ECE1]"
                    value={editing.startsAt}
                    disabled={isEditMode}
                    required
                    onChange={(e) => setEditing({ ...editing, startsAt: e.target.value })}
                  />
                </fieldset>
                <fieldset className="fieldset">
                  <legend className="fieldset-legend font-bold">
                    {tx('Thời điểm kết thúc', 'End Date & Time')} <span className="text-red-500">*</span>
                  </legend>
                  <input
                    type="datetime-local"
                    className="input input-bordered w-full bg-[#F3ECE1]"
                    value={editing.endsAt}
                    required
                    onChange={(e) => setEditing({ ...editing, endsAt: e.target.value })}
                  />
                </fieldset>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <fieldset className="fieldset">
                  <legend className="fieldset-legend font-bold">
                    {tx('Tổng số lượt sử dụng tối đa', 'Max Total Uses')}
                  </legend>
                  <input
                    type="number"
                    min={0}
                    className="input input-bordered w-full bg-[#F3ECE1]"
                    placeholder={tx('0 hoặc để trống = Không giới hạn', '0 or blank = Unlimited')}
                    value={editing.maxUses ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : Number(e.target.value);
                      setEditing({ ...editing, maxUses: val && val > 0 ? val : null });
                    }}
                  />
                </fieldset>
                <fieldset className="fieldset">
                  <legend className="fieldset-legend font-bold">
                    {tx('Giới hạn lượt dùng mỗi khách', 'Per User Limit')}
                  </legend>
                  <input
                    type="number"
                    min={1}
                    className="input input-bordered w-full bg-[#F3ECE1]"
                    placeholder={tx('Mặc định: 1 lượt/khách', 'Default: 1 per user')}
                    value={editing.perUserLimit ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : Number(e.target.value);
                      setEditing({ ...editing, perUserLimit: val && val > 0 ? val : null });
                    }}
                  />
                </fieldset>
              </div>

              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="toggle toggle-success"
                  checked={editing.isActive}
                  onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                />
                <span className="label-text font-bold">
                  {tx('Đang hoạt động', 'Active Status')}
                </span>
              </label>

              <div className="modal-action">
                <button
                  type="button"
                  disabled={submitting}
                  className="px-4 py-2 rounded-full border border-[#9B7B60] text-xs font-bold hover:bg-[#F3ECE1] text-[#4E311E] transition-colors"
                  onClick={() => setEditing(null)}
                >
                  {tx('Hủy', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] transition-colors disabled:opacity-50"
                >
                  {submitting
                    ? '...'
                    : isEditMode
                      ? tx('Lưu thay đổi', 'Save Changes')
                      : tx('Tạo Khuyến mãi', 'Create Promotion')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xem chi tiết */}
      {detailPromo && (
        <div className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px] max-w-lg">
            <h3 className="font-bold text-lg text-[#4E311E] mb-3">
              {tx('Chi tiết Mã:', 'Promotion Details:')} {detailPromo.code}
            </h3>
            <div className="space-y-2 text-sm bg-[#F3ECE1] border border-[#C9B29B] p-4 rounded-2xl">
              <p><strong>{tx('Mô tả:', 'Description:')}</strong> {detailPromo.description ?? '-'}</p>
              <p>
                <strong>{tx('Loại & Giá trị giảm:', 'Type & Value:')}</strong> {detailPromo.discountType} —{' '}
                {detailPromo.discountType === 'PERCENT'
                  ? `${detailPromo.discountValue}%`
                  : money(detailPromo.discountValue)}
              </p>
              <p>
                <strong>{tx('Giảm tối đa:', 'Max discount:')}</strong>{' '}
                {detailPromo.maxDiscountVnd ? money(detailPromo.maxDiscountVnd) : '∞'}
              </p>
              <p><strong>{tx('Đơn tối thiểu:', 'Min order:')}</strong> {money(detailPromo.minSubtotalVnd)}</p>
              <p><strong>{tx('Bắt đầu:', 'Starts:')}</strong> {dateTime(detailPromo.startsAt)}</p>
              <p><strong>{tx('Kết thúc:', 'Ends:')}</strong> {dateTime(detailPromo.endsAt)}</p>
              <p>
                <strong>{tx('Lượt đã dùng:', 'Usage:')}</strong> {detailPromo.usedCount} /{' '}
                {detailPromo.maxUses ?? '∞'} ({tx('Giới hạn/người:', 'Per user:')} {detailPromo.perUserLimit ?? '∞'})
              </p>
            </div>
            <div className="modal-action">
              <button
                type="button"
                className="px-5 py-2 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] transition-colors"
                onClick={() => setDetailPromo(null)}
              >
                {tx('Đóng', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Đưa vào thùng rác / Khôi phục */}
      {confirmTarget && (
        <div className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px] max-w-md">
            <h3 className="font-bold text-lg text-[#4E311E] mb-2">
              {confirmTarget.deletedAt
                ? tx('Xác nhận khôi phục Mã khuyến mãi?', 'Confirm restore promotion?')
                : tx('Xác nhận đưa Mã khuyến mãi vào thùng rác?', 'Move promotion to trash?')}
            </h3>
            <p className="text-xs text-[#6E4F3A]">
              {confirmTarget.deletedAt
                ? tx(
                    `Mã khuyến mãi "${confirmTarget.code}" sẽ được khôi phục và có thể áp dụng lại khi khách thanh toán.`,
                    `Promo code "${confirmTarget.code}" will be restored and applicable again.`,
                  )
                : tx(
                    `Mã khuyến mãi "${confirmTarget.code}" sẽ được ngừng áp dụng và chuyển vào Thùng rác. Bạn có thể khôi phục lại bất kỳ lúc nào.`,
                    `Promo code "${confirmTarget.code}" will be moved to trash. You can restore it anytime.`,
                  )}
            </p>
            {errorMsg && (
              <div className="rounded-xl bg-[#B83B2A] text-white p-2.5 text-xs font-bold mt-3">
                ⚠️ {errorMsg}
              </div>
            )}
            <div className="modal-action">
              <button
                type="button"
                disabled={deleting}
                className="px-4 py-2 rounded-full border border-[#9B7B60] text-xs font-bold hover:bg-[#F3ECE1] text-[#4E311E] transition-colors"
                onClick={() => setConfirmTarget(null)}
              >
                {tx('Hủy', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmToggleDelete}
                className={`px-5 py-2 rounded-full text-white text-xs font-bold disabled:opacity-50 transition-colors ${
                  confirmTarget.deletedAt ? 'bg-[#2B5B6C] hover:bg-[#1E414D]' : 'bg-[#B83B2A] hover:bg-[#8F2D1F]'
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
