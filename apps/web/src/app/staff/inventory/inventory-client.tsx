'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/i18n/locale-context';
import type { LocalizedText } from '@/i18n/format';
import { setStockQtySchema } from '@/lib/zod-schemas';
import { Pagination } from '@/components/ui/pagination';
import {
  setProductAvailabilityAction,
  setToppingAvailabilityAction,
  updateProductStockAction,
} from './actions';

export interface InventoryCategory {
  id: string;
  name: LocalizedText;
}

export interface InventoryProduct {
  id: string;
  categoryId: string;
  categoryName: string;
  name: LocalizedText;
  priceVnd: number;
  imageUrl: string | null;
  isAvailable: boolean;
  stockQty: number | null;
  version: number;
}

export interface InventoryTopping {
  id: string;
  name: LocalizedText;
  priceVnd: number;
  isAvailable: boolean;
}

interface InventoryClientProps {
  initialProducts: InventoryProduct[];
  initialToppings: InventoryTopping[];
  categories: InventoryCategory[];
}

type StockFilterType = 'ALL' | 'AVAILABLE' | 'UNAVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'UNLIMITED';

interface PendingStockConfirm {
  prod: InventoryProduct;
  nextStockQty: number | null;
  title: string;
  message: string;
  confirmLabel: string;
  isDanger?: boolean;
}

export function InventoryClient({
  initialProducts,
  initialToppings,
  categories,
}: InventoryClientProps) {
  const router = useRouter();
  const { tx, tText, money } = useLocale();

  const [products, setProducts] = useState<InventoryProduct[]>(initialProducts);
  const [toppings, setToppings] = useState<InventoryTopping[]>(initialToppings);
  const [tab, setTab] = useState<'PRODUCTS' | 'TOPPINGS'>('PRODUCTS');

  // Bộ lọc & Tìm kiếm
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<StockFilterType>('ALL');

  // Phân trang
  const [prodPage, setProdPage] = useState(1);
  const [topPage, setTopPage] = useState(1);
  const pageSize = 8;

  // Input nháp số lượng tồn kho
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});

  // Trạng thái đang gửi request (chống double-click)
  const [submittingIds, setSubmittingIds] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Xung đột dữ liệu 409
  const [conflictProduct, setConflictProduct] = useState<InventoryProduct | null>(null);

  // Modal xác nhận thao tác tồn kho quan trọng
  const [pendingConfirm, setPendingConfirm] = useState<PendingStockConfirm | null>(null);

  // Thông báo phản hồi Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 2500);
  }

  function handleRefreshData() {
    setIsRefreshing(true);
    setConflictProduct(null);
    router.refresh();
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('success', tx('Đã làm mới dữ liệu tồn kho mới nhất', 'Latest inventory data reloaded'));
    }, 600);
  }

  async function handleUpdateStock(prod: InventoryProduct, nextStockQty: number | null) {
    const parsed = setStockQtySchema.safeParse({
      stockQty: nextStockQty,
      expectedVersion: prod.version,
    });
    if (!parsed.success) {
      showToast('error', tx('Số lượng nhập vào không hợp lệ', 'Invalid quantity entered'));
      return;
    }

    setSubmittingIds((prev) => ({ ...prev, [prod.id]: true }));
    const safeStock = parsed.data.stockQty;

    const res = await updateProductStockAction(prod.id, safeStock, prod.version);
    setSubmittingIds((prev) => ({ ...prev, [prod.id]: false }));

    if (!res.ok) {
      if (res.status === 409 || res.code?.includes('CONFLICT')) {
        setConflictProduct(prod);
        showToast(
          'error',
          tx(
            `Dữ liệu món "${tText(prod.name)}" vừa bị thay đổi ở thiết bị khác. Vui lòng tải lại.`,
            `"${tText(prod.name)}" was updated on another device. Please reload.`,
          ),
        );
      } else {
        showToast('error', tx('Không thể cập nhật tồn kho. Vui lòng thử lại.', 'Failed to update stock. Please try again.'));
      }
      return;
    }

    const updatedData = res.data as { stockQty?: number | null; version?: number; isAvailable?: boolean } | undefined;
    const newStock = updatedData?.stockQty !== undefined ? updatedData.stockQty : safeStock;
    const newVersion = updatedData?.version !== undefined ? updatedData.version : prod.version + 1;
    const newAvailable = updatedData?.isAvailable !== undefined ? updatedData.isAvailable : (safeStock === 0 ? false : prod.isAvailable);

    setProducts((prev) =>
      prev.map((p) =>
        p.id === prod.id
          ? {
              ...p,
              stockQty: newStock,
              version: newVersion,
              isAvailable: newAvailable,
            }
          : p,
      ),
    );

    // Xóa draft của sản phẩm này
    setStockDrafts((prev) => {
      const next = { ...prev };
      delete next[prod.id];
      return next;
    });

    showToast(
      'success',
      tx(
        `Đã cập nhật tồn kho "${tText(prod.name)}": ${newStock === null ? 'Không giới hạn' : newStock}`,
        `Updated stock for "${tText(prod.name)}": ${newStock === null ? 'Unlimited' : newStock}`,
      ),
    );
  }

  async function handleToggleProductAvailable(prod: InventoryProduct, nextAvailable: boolean) {
    setSubmittingIds((prev) => ({ ...prev, [prod.id]: true }));
    const res = await setProductAvailabilityAction(prod.id, nextAvailable);
    setSubmittingIds((prev) => ({ ...prev, [prod.id]: false }));

    if (res.ok) {
      setProducts((prev) =>
        prev.map((p) => (p.id === prod.id ? { ...p, isAvailable: nextAvailable } : p)),
      );
      showToast(
        'success',
        tx(
          `Đã ${nextAvailable ? 'mở bán' : 'tạm ngưng'} món "${tText(prod.name)}"`,
          `Set "${tText(prod.name)}" to ${nextAvailable ? 'Available' : 'Unavailable'}`,
        ),
      );
    } else {
      showToast('error', tx('Không thể thay đổi trạng thái phục vụ.', 'Failed to change availability.'));
    }
  }

  async function handleToggleToppingAvailable(top: InventoryTopping, nextAvailable: boolean) {
    setSubmittingIds((prev) => ({ ...prev, [top.id]: true }));
    const res = await setToppingAvailabilityAction(top.id, nextAvailable);
    setSubmittingIds((prev) => ({ ...prev, [top.id]: false }));

    if (res.ok) {
      setToppings((prev) =>
        prev.map((t) => (t.id === top.id ? { ...t, isAvailable: nextAvailable } : t)),
      );
      showToast(
        'success',
        tx(
          `Đã ${nextAvailable ? 'bật có sẵn' : 'báo tạm hết'} topping "${tText(top.name)}"`,
          `Set topping "${tText(top.name)}" to ${nextAvailable ? 'Available' : 'Unavailable'}`,
        ),
      );
    } else {
      showToast('error', tx('Không thể cập nhật trạng thái topping.', 'Failed to update topping.'));
    }
  }

  // Thống kê nhanh KPI
  const totalProducts = products.length;
  const availableProducts = products.filter((p) => p.isAvailable && p.stockQty !== 0).length;
  const unavailableProducts = products.filter((p) => !p.isAvailable || p.stockQty === 0).length;
  const lowStockProducts = products.filter(
    (p) => p.stockQty !== null && p.stockQty > 0 && p.stockQty <= 10,
  ).length;

  // Lọc sản phẩm
  const filteredProducts = products.filter((p) => {
    // 1. Tìm kiếm tên món
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchVi = p.name.vi?.toLowerCase().includes(q);
      const matchEn = p.name.en?.toLowerCase().includes(q);
      if (!matchVi && !matchEn) return false;
    }

    // 2. Lọc theo danh mục
    if (selectedCategory !== 'ALL' && p.categoryId !== selectedCategory) {
      return false;
    }

    // 3. Lọc theo tình trạng tồn kho
    if (stockFilter === 'AVAILABLE') {
      return p.isAvailable && p.stockQty !== 0;
    }
    if (stockFilter === 'UNAVAILABLE') {
      return !p.isAvailable || p.stockQty === 0;
    }
    if (stockFilter === 'LOW_STOCK') {
      return p.stockQty !== null && p.stockQty > 0 && p.stockQty <= 10;
    }
    if (stockFilter === 'OUT_OF_STOCK') {
      return p.stockQty === 0;
    }
    if (stockFilter === 'UNLIMITED') {
      return p.stockQty === null;
    }

    return true;
  });

  // Lọc Topping
  const filteredToppings = toppings.filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchVi = t.name.vi?.toLowerCase().includes(q);
      const matchEn = t.name.en?.toLowerCase().includes(q);
      if (!matchVi && !matchEn) return false;
    }
    return true;
  });

  // Phân trang Client-side
  const pagedProducts = filteredProducts.slice((prodPage - 1) * pageSize, prodPage * pageSize);
  const pagedToppings = filteredToppings.slice((topPage - 1) * pageSize, topPage * pageSize);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Toast thông báo ngắn gọn, có thể bấm để đóng ngay */}
      {toast && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setToast(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setToast(null);
          }}
          className="fixed bottom-6 right-6 z-50 cursor-pointer transition-all hover:opacity-90"
          title={tx('Bấm để đóng thông báo', 'Click to dismiss')}
        >
          <div
            className={`rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3 text-sm font-bold text-white ${
              toast.type === 'success' ? 'bg-[#1F5C32]' : 'bg-[#B83B2A]'
            }`}
          >
            <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{toast.message}</span>
            <span className="text-xs opacity-75 ml-2">✕</span>
          </div>
        </div>
      )}

      {/* Header trang */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#C9B29B] pb-4">
        <div>
          <h1 className="text-2xl font-black text-[#4E311E] flex items-center gap-2">
            <span>📦</span>
            <span>{tx('Quản lý tồn kho & Thực đơn mở bán', 'Inventory & Availability')}</span>
          </h1>
          <p className="text-xs text-[#8C6A50] mt-1">
            {tx(
              'Kiểm soát số lượng tồn kho, cập nhật nhanh trạng thái mở bán hoặc tạm ngưng của từng món ăn và topping.',
              'Control stock quantity, toggle availability or set items to out-of-stock in real-time.',
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefreshData}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#9B7B60] bg-[#FCF9F2] text-[#4E311E] text-xs font-bold hover:bg-[#F3ECE1] transition-all disabled:opacity-50 self-start sm:self-auto shadow-sm"
        >
          <span className={isRefreshing ? 'animate-spin' : ''}>↻</span>
          <span>{tx('Làm mới dữ liệu', 'Refresh Data')}</span>
        </button>
      </div>

      {/* 4 Thẻ KPI thống kê nhanh */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-[#FCF9F2] border border-[#B59478] p-4 shadow-sm">
          <div className="text-xs font-bold text-[#8C6A50]">{tx('Tổng số sản phẩm', 'Total Items')}</div>
          <div className="text-2xl font-black text-[#4E311E] mt-1">{totalProducts}</div>
          <div className="text-[11px] text-[#9B7B60] mt-0.5">{tx('Trong thực đơn', 'In catalog')}</div>
        </div>

        <div className="rounded-2xl bg-[#FCF9F2] border border-[#B59478] p-4 shadow-sm">
          <div className="text-xs font-bold text-[#1F5C32]">{tx('Đang mở bán', 'Serving Now')}</div>
          <div className="text-2xl font-black text-[#1F5C32] mt-1">{availableProducts}</div>
          <div className="text-[11px] text-[#9B7B60] mt-0.5">{tx('Khách có thể đặt', 'Orderable')}</div>
        </div>

        <div className="rounded-2xl bg-[#FCF9F2] border border-[#B59478] p-4 shadow-sm">
          <div className="text-xs font-bold text-[#8C6A50]">{tx('Tạm ngưng / Hết', 'Paused / Out')}</div>
          <div className="text-2xl font-black text-[#8C6A50] mt-1">{unavailableProducts}</div>
          <div className="text-[11px] text-[#9B7B60] mt-0.5">{tx('Tạm ẩn trên menu', 'Hidden on menu')}</div>
        </div>

        <div className="rounded-2xl bg-[#FCF9F2] border border-[#B59478] p-4 shadow-sm">
          <div className="text-xs font-bold text-[#B83B2A]">{tx('Tồn kho thấp (≤10)', 'Low Stock (≤10)')}</div>
          <div className="text-2xl font-black text-[#B83B2A] mt-1">{lowStockProducts}</div>
          <div className="text-[11px] text-[#9B7B60] mt-0.5">{tx('Cần chuẩn bị thêm', 'Replenish needed')}</div>
        </div>
      </div>

      {/* Cảnh báo xung đột 409 chuẩn nghiệp vụ */}
      {conflictProduct && (
        <div className="rounded-2xl bg-[#A85D00] text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <strong className="text-sm block">
                {tx('Dữ liệu tồn kho vừa được cập nhật ở nơi khác!', 'Data was modified on another screen!')}
              </strong>
              <span>
                {tx(
                  `Món "${tText(conflictProduct.name)}" vừa được cập nhật bởi một người dùng khác. Vui lòng tải lại dữ liệu mới nhất để đồng bộ số lượng tồn kho chính xác.`,
                  `Item "${tText(conflictProduct.name)}" was just updated by another user. Please reload to sync the current stock.`,
                )}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefreshData}
            className="px-4 py-2 rounded-full bg-white text-[#4E311E] font-bold hover:bg-amber-50 transition-all self-end sm:self-auto shrink-0 shadow-sm"
          >
            ↻ {tx('Tải lại dữ liệu mới nhất', 'Reload Latest Data')}
          </button>
        </div>
      )}

      {/* Chuyển Tab: Sản phẩm & Topping */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C9B29B] pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('PRODUCTS')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-all ${
              tab === 'PRODUCTS'
                ? 'bg-[#4E311E] text-white border-[#4E311E] shadow-sm'
                : 'bg-[#FCF9F2] text-[#4E311E] border-[#C9B29B] hover:bg-[#F3ECE1]'
            }`}
          >
            ☕ {tx('Sản phẩm & Đồ uống', 'Products')} ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('TOPPINGS')}
            className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-all ${
              tab === 'TOPPINGS'
                ? 'bg-[#4E311E] text-white border-[#4E311E] shadow-sm'
                : 'bg-[#FCF9F2] text-[#4E311E] border-[#C9B29B] hover:bg-[#F3ECE1]'
            }`}
          >
            🍮 {tx('Topping thêm', 'Toppings')} ({toppings.length})
          </button>
        </div>
      </div>

      {/* Thanh Tìm kiếm & Bộ lọc */}
      <div className="rounded-2xl bg-[#FCF9F2] border border-[#B59478] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#9B7B60]">
              🔍
            </span>
            <input
              type="text"
              placeholder={tx('Tìm nhanh theo tên món ăn, đồ uống hoặc topping...', 'Search items or toppings...')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setProdPage(1);
                setTopPage(1);
              }}
              className="w-full h-11 pl-10 pr-10 rounded-full bg-white border border-[#C9B29B] text-xs font-medium text-[#4E311E] placeholder:text-[#9B7B60] focus:outline-none focus:border-[#4E311E]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setProdPage(1);
                  setTopPage(1);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#9B7B60] hover:text-[#4E311E] transition-colors p-1"
                aria-label={tx('Xóa tìm kiếm', 'Clear search')}
              >
                ✕
              </button>
            )}
          </div>

          {/* Lọc danh mục (chỉ hiện ở tab PRODUCTS) */}
          {tab === 'PRODUCTS' && categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setProdPage(1);
              }}
              className="h-11 px-4 rounded-full bg-white border border-[#C9B29B] text-xs font-bold text-[#4E311E] focus:outline-none focus:border-[#4E311E]"
            >
              <option value="ALL">{tx('Tất cả danh mục', 'All Categories')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {tText(c.name)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Các nút bấm lọc nhanh trạng thái tồn kho */}
        {tab === 'PRODUCTS' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-[#8C6A50] font-bold mr-1">{tx('Tình trạng:', 'Filter:')}</span>
            {[
              { id: 'ALL', label: tx('Tất cả', 'All') },
              { id: 'AVAILABLE', label: tx('Đang bán', 'Available') },
              { id: 'UNAVAILABLE', label: tx('Tạm ngưng', 'Paused') },
              { id: 'LOW_STOCK', label: tx('Sắp hết (≤10)', 'Low Stock') },
              { id: 'OUT_OF_STOCK', label: tx('Hết hàng (0)', 'Out of Stock') },
              { id: 'UNLIMITED', label: tx('Không giới hạn (∞)', 'Unlimited') },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setStockFilter(f.id as StockFilterType);
                  setProdPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-full font-bold text-xs border transition-colors ${
                  stockFilter === f.id
                    ? 'bg-[#4E311E] text-white border-[#4E311E]'
                    : 'bg-[#FCF9F2] text-[#4E311E] border-[#C9B29B] hover:bg-[#F3ECE1]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* DANH SÁCH SẢN PHẨM */}
      {tab === 'PRODUCTS' && (
        <div className="space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="rounded-2xl bg-[#FCF9F2] border border-dashed border-[#B59478] p-12 text-center">
              <div className="text-3xl mb-2">📦</div>
              <div className="text-sm font-extrabold text-[#4E311E]">
                {tx('Không tìm thấy sản phẩm nào phù hợp', 'No products found')}
              </div>
              <div className="text-xs text-[#8C6A50] mt-1">
                {tx('Vui lòng thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt bộ lọc.', 'Try adjusting your search or filters.')}
              </div>
            </div>
          ) : (
            <>
              {pagedProducts.map((prod) => {
                const draftVal = stockDrafts[prod.id] ?? (prod.stockQty === null ? '' : String(prod.stockQty));
                const isSubmitting = submittingIds[prod.id] ?? false;

                // Phân loại trạng thái tồn kho
                const isUnlimited = prod.stockQty === null;
                const isOutOfStock = prod.stockQty === 0;
                const isLowStock = prod.stockQty !== null && prod.stockQty > 0 && prod.stockQty <= 10;

                return (
                  <div
                    key={prod.id}
                    className={`rounded-2xl bg-[#FCF9F2] border transition-all p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm ${
                      !prod.isAvailable || isOutOfStock
                        ? 'border-[#C9B29B] opacity-90'
                        : 'border-[#B59478]'
                    }`}
                  >
                    {/* Thông tin sản phẩm */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      {/* Ảnh đại diện / Icon */}
                      <div className="w-12 h-12 rounded-xl bg-[#F3ECE1] border border-[#C9B29B] flex items-center justify-center shrink-0 overflow-hidden text-xl">
                        {prod.imageUrl ? (
                          <img
                            src={prod.imageUrl}
                            alt={tText(prod.name)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>🧋</span>
                        )}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-sm sm:text-base text-[#4E311E] truncate">
                            {tText(prod.name)}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#F3ECE1] border border-[#C9B29B] text-[#6E4F3A] text-[10px] font-bold">
                            {prod.categoryName}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E4F3A]">
                          {prod.priceVnd > 0 && (
                            <span className="font-extrabold text-[#B83B2A]">{money(prod.priceVnd)}</span>
                          )}

                          <span className="text-[#9B7B60]">·</span>

                          {/* Huy hiệu tình trạng tồn kho */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#8C6A50] font-semibold">{tx('Tồn kho:', 'Stock:')}</span>
                            {isUnlimited && (
                              <span
                                className="px-2.5 py-0.5 rounded-full bg-[#E8F3EB] text-[#1F5C32] font-bold text-[11px] border border-[#A6D4B0] flex items-center gap-1"
                                title={tx('Không kiểm đếm số lượng, khách có thể đặt liên tục', 'Unlimited stock, no inventory cap')}
                              >
                                <span>∞</span>
                                <span>{tx('Không giới hạn', 'Unlimited')}</span>
                              </span>
                            )}
                            {isOutOfStock && (
                              <span
                                className="px-2.5 py-0.5 rounded-full bg-[#FCEBE9] text-[#B83B2A] font-extrabold text-[11px] border border-[#F3B8B2] flex items-center gap-1"
                                title={tx('Số lượng tồn bằng 0, không thể nhận đơn', 'Out of stock, cannot take orders')}
                              >
                                <span>🚫</span>
                                <span>{tx('Hết hàng (0)', 'Out of Stock (0)')}</span>
                              </span>
                            )}
                            {isLowStock && (
                              <span
                                className="px-2.5 py-0.5 rounded-full bg-[#FFF4E5] text-[#A85D00] font-extrabold text-[11px] border border-[#FAD6A5] flex items-center gap-1"
                                title={tx('Tồn kho thấp hơn mức an toàn (≤10)', 'Stock is running low (≤10)')}
                              >
                                <span>⚠️</span>
                                <span>{tx(`Sắp hết (${prod.stockQty} phần)`, `Low (${prod.stockQty} left)`)}</span>
                              </span>
                            )}
                            {!isUnlimited && !isOutOfStock && !isLowStock && (
                              <span className="px-2.5 py-0.5 rounded-full bg-[#F3ECE1] text-[#4E311E] font-extrabold text-[11px] border border-[#C9B29B] flex items-center gap-1">
                                <span>📦</span>
                                <span>{tx(`Còn ${prod.stockQty} phần`, `${prod.stockQty} in stock`)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Khu vực thao tác: Công tắc mở bán & Điều chỉnh tồn kho */}
                    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-[#E5D7C7]">
                      {/* Công tắc Bật / Tắt mở bán */}
                      <label
                        className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-full border border-[#C9B29B] shadow-2xs hover:border-[#4E311E] transition-colors"
                        title={prod.isAvailable ? tx('Đang mở bán trên menu - Nhấn để tạm ngưng', 'Currently serving - Click to pause') : tx('Đang tạm ngưng bán - Nhấn để mở bán lại', 'Paused - Click to serve')}
                      >
                        <input
                          type="checkbox"
                          disabled={isSubmitting}
                          className="toggle toggle-success toggle-sm"
                          checked={prod.isAvailable}
                          onChange={(e) => void handleToggleProductAvailable(prod, e.target.checked)}
                        />
                        <span className={`text-xs font-bold ${prod.isAvailable ? 'text-[#1F5C32]' : 'text-[#8C6A50]'}`}>
                          {prod.isAvailable ? tx('Đang bán', 'Serving') : tx('Tạm ngưng', 'Paused')}
                        </span>
                      </label>

                      {/* Bộ điều chỉnh số lượng tồn kho */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Nhập số lượng & nút Lưu */}
                        <div className="inline-flex items-center gap-1.5 bg-white p-1 pl-2.5 rounded-full border border-[#C9B29B] shadow-2xs focus-within:border-[#4E311E]">
                          <span className="text-xs font-bold text-[#6E4F3A]">{tx('SL:', 'Qty:')}</span>
                          <input
                            type="number"
                            min={0}
                            disabled={isSubmitting}
                            placeholder={isUnlimited ? tx('Vô hạn', 'Unlimited') : '0'}
                            className="w-16 px-2 py-1 rounded-full bg-[#FCF9F2] border border-[#C9B29B] text-center font-mono font-bold text-xs text-[#4E311E] focus:outline-none focus:border-[#4E311E] disabled:bg-gray-100"
                            value={draftVal}
                            onChange={(e) =>
                              setStockDrafts({ ...stockDrafts, [prod.id]: e.target.value })
                            }
                          />
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => {
                              const raw = stockDrafts[prod.id];
                              const parsed =
                                raw === undefined || raw.trim() === ''
                                  ? prod.stockQty
                                  : Number(raw);

                              if (parsed === 0) {
                                setPendingConfirm({
                                  prod,
                                  nextStockQty: 0,
                                  title: tx('Xác nhận báo hết hàng (tồn kho = 0)?', 'Confirm Mark Out of Stock (0)?'),
                                  message: tx(
                                    `Món "${tText(prod.name)}" sẽ được đặt số lượng tồn kho về 0. Khách hàng sẽ không thể đặt món này khi hết hàng.`,
                                    `Item "${tText(prod.name)}" will be set to 0 stock. Customers will not be able to order this item.`,
                                  ),
                                  confirmLabel: tx('Xác nhận báo hết (0)', 'Confirm Out of Stock'),
                                  isDanger: true,
                                });
                              } else {
                                void handleUpdateStock(prod, parsed);
                              }
                            }}
                            className="px-3 py-1 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                            title={tx('Lưu số lượng tồn kho đã nhập', 'Save entered stock quantity')}
                          >
                            {isSubmitting ? (
                              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span>✓</span>
                            )}
                            <span>{tx('Lưu', 'Save')}</span>
                          </button>
                        </div>

                        {/* Nút bấm nhanh Vô hạn (∞) - Thay vì chỉ ký hiệu đơn lẻ */}
                        <button
                          type="button"
                          disabled={isSubmitting || prod.stockQty === null}
                          onClick={() => {
                            setPendingConfirm({
                              prod,
                              nextStockQty: null,
                              title: tx('Xác nhận đặt tồn kho Không giới hạn?', 'Confirm Unlimited Stock?'),
                              message: tx(
                                `Món "${tText(prod.name)}" sẽ chuyển sang chế độ không giới hạn số lượng (không theo dõi kiểm đếm tồn kho, khách có thể đặt liên tục).`,
                                `Item "${tText(prod.name)}" will be set to unlimited stock (untracked, customers can order continuously).`,
                              ),
                              confirmLabel: tx('Đặt không giới hạn (∞)', 'Set Unlimited (∞)'),
                              isDanger: false,
                            });
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                            prod.stockQty === null
                              ? 'bg-[#E8F3EB] text-[#1F5C32] border-[#A6D4B0] opacity-60 cursor-not-allowed'
                              : 'border-[#9B7B60] bg-[#FCF9F2] text-[#4E311E] hover:bg-[#4E311E] hover:text-white'
                          }`}
                          title={
                            prod.stockQty === null
                              ? tx('Món này hiện đang ở trạng thái Không giới hạn', 'Item is currently unlimited')
                              : tx('Đặt tồn kho thành Không giới hạn số lượng', 'Set stock to unlimited quantity')
                          }
                        >
                          ∞ {tx('Không giới hạn', 'Unlimited')}
                        </button>

                        {/* Nút bấm nhanh Báo hết hàng (0) - Thay vì chỉ số "0" đơn lẻ */}
                        <button
                          type="button"
                          disabled={isSubmitting || prod.stockQty === 0}
                          onClick={() => {
                            setPendingConfirm({
                              prod,
                              nextStockQty: 0,
                              title: tx('Xác nhận báo hết hàng (tồn kho = 0)?', 'Confirm Mark Out of Stock (0)?'),
                              message: tx(
                                `Món "${tText(prod.name)}" sẽ được điều chỉnh tồn kho về 0 và tự động chuyển sang tạm ngưng bán.`,
                                `Item "${tText(prod.name)}" will be set to 0 stock and paused from orders.`,
                              ),
                              confirmLabel: tx('Xác nhận báo hết', 'Confirm Out of Stock'),
                              isDanger: true,
                            });
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                            prod.stockQty === 0
                              ? 'bg-[#FCEBE9] text-[#B83B2A] border-[#F3B8B2] opacity-60 cursor-not-allowed'
                              : 'bg-[#B83B2A] text-white border-[#B83B2A] hover:bg-[#8F2D1F]'
                          }`}
                          title={
                            prod.stockQty === 0
                              ? tx('Món này hiện đang hết hàng (tồn kho = 0)', 'Item is currently out of stock')
                              : tx('Báo hết hàng ngay lập tức (đặt số lượng tồn kho về 0)', 'Mark out of stock immediately (set stock to 0)')
                          }
                        >
                          🚫 {tx('Báo hết (0)', 'Out of Stock (0)')}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <Pagination
                page={prodPage}
                pageSize={pageSize}
                totalItems={filteredProducts.length}
                onPageChange={setProdPage}
              />
            </>
          )}
        </div>
      )}

      {/* DANH SÁCH TOPPING */}
      {tab === 'TOPPINGS' && (
        <div className="space-y-3">
          {toppings.length === 0 ? (
            <div className="rounded-2xl bg-[#FCF9F2] border border-[#B59478] p-10 text-center space-y-2">
              <div className="text-3xl">🔒</div>
              <div className="text-sm font-extrabold text-[#4E311E]">
                {tx('Danh sách Topping yêu cầu quyền Quản trị viên', 'Topping management requires Admin role')}
              </div>
              <p className="text-xs text-[#8C6A50] max-w-md mx-auto">
                {tx(
                  'Tài khoản hiện tại có thể điều chỉnh trạng thái topping khi được cấp quyền quản lý thực đơn (menu.manage).',
                  'Your account needs menu management permissions (menu.manage) to manage toppings.',
                )}
              </p>
            </div>
          ) : filteredToppings.length === 0 ? (
            <div className="rounded-2xl bg-[#FCF9F2] border border-dashed border-[#B59478] p-10 text-center">
              <div className="text-sm font-extrabold text-[#4E311E]">
                {tx('Không tìm thấy topping phù hợp', 'No toppings found')}
              </div>
            </div>
          ) : (
            <>
              {pagedToppings.map((top) => {
                const isSubmitting = submittingIds[top.id] ?? false;
                return (
                  <div
                    key={top.id}
                    className="rounded-2xl bg-[#FCF9F2] border border-[#B59478] p-4 flex items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F3ECE1] border border-[#C9B29B] flex items-center justify-center shrink-0 text-lg">
                        🍮
                      </div>
                      <div>
                        <div className="font-black text-sm sm:text-base text-[#4E311E] flex items-center gap-2">
                          <span>{tText(top.name)}</span>
                          {top.isAvailable ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-[#E8F3EB] text-[#1F5C32] text-[10px] font-bold border border-[#A6D4B0]">
                              {tx('Đang có sẵn', 'Available')}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-[#FCEBE9] text-[#B83B2A] text-[10px] font-bold border border-[#F3B8B2]">
                              {tx('Tạm hết', 'Out of stock')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-black text-[#B83B2A] mt-0.5">
                          +{money(top.priceVnd)}
                        </div>
                      </div>
                    </div>

                    <label
                      className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-full border border-[#C9B29B] shadow-2xs hover:border-[#4E311E] transition-colors"
                      title={top.isAvailable ? tx('Đang có sẵn - Nhấn để báo tạm hết', 'Available - Click to mark out of stock') : tx('Đang tạm hết - Nhấn để mở lại', 'Out of stock - Click to make available')}
                    >
                      <input
                        type="checkbox"
                        disabled={isSubmitting}
                        className="toggle toggle-success toggle-sm"
                        checked={top.isAvailable}
                        onChange={(e) => void handleToggleToppingAvailable(top, e.target.checked)}
                      />
                      <span className={`text-xs font-bold ${top.isAvailable ? 'text-[#1F5C32]' : 'text-[#8C6A50]'}`}>
                        {top.isAvailable ? tx('Có sẵn', 'Serving') : tx('Tạm hết', 'Unavailable')}
                      </span>
                    </label>
                  </div>
                );
              })}

              <Pagination
                page={topPage}
                pageSize={pageSize}
                totalItems={filteredToppings.length}
                onPageChange={setTopPage}
              />
            </>
          )}
        </div>
      )}

      {/* Modal Xác nhận Điều chỉnh tồn kho quan trọng */}
      {pendingConfirm && (
        <div className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px] max-w-md">
            <h3 className="font-bold text-lg text-[#4E311E] mb-2">
              {pendingConfirm.title}
            </h3>
            <p className="text-xs text-[#6E4F3A]">
              {pendingConfirm.message}
            </p>
            <div className="modal-action">
              <button
                type="button"
                className="px-4 py-2 rounded-full border border-[#9B7B60] text-xs font-bold text-[#4E311E] hover:bg-[#F3ECE1] transition-colors"
                onClick={() => setPendingConfirm(null)}
              >
                {tx('Hủy', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingConfirm;
                  setPendingConfirm(null);
                  void handleUpdateStock(target.prod, target.nextStockQty);
                }}
                className={`px-5 py-2 rounded-full text-white text-xs font-bold transition-all shadow-sm ${
                  pendingConfirm.isDanger
                    ? 'bg-[#B83B2A] hover:bg-[#9E2F20]'
                    : 'bg-[#4E311E] hover:bg-[#3D2517]'
                }`}
              >
                {pendingConfirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
