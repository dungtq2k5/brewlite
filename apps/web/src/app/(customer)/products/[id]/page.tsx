import { Info } from 'lucide-react';
import { notFound } from 'next/navigation';
import {
  ApiClientError,
  categoriesControllerList,
  productsControllerGet,
  type ProductDetailResponseDto,
} from '@brewlite/api-client';
import { BackToMenu } from '@/components/product/BackToMenu';
import { ProductImage } from '@/components/menu/ProductImage';
import { ProductOptions } from '@/components/product/ProductOptions';
import { getLocale, getT } from '@/i18n/server';
import { localized } from '@/i18n/format';
import { noPhotoVariant } from '@/lib/menu';
import { withRequestId } from '@/lib/with-request-id';
import type { Metadata } from 'next';

async function loadProduct(id: string): Promise<ProductDetailResponseDto> {
  try {
    const res = await productsControllerGet(id);
    if (res.status === 200 && res.data.data) return res.data.data;
  } catch (error) {
    // A malformed id (400) and a missing product (404) are the same page: not found.
    if (
      error instanceof ApiClientError &&
      (error.status === 400 || error.code === 'RESOURCE_NOT_FOUND')
    ) {
      notFound();
    }
    throw withRequestId(error);
  }
  throw new Error('GET /products/:id answered without a product');
}

/** `generateMetadata` and the page both read the product; this keeps it to one call per request. */
export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>): Promise<Metadata> {
  const { id } = await params;
  const [product, locale] = await Promise.all([loadProduct(id), getLocale()]);
  return { title: localized(product.name, locale) };
}

export default async function ProductPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const [product, categories, locale, { t }] = await Promise.all([
    loadProduct(id),
    // Only the category's place decides the no-photo look; losing it is not worth failing the page.
    categoriesControllerList().catch(() => null),
    getLocale(),
    getT('menu'),
  ]);
  const position = Math.max(
    0,
    (categories?.status === 200 ? (categories.data.data ?? []) : []).findIndex(
      (c) => c.id === product.categoryId,
    ),
  );
  const variant = noPhotoVariant(position);
  const name = localized(product.name, locale);

  return (
    <div>
      <BackToMenu label={t('product.back')} />
      <div className="mt-5 lg:mt-4 lg:grid lg:grid-cols-[35fr_32fr] lg:items-start lg:gap-12">
        <div>
          <div className="rounded-box relative aspect-16/10 overflow-hidden lg:aspect-4/3">
            <ProductImage imageUrl={product.imageUrl} name={name} variant={variant} />
            {product.isSoldOut && (
              <span className="bg-neutral text-neutral-content rounded-selector absolute top-3 left-3 px-2.5 py-1 text-[13px] leading-[18px] font-semibold">
                {t('soldOut')}
              </span>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-5 lg:mt-0 lg:gap-6">
          <div>
            <h1 className="text-[28px] leading-9 font-bold lg:text-4xl lg:leading-11">{name}</h1>
            {product.description && (
              <p className="text-base-content/75 mt-1.5 lg:mt-2 lg:text-[17px] lg:leading-[26px]">
                {localized(product.description, locale)}
              </p>
            )}
            {product.isSoldOut && (
              <p className="mt-1.5 flex items-center gap-2 text-[15px] leading-[22px] font-semibold">
                <Info aria-hidden size={18} className="shrink-0" />
                {t('product.soldOutNote')}
              </p>
            )}
          </div>
          <ProductOptions product={product} noPhoto={variant} />
        </div>
      </div>
    </div>
  );
}
