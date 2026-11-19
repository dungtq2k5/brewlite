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
          <>
            {/* Dimmed under the badge, as drawn (D02). */}
            <div aria-hidden className="bg-base-100/45 absolute inset-0" />
            <span className="bg-neutral text-neutral-content absolute top-3 left-3 rounded-lg px-2.5 py-0.5 text-[0.8125rem] font-semibold">
              {labels.soldOut}
            </span>
          </>
        )}
      </div>
      {/* The frame also fades the name and price to 60 %, below the text contrast minimum
          (WCAG 1.4.3) — the image alone is dimmed. */}
      <p className="mt-2 px-1 text-[15px] leading-5.5 font-semibold">{name}</p>
      <p className="px-1 text-[15px] leading-5.5">
        <span className="text-base-content/70 text-[13px] leading-5">{labels.from}</span>{' '}
        <span className="font-bold tabular-nums">{formatVnd(product.fromPriceVnd, locale)}</span>
      </p>
    </Link>
  );
}
