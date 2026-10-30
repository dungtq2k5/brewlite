'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_QTY_PER_LINE, type ProductSize } from '@brewlite/contracts';
import type { ProductDetailResponseDto } from '@brewlite/api-client';
import { localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { keyOf, type NewLine } from '@/lib/cart/cart';
import { useCart } from '@/lib/cart/CartProvider';
import { addState, addTotalVnd, sortSizes } from '@/lib/product-options';
import { useCameFromMenu } from '../PathTracker';
import { useToast } from '../Toast';
import { AddBar } from './AddBar';
import { SizePicker } from './SizePicker';
import { ToppingPicker } from './ToppingPicker';

/**
 * Size, toppings, quantity and the add button of a product. The price follows every tap; *Add*
 * puts the line in the cart, then returns to the menu where the customer left it, with the toast.
 */
export function ProductOptions({
  product,
  noPhoto,
}: Readonly<{ product: ProductDetailResponseDto; noPhoto: number }>) {
  const { t, i18n } = useTranslation('menu');
  const locale = i18n.language as Locale;
  const router = useRouter();
  const showToast = useToast();
  const cameFromMenu = useCameFromMenu();
  const { cart, ready, add } = useCart();

  const sizes = useMemo(() => sortSizes(product.sizes), [product.sizes]);
  const [size, setSize] = useState<string>(sizes[0]?.size ?? '');
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);

  const name = localized(product.name, locale);
  const sizeDelta = sizes.find((s) => s.size === size)?.priceDeltaVnd ?? 0;
  const chosenToppings = product.toppings.filter((topping) => chosen.has(topping.id));

  const line = {
    productId: product.id,
    categoryId: product.categoryId,
    noPhoto,
    name: product.name,
    imageUrl: product.imageUrl,
    size: size as ProductSize,
    basePriceVnd: product.basePriceVnd,
    sizeDeltaVnd: sizeDelta,
    toppings: chosenToppings.map((tp) => ({ id: tp.id, name: tp.name, priceVnd: tp.priceVnd })),
  } satisfies NewLine;
  const key = keyOf(line);

  const state = addState(product.isSoldOut, ready, cart, key);
  const total = addTotalVnd(
    product.basePriceVnd,
    sizeDelta,
    chosenToppings.map((tp) => tp.priceVnd),
    quantity,
  );

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < product.maxToppings) next.add(id);
      return next;
    });

  const onAdd = () => {
    if (state !== 'ready') return;
    setPending(true);
    const { added } = add(line, quantity);
    if (added === 0) {
      setPending(false);
      return;
    }
    showToast(
      added < quantity
        ? {
            message: t('product.toast.capped', { count: added, max: MAX_QTY_PER_LINE }),
            action: { label: t('product.toast.viewCart'), href: '/cart' },
          }
        : {
            message: t('product.toast.added'),
            action: { label: t('product.toast.viewCart'), href: '/cart' },
          },
    );
    // The browser restores the menu's scroll on back; a product opened by a link goes to `/`.
    if (cameFromMenu()) router.back();
    else router.push('/');
  };

  return (
    <div className="flex flex-col gap-6">
      <SizePicker
        choices={sizes.map((s) => ({
          size: s.size,
          priceVnd: product.basePriceVnd + s.priceDeltaVnd,
        }))}
        value={size}
        onChange={setSize}
      />
      <ToppingPicker
        choices={product.toppings}
        chosen={chosen}
        max={product.maxToppings}
        onToggle={toggle}
      />
      <AddBar
        state={state}
        quantity={quantity}
        onQuantity={setQuantity}
        totalVnd={total}
        name={name}
        pending={pending}
        onAdd={onAdd}
      />
    </div>
  );
}
