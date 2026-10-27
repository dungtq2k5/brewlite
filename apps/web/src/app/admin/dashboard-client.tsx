'use client';

import Link from 'next/link';
import { useLocale } from '@/i18n/locale-context';
import type { MockCategory, MockOrder, MockProduct, MockPromotion, MockTopping, MockUser } from '@/mocks/admin-data';

interface DashboardClientProps {
  users: MockUser[];
  categories: MockCategory[];
  toppings: MockTopping[];
  products: MockProduct[];
  promotions: MockPromotion[];
  orders: MockOrder[];
}

export function DashboardClient({
  users,
  categories,
  toppings,
  products,
  promotions,
  orders,
}: DashboardClientProps) {
  const { tx, tText, money, dateTime } = useLocale();

  const cards = [
    {
      title: tx('Người dùng', 'Users'),
      icon: '👤',
      value: tx(`${users.length} tài khoản`, `${users.length} accounts`),
      sub: tx(
        `${users.filter((u) => u.isLocked).length} tài khoản đang khóa`,
        `${users.filter((u) => u.isLocked).length} locked accounts`,
      ),
      href: '/admin/users',
    },
    {
      title: tx('Danh mục & Topping', 'Categories & Toppings'),
      icon: '📂',
      value: tx(
        `${categories.filter((c) => !c.deletedAt).length} danh mục`,
        `${categories.filter((c) => !c.deletedAt).length} categories`,
      ),
      sub: tx(
        `${toppings.filter((t) => !t.deletedAt).length} loại topping`,
        `${toppings.filter((t) => !t.deletedAt).length} active toppings`,
      ),
      href: '/admin/categories',
    },
    {
      title: tx('Thực đơn Sản phẩm', 'Products Menu'),
      icon: '🧋',
      value: tx(
        `${products.filter((p) => !p.deletedAt).length} món nước`,
        `${products.filter((p) => !p.deletedAt).length} products`,
      ),
      sub: tx(
        `${products.filter((p) => p.isAvailable && !p.deletedAt).length} món đang mở bán`,
        `${products.filter((p) => p.isAvailable && !p.deletedAt).length} available now`,
      ),
      href: '/admin/products',
    },
    {
      title: tx('Mã Khuyến mãi', 'Promotions'),
      icon: '🎟️',
      value: tx(
        `${promotions.filter((p) => !p.deletedAt).length} chương trình`,
        `${promotions.filter((p) => !p.deletedAt).length} campaigns`,
      ),
      sub: tx(
        `${promotions.filter((p) => p.isActive && !p.deletedAt).length} mã đang chạy`,
        `${promotions.filter((p) => p.isActive && !p.deletedAt).length} active codes`,
      ),
      href: '/admin/promotions',
    },
  ];

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="rounded-3xl bg-[#1E3329] text-[#F5EFE6] p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-widest text-[#C9B29B] font-bold">
            {tx('HỆ THỐNG QUẢN TRỊ BREWLITE', 'BREWLITE ADMINISTRATION')}
          </p>
          <h1 className="text-lg sm:text-xl font-extrabold">
            {tx(
              'Quản lý Vận hành, Thực đơn & Khuyến mãi',
              'Operations, Menu & Promotions Management',
            )}
          </h1>
        </div>
        <Link
          href="/staff/orders"
          prefetch={false}
          className="px-4 py-2 rounded-full bg-[#FCF9F2] text-[#1E3329] text-xs font-extrabold"
        >
          {tx('Bảng đơn đang xử lý →', 'Live Orders Board →')}
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            prefetch={false}
            className="rounded-3xl bg-[#FCF9F2] border border-[#B59478] p-4 flex items-center justify-between hover:border-[#4E311E] transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-[#F3ECE1] border border-[#C9B29B] flex items-center justify-center text-2xl shrink-0">
                {c.icon}
              </div>
              <div>
                <div className="text-xs font-semibold text-[#8C6A50]">{c.title}</div>
                <div className="text-lg font-extrabold text-[#4E311E]">{c.value}</div>
                <div className="text-xs text-[#B83B2A] font-semibold">{c.sub}</div>
              </div>
            </div>
            <span className="w-8 h-8 rounded-full bg-[#4E311E] text-white flex items-center justify-center font-bold shrink-0">
              →
            </span>
          </Link>
        ))}
      </div>

      <div className="rounded-[28px] bg-[#FCF9F2] border-[1.5px] border-[#B59478] p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-base text-[#4E311E]">
            {tx('Đơn hàng đang xử lý tại quầy', 'Active Counter Orders')}
          </h2>
          <Link
            href="/staff/orders"
            prefetch={false}
            className="text-xs font-bold text-[#B83B2A] hover:underline"
          >
            {tx('Mở bảng điều phối →', 'Open Live Board →')}
          </Link>
        </div>

        <div className="space-y-2.5">
          {orders.slice(0, 5).map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-dashed border-[#9B7B60] bg-[#F3ECE1] p-3.5 flex flex-wrap items-center justify-between gap-2"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#4E311E] text-white font-mono text-xs font-bold">
                    #{order.orderNo}
                  </span>
                  <span className="font-bold text-sm">{order.customerName}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#1F5C32] text-white text-[11px] font-bold">
                    {order.status}
                  </span>
                </div>
                <p className="text-xs text-[#6E4F3A] mt-1">
                  {order.lines
                    .map((l) => `${l.quantity}x ${tText(l.productName)} (${l.size})`)
                    .join(', ')}
                </p>
              </div>
              <div className="text-right">
                <div className="font-extrabold text-sm text-[#B83B2A]">{money(order.totalVnd)}</div>
                <div className="text-[11px] text-[#8C6A50]">{dateTime(order.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}