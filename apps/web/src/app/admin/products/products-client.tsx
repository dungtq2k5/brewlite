'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import type { MockCategory, MockProduct } from '@/mocks/admin-data';
import { useLocale } from '@/i18n/locale-context';
import { createProductSchema } from '@/lib/zod-schemas';
import { LocalizedInput } from '@/components/ui/localized-input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { saveProductAction, toggleProductDeleteAction } from './actions';

interface ProductsClientProps {
  initialProducts: MockProduct[];
  categories: MockCategory[];
}

export function ProductsClient({ initialProducts, categories }: ProductsClientProps) {
  const { tx, tText, money } = useLocale();
  const [products, setProducts] = useState<MockProduct[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [deletedFilter, setDeletedFilter] = useState<'ALL' | 'ACTIVE' | 'DELETED'>('ALL');
  const [sortBy, setSortBy] = useState<'sortOrder' | 'price_asc' | 'price_desc'>('sortOrder');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);

  const [creating, setCreating] = useState<MockProduct | null>(null);
  const [unlimitedStock, setUnlimitedStock] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<MockProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  function getFriendlyError(code?: string): string {
    if (!code) return tx('Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.');
    if (code.includes('PRODUCT_NAME_TAKEN')) {
      return tx('Tên sản phẩm đã tồn tại trong hệ thống.', 'Product name is already taken.');
    }
    if (code.includes('CATEGORY_NOT_FOUND')) {
      return tx('Không tìm thấy danh mục đã chọn.', 'Category not found.');
    }
    if (code.includes('CATEGORY_IN_USE')) {
      return tx('Danh mục đang được sử dụng và có sản phẩm liên kết.', 'Category is in use.');
    }
    return code;
  }

  const filtered = products
    .filter((p) => {
      const matchText =
        p.name.vi.toLowerCase().includes(search.toLowerCase()) ||
        p.name.en.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === 'ALL' || p.categoryId === categoryFilter;
      const matchDel =
        deletedFilter === 'ALL' ||
        (deletedFilter === 'DELETED' ? Boolean(p.deletedAt) : !p.deletedAt);
      return matchText && matchCat && matchDel;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.basePriceVnd - b.basePriceVnd;
      if (sortBy === 'price_desc') return b.basePriceVnd - a.basePriceVnd;
      return a.sortOrder - b.sortOrder;
    });

  const pagedProducts = filtered.slice((page - 1) * pageSize, page * pageSize);

  function getCategory(categoryId: string): MockCategory | undefined {
    return categories.find((c) => c.id === categoryId);
  }

  function openCreateModal() {
    const activeCats = categories.filter((c) => !c.deletedAt);
    setUnlimitedStock(false);
    setErrorMsg(null);
    setCreating({
      id: `prod-${crypto.randomUUID().slice(0, 8)}`,
      categoryId: activeCats[0]?.id ?? 'cat-1',
      name: { en: '', vi: '' },
      description: { en: '', vi: '' },
      basePriceVnd: 29000,
      sortOrder: products.length + 1,
      imageUrl: null,
      isAvailable: true,
      stockQty: 50,
      version: 1,
      sizes: [
        { size: 'S', priceDeltaVnd: 0 },
        { size: 'M', priceDeltaVnd: 6000 },
        { size: 'L', priceDeltaVnd: 10000 },
      ],
      toppingIds: [],
      createdAt: new Date().toISOString(),
      deletedAt: null,
    });
  }

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!creating || submitting) return;
    const candidate = {
      categoryId: creating.categoryId,
      name: creating.name,
      description: creating.description,
      basePriceVnd: creating.basePriceVnd,
      sizes: creating.sizes,
      toppingIds: creating.toppingIds,
      stockQty: unlimitedStock ? null : (creating.stockQty ?? 0),
      sortOrder: creating.sortOrder,
    };
    const parsed = createProductSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? tx('Dữ liệu không hợp lệ', 'Invalid data'));
      return;
    }

    setSubmitting(true);
    try {
      const payload: MockProduct = {
        ...creating,
        description: parsed.data.description ?? { en: '', vi: '' },
        stockQty: candidate.stockQty,
      };
      const res = await saveProductAction(payload, true);
      if (res.ok) {
        const returned = res.data as Partial<MockProduct> | undefined;
        const saved: MockProduct = returned
          ? {
              id: returned.id ?? payload.id,
              categoryId: returned.categoryId ?? payload.categoryId,
              name: returned.name ?? payload.name,
              description: payload.description,
              basePriceVnd: returned.basePriceVnd ?? payload.basePriceVnd,
              sortOrder: returned.sortOrder ?? payload.sortOrder,
              imageUrl: Array.isArray(returned.imageUrl)
                ? returned.imageUrl[0] ?? null
                : returned.imageUrl ?? null,
              isAvailable: returned.isAvailable ?? payload.isAvailable,
              stockQty: returned.stockQty !== undefined ? returned.stockQty : payload.stockQty,
              version: returned.version ?? payload.version,
              sizes: payload.sizes,
              toppingIds: payload.toppingIds,
              createdAt: returned.createdAt ?? payload.createdAt,
              deletedAt: null,
            }
          : payload;
        setProducts((prev) => [saved, ...prev]);
        setCreating(null);
      } else {
        setErrorMsg(getFriendlyError(res.code));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handlePromptDelete(prod: MockProduct) {
    setErrorMsg(null);
    const shouldRestore = Boolean(prod.deletedAt);
    if (shouldRestore) {
      const cat = getCategory(prod.categoryId);
      if (cat?.deletedAt) {
        setErrorMsg(
          tx(
            `Không thể khôi phục "${prod.name.vi}" vì danh mục "${cat.name.vi}" đang nằm trong thùng rác!`,
            `Cannot restore "${prod.name.en}" because its category "${cat.name.en}" is in the trash!`,
          ),
        );
        return;
      }
    }
    setConfirmTarget(prod);
  }

  async function handleConfirmToggleDelete() {
    if (!confirmTarget || deleting) return;
    setErrorMsg(null);
    setDeleting(true);
    const shouldRestore = Boolean(confirmTarget.deletedAt);
    try {
      const res = await toggleProductDeleteAction(confirmTarget.id, shouldRestore);
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === confirmTarget.id
              ? { ...p, deletedAt: shouldRestore ? null : new Date().toISOString() }
              : p,
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

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="relative">
        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl text-[#9B7B60]">
          🔍
        </span>
        <input
          type="text"
          placeholder={tx('Tìm kiếm món nước...', 'Search products...')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full h-13 pl-13 pr-36 rounded-full bg-[#FCF9F2] border-[1.5px] border-[#9B7B60] text-base text-[#4E311E] placeholder-[#9B7B60] focus:outline-none focus:border-[#4E311E]"
        />
        <button
          type="button"
          onClick={openCreateModal}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] transition-colors"
        >
          + {tx('Thêm món', 'Add Item')}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('ALL');
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              categoryFilter === 'ALL'
                ? 'bg-[#4E311E] text-white border-[#4E311E]'
                : 'bg-[#FCF9F2] text-[#4E311E] border-[#C9B29B]'
            }`}
          >
            {tx('Tất cả', 'All')}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCategoryFilter(c.id);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                categoryFilter === c.id
                  ? 'bg-[#4E311E] text-white border-[#4E311E]'
                  : 'bg-[#FCF9F2] text-[#4E311E] border-[#C9B29B]'
              }`}
            >
              {tText(c.name)}
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
            value={deletedFilter}
            onChange={(e) => {
              setDeletedFilter(e.target.value as 'ALL' | 'ACTIVE' | 'DELETED');
              setPage(1);
            }}
          >
            <option value="ALL">{tx('Trạng thái: Tất cả', 'Status: All')}</option>
            <option value="ACTIVE">{tx('Đang hoạt động', 'Active Only')}</option>
            <option value="DELETED">{tx('Thùng rác', 'Trash')}</option>
          </select>
          <select
            className="select select-bordered select-sm rounded-full bg-[#F3ECE1] border-[#9B7B60]"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as typeof sortBy);
              setPage(1);
            }}
          >
            <option value="sortOrder">{tx('Sắp xếp: Thứ tự hiển thị', 'Sort: Display Order')}</option>
            <option value="price_asc">{tx('Giá: Thấp → Cao', 'Price: Low → High')}</option>
            <option value="price_desc">{tx('Giá: Cao → Thấp', 'Price: High → Low')}</option>
          </select>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl bg-[#B83B2A] text-white px-4 py-2.5 text-xs font-bold">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="rounded-[28px] bg-[#FCF9F2] border-[1.5px] border-[#B59478] p-3.5 sm:p-6 space-y-3.5">
        {pagedProducts.length === 0 ? (
          <EmptyState />
        ) : (
          pagedProducts.map((prod) => {
            const cat = getCategory(prod.categoryId);
            return (
              <div
                key={prod.id}
                className={`rounded-3xl bg-[#F3ECE1] border border-[#9B7B60] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  prod.deletedAt ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-16 h-16 rounded-2xl bg-[#E6D7C3] border border-[#C9B29B] flex items-center justify-center overflow-hidden text-2xl shrink-0">
                    {prod.imageUrl ? (
                      <img
                        src={prod.imageUrl}
                        alt={tText(prod.name)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      '☕'
                    )}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-extrabold text-base text-[#4E311E] truncate">
                        {tText(prod.name)}
                      </h3>
                      {cat && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#4E311E] text-white">
                          {tText(cat.name)}
                        </span>
                      )}
                      {prod.deletedAt ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#B83B2A] text-white">
                          {tx('Thùng rác', 'In Trash')}
                        </span>
                      ) : prod.isAvailable ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1F5C32] text-white">
                          {tx('Đang bán', 'Available')}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#B83B2A] text-white">
                          {tx('Tạm hết', 'Sold out')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6E4F3A] line-clamp-1">
                      {tText(prod.description)}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <span className="text-sm font-extrabold text-[#B83B2A]">
                        {tx('từ', 'from')} {money(prod.basePriceVnd)}
                      </span>
                      <span className="text-xs text-[#6E4F3A]">
                        Size: {prod.sizes.map((s) => s.size).join(', ')}
                      </span>
                      <span className="text-xs text-[#6E4F3A]">
                        {tx('Tồn:', 'Stock:')}{' '}
                        <strong>{prod.stockQty === null ? '∞' : prod.stockQty}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#C9B29B]">
                  <Link
                    href={`/admin/products/${prod.id}`}
                    prefetch={false}
                    className="px-3.5 py-1.5 rounded-full border border-[#9B7B60] bg-[#FCF9F2] text-xs font-bold text-[#4E311E] hover:bg-[#4E311E] hover:text-white transition-colors"
                  >
                    {tx('Sửa', 'Edit')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handlePromptDelete(prod)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold text-white transition-colors ${
                      prod.deletedAt ? 'bg-[#2B5B6C] hover:bg-[#1E414D]' : 'bg-[#B83B2A] hover:bg-[#8F2D1F]'
                    }`}
                  >
                    {prod.deletedAt ? tx('Khôi phục', 'Restore') : tx('Đưa vào thùng rác', 'Move to Trash')}
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
        totalItems={filtered.length}
        onPageChange={setPage}
      />

      {/* Modal Tạo Sản phẩm mới */}
      {creating && (
        <div className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px] max-w-2xl">
            <h3 className="font-bold text-lg text-[#4E311E] mb-4">
              {tx('Tạo Sản phẩm mới', 'Create New Product')}
            </h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <LocalizedInput
                label={tx('Tên sản phẩm', 'Product Name')}
                value={creating.name}
                onChange={(name) => setCreating({ ...creating, name })}
              />
              <LocalizedInput
                label={tx('Mô tả sản phẩm', 'Description')}
                value={creating.description}
                onChange={(description) => setCreating({ ...creating, description })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <fieldset className="fieldset">
                  <legend className="fieldset-legend font-bold">
                    {tx('Danh mục', 'Category')}
                  </legend>
                  <select
                    className="select select-bordered w-full bg-[#F3ECE1]"
                    value={creating.categoryId}
                    onChange={(e) => setCreating({ ...creating, categoryId: e.target.value })}
                  >
                    {categories
                      .filter((c) => !c.deletedAt)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {tText(c.name)}
                        </option>
                      ))}
                  </select>
                </fieldset>
                <fieldset className="fieldset">
                  <legend className="fieldset-legend font-bold">
                    {tx('Giá cơ bản (VNĐ)', 'Base Price (VND)')}
                  </legend>
                  <input
                    type="number"
                    step={1000}
                    min={0}
                    max={10000000}
                    className="input input-bordered w-full bg-[#F3ECE1]"
                    value={creating.basePriceVnd}
                    required
                    onChange={(e) =>
                      setCreating({ ...creating, basePriceVnd: Number(e.target.value) })
                    }
                  />
                </fieldset>
                <fieldset className="fieldset">
                  <legend className="fieldset-legend font-bold">
                    {tx('Thứ tự hiển thị', 'Display Order')}
                  </legend>
                  <input
                    type="number"
                    min={0}
                    max={32767}
                    className="input input-bordered w-full bg-[#F3ECE1]"
                    value={creating.sortOrder}
                    required
                    onChange={(e) =>
                      setCreating({ ...creating, sortOrder: Number(e.target.value) })
                    }
                  />
                </fieldset>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F3ECE1] border border-[#C9B29B] flex flex-wrap items-center justify-between gap-3">
                <label className="label cursor-pointer gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-primary"
                    checked={unlimitedStock}
                    onChange={(e) => setUnlimitedStock(e.target.checked)}
                  />
                  <span className="label-text font-bold">
                    {tx('Tồn kho không giới hạn (Không đếm số lượng)', 'Unlimited stock')}
                  </span>
                </label>
                {!unlimitedStock && (
                  <input
                    type="number"
                    min={0}
                    className="input input-bordered input-sm w-28 bg-[#FCF9F2]"
                    value={creating.stockQty ?? 0}
                    onChange={(e) =>
                      setCreating({ ...creating, stockQty: Number(e.target.value) })
                    }
                  />
                )}
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  disabled={submitting}
                  className="px-4 py-2 rounded-full border border-[#9B7B60] text-xs font-bold hover:bg-[#F3ECE1]"
                  onClick={() => setCreating(null)}
                >
                  {tx('Hủy', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] disabled:opacity-50"
                >
                  {submitting ? '...' : tx('Tạo sản phẩm', 'Create Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Đưa vào thùng rác / Khôi phục Sản phẩm */}
      {confirmTarget && (
        <div className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px] max-w-md">
            <h3 className="font-bold text-lg text-[#4E311E] mb-2">
              {confirmTarget.deletedAt
                ? tx('Xác nhận khôi phục Sản phẩm?', 'Confirm restore product?')
                : tx('Xác nhận đưa Sản phẩm vào thùng rác?', 'Move product to trash?')}
            </h3>
            <p className="text-xs text-[#6E4F3A]">
              {confirmTarget.deletedAt
                ? tx(
                    `Sản phẩm "${tText(confirmTarget.name)}" sẽ được khôi phục trở lại thực đơn bán.`,
                    `Product "${tText(confirmTarget.name)}" will be restored to menu.`,
                  )
                : tx(
                    `Sản phẩm "${tText(confirmTarget.name)}" sẽ được ngừng bán và chuyển vào Thùng rác. Bạn có thể khôi phục lại bất kỳ lúc nào.`,
                    `Product "${tText(confirmTarget.name)}" will be archived to trash. You can restore it anytime.`,
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