import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { localized, formatVnd } from '@/i18n/format';

interface MenuPageProps {
  searchParams: Promise<{ categoryId?: string }>;
}

async function fetchFromGateway(path: string) {
  const gatewayUrl =
    process.env.NEXT_PUBLIC_GATEWAY_URL || process.env.GATEWAY_URL || 'http://localhost:23100';
  try {
    const res = await fetch(`${gatewayUrl}${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function MenuPage({ searchParams }: MenuPageProps) {
  const { categoryId } = await searchParams;
  const cookieStore = await cookies();
  const locale = (cookieStore.get('bl_locale')?.value ??
    cookieStore.get('brewlite_lang')?.value ??
    'vi') as 'en' | 'vi';
  const isVi = locale === 'vi';

  const [catRes, prodRes] = await Promise.all([
    fetchFromGateway('/api/v1/categories'),
    fetchFromGateway(categoryId ? `/api/v1/products?categoryId=${categoryId}` : '/api/v1/products'),
  ]);

  const categories = catRes?.data || [];
  const products = prodRes?.data || [];

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-[#1F302B] text-white p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm">
        <div>
          <div className="text-[10px] sm:text-xs uppercase font-bold tracking-wider text-[#A3B899]">
            {isVi ? 'THỰC ĐƠN HÔM NAY' : "TODAY'S MENU"}
          </div>
          <div className="font-extrabold text-sm sm:text-base mt-1 text-white">
            {isVi ? 'Giảm 20.000 ₫ cho đơn từ 69.000 ₫' : 'Save 20,000 ₫ on orders from 69,000 ₫'}
          </div>
        </div>
        <span className="border border-[#446255] bg-[#283C35] text-white text-xs sm:text-sm font-mono font-bold px-3 py-1.5 rounded-xl shadow-xs">
          BREW20
        </span>
      </div>

      {/* Tabs danh mục */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
        <Link
          href="/"
          className={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 transition ${
            !categoryId
              ? 'bg-[#4E3427] text-white shadow-sm'
              : 'border border-[#D5C7B7] text-[#4E3427] hover:bg-[#EADFCF]/40'
          }`}
        >
          {isVi ? 'Tất cả' : 'All'}
        </Link>
        {Array.isArray(categories) &&
          categories.map((cat: any) => (
            <Link
              key={cat.id}
              href={`/?categoryId=${cat.id}`}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 transition ${
                categoryId === cat.id
                  ? 'bg-[#4E3427] text-white shadow-sm'
                  : 'border border-[#D5C7B7] text-[#4E3427] hover:bg-[#EADFCF]/40'
              }`}
            >
              {localized(cat.name, locale)}
            </Link>
          ))}
      </div>

      {/* Danh sách món ăn có hiển thị ảnh thật từ DB */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {Array.isArray(products) &&
          products.map((item: any) => {
            const itemName = localized(item.name, locale);
            const itemDesc = item.description ? localized(item.description, locale) : '';
            return (
              <div
                key={item.id}
                className={`bg-[#FDFBF9] border border-[#E8DEC8] rounded-2xl p-3.5 flex gap-3.5 items-center shadow-xs transition hover:shadow-sm ${
                  item.isSoldOut ? 'opacity-70 bg-[#FDFBF9]/60' : 'hover:border-[#4E3427]/40'
                }`}
              >
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl bg-[#EFE4D2] flex items-center justify-center shrink-0 relative overflow-hidden text-[#6B4F3B]">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={itemName}
                      width={80}
                      height={80}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <svg className="w-9 h-9 fill-current opacity-80" viewBox="0 0 24 24">
                      <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z" />
                    </svg>
                  )}
                  {item.isSoldOut && (
                    <div className="absolute inset-0 bg-[#2B1E16]/60 flex items-center justify-center">
                      <span className="text-white text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#B64A38]">
                        {isVi ? 'HẾT HÀNG' : 'SOLD OUT'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3
                    className="font-bold text-xs sm:text-sm text-[#2B1E16] truncate"
                    title={itemName}
                  >
                    {itemName}
                  </h3>
                  {itemDesc && (
                    <p className="text-[11px] text-[#8C7E74] truncate mt-0.5">{itemDesc}</p>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs sm:text-sm font-bold text-[#C8382B]">
                      {isVi ? 'từ ' : 'from '}
                      {formatVnd(item.fromPriceVnd, locale)}
                    </span>

                    {item.isSoldOut ? (
                      <button
                        disabled
                        className="border border-[#C8382B] text-[#C8382B] text-[10px] font-bold px-2.5 py-1 rounded-full bg-white"
                      >
                        {isVi ? 'Đã hết' : 'Sold out'}
                      </button>
                    ) : (
                      <Link
                        href={`/products/${item.id}`}
                        className="w-7 h-7 rounded-full bg-[#4E3427] hover:bg-[#3D281E] text-white flex items-center justify-center text-sm font-bold shadow-sm transition"
                      >
                        +
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
