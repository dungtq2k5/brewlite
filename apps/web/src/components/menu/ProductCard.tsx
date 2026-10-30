import Link from 'next/link';
import type { ProductSummaryResponseDto } from '@brewlite/api-client';
import { formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { ProductImage } from './ProductImage';

export interface ProductCardLabels {
  from: string;
  soldOut: string;
}

/**
 * A link to the product, a sold-out one included (it still opens — D02 §2.2). The image area is
 * a fixed 1:1 frame, so a lazy photo never moves the page.
 */
export function ProductCard({
  product,
  variant,
  locale,
  labels,
}: Readonly<{
  product: ProductSummaryResponseDto;
  variant: number;
  locale: Locale;
  labels: ProductCardLabels;
}>) {
  const name = localized(product.name, locale);
  return (
    // No viewport prefetch: each prefetched product page still runs `generateMetadata` — one
    // public gateway call per card on screen, against a limit of 120 a minute per address.
    <Link
      href={`/products/${product.id}`}
      prefetch={false}
      className="group block rounded-box focus-visible:outline-offset-4"
    >
      <div className="rounded-box relative aspect-square overflow-hidden">
        <ProductImage imageUrl={product.imageUrl} name={name} variant={variant} />
        {product.isSoldOut && (
          <span className="bg-neutral text-neutral-content absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-bold">
            {labels.soldOut}
          </span>
        )}
      </div>
      <p className="mt-2 px-1 text-sm font-semibold">{name}</p>
      <p className="px-1 text-sm">
        <span className="text-base-content/70">{labels.from}</span>{' '}
        <span className="font-bold tabular-nums">{formatVnd(product.fromPriceVnd, locale)}</span>
      </p>
    </Link>
  );
}
