'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart, MAX_TOPPINGS_PER_LINE } from '@/context/CartContext';
import { localized, formatVnd } from '@/i18n/format';

interface Props {
  product: any;
  locale: 'vi' | 'en';
}

export default function ProductDetailClient({ product, locale }: Props) {
  const router = useRouter();
  const { addItem } = useCart();

  const [size, setSize] = useState<'S' | 'M' | 'L'>('M');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [qty, setQty] = useState(1);

  const pName = localized(product.name, locale);
  const pDesc = product.description ? localized(product.description, locale) : '';

  const basePrice = Number(
    product.fromPriceVnd ?? product.basePriceVnd ?? product.priceVnd ?? product.price ?? 0,
  );

  const sizeOption = (product.sizes || []).find((s: any) => s.size === size);
  const sizeDeltaVnd = Number(sizeOption?.deltaVnd || sizeOption?.price || 0);

  const toppingsList = product.toppings || [];
  const selectedToppingObjects = toppingsList.filter((t: any) => selectedToppings.includes(t.id));
  const toppingsPriceVnd = selectedToppingObjects.reduce(
    (acc: number, t: any) => acc + Number(t.priceVnd || t.price || 0),
    0,
  );

  const unitPriceVnd = basePrice + sizeDeltaVnd + toppingsPriceVnd;

  const toggleTopping = (toppingId: string) => {
    if (selectedToppings.includes(toppingId)) {
      setSelectedToppings((prev) => prev.filter((i) => i !== toppingId));
    } else {
      if (selectedToppings.length >= MAX_TOPPINGS_PER_LINE) return;
      setSelectedToppings((prev) => [...prev, toppingId]);
    }
  };

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      size,
      toppingIds: selectedToppings,
      toppingNames: selectedToppingObjects.map((t: any) => t.name),
      qty,
      basePriceVnd: basePrice,
      sizeDeltaVnd,
      toppingsPriceVnd,
    });
    // Quay lại trang chủ sau khi thêm vào giỏ
    router.push('/');
  };

  return (
    <div className="bg-[#FDFBF9] border border-[#E8DEC8] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
      <div className="space-y-2 text-center sm:text-left border-b border-[#E8DEC8] pb-4">
        <h1 className="text-xl sm:text-2xl font-black text-[#2B1E16]">{pName}</h1>
        {pDesc && <p className="text-xs sm:text-sm text-[#8C7E74]">{pDesc}</p>}
        <div className="text-lg sm:text-xl font-black text-[#C8382B] pt-1">
          {formatVnd(unitPriceVnd, locale)}
        </div>
      </div>

      {product.sizes && product.sizes.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-extrabold uppercase text-[#2B1E16] tracking-wider">
            {locale === 'vi' ? 'Chọn kích thước' : 'Select Size'}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {product.sizes.map((s: any) => (
              <button
                type="button"
                key={s.size}
                onClick={() => setSize(s.size)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center ${
                  size === s.size
                    ? 'border-[#4E3427] bg-[#4E3427] text-white shadow-xs'
                    : 'border-[#D5C7B7] bg-white text-[#4E3427] hover:bg-[#EADFCF]/40'
                }`}
              >
                <span>Size {s.size}</span>
                <span className="text-[10px] opacity-80 font-normal">
                  {(s.deltaVnd || s.price || 0) > 0
                    ? `+${formatVnd(s.deltaVnd || s.price, locale)}`
                    : locale === 'vi'
                      ? 'Tiêu chuẩn'
                      : 'Standard'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {toppingsList.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-extrabold uppercase text-[#2B1E16] tracking-wider">
              {locale === 'vi'
                ? `Thêm Topping (Tối đa ${MAX_TOPPINGS_PER_LINE})`
                : `Add Toppings (Max ${MAX_TOPPINGS_PER_LINE})`}
            </label>
            <span className="text-[11px] text-[#8C7E74]">
              {locale === 'vi'
                ? `Đã chọn ${selectedToppings.length}/${MAX_TOPPINGS_PER_LINE}`
                : `Selected ${selectedToppings.length}/${MAX_TOPPINGS_PER_LINE}`}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {toppingsList.map((t: any) => {
              const checked = selectedToppings.includes(t.id);
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => toggleTopping(t.id)}
                  className={`p-3 rounded-xl border text-left text-xs font-semibold flex justify-between items-center transition ${
                    checked
                      ? 'border-[#4E3427] bg-[#F4EDE2] text-[#4E3427]'
                      : 'border-[#E8DEC8] bg-white text-[#2B1E16] hover:bg-[#FDFBF9]'
                  }`}
                >
                  <span>{localized(t.name, locale)}</span>
                  <span className="font-bold text-[#C8382B]">
                    +{formatVnd(t.priceVnd || t.price || 0, locale)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-[#E8DEC8] flex items-center justify-between gap-4">
        <div className="flex items-center border border-[#D5C7B7] rounded-xl overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-9 h-9 flex items-center justify-center font-bold text-[#4E3427] hover:bg-[#EADFCF]/40"
          >
            -
          </button>
          <span className="w-10 text-center text-xs font-bold text-[#2B1E16]">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="w-9 h-9 flex items-center justify-center font-bold text-[#4E3427] hover:bg-[#EADFCF]/40"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          className="flex-1 py-3 px-6 bg-[#4E3427] hover:bg-[#3D281E] text-white font-bold rounded-2xl text-xs sm:text-sm shadow-sm transition flex justify-between items-center"
        >
          <span>{locale === 'vi' ? 'Thêm vào giỏ hàng' : 'Add to Cart'}</span>
          <span>{formatVnd(unitPriceVnd * qty, locale)}</span>
        </button>
      </div>
    </div>
  );
}
