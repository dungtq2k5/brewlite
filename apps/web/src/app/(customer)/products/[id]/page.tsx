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
export async function generateMetadata({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
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
    <div className="pb-32 lg:pb-0">
      <BackToMenu label={t('product.back')} />
      <div className="mt-3 lg:grid lg:grid-cols-2 lg:gap-12">
        <div>
          <div className="rounded-box relative aspect-[16/10] overflow-hidden lg:aspect-[4/3]">
            <ProductImage imageUrl={product.imageUrl} name={name} variant={variant} iconSize={64} />
            {product.isSoldOut && (
              <span className="bg-neutral text-neutral-content absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-bold">
                {t('soldOut')}
              </span>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-6 lg:mt-0">
          <div>
            <h1 className="text-3xl font-bold">{name}</h1>
            {product.description && (
              <p className="text-base-content/80 mt-2">{localized(product.description, locale)}</p>
            )}
            {product.isSoldOut && <p className="mt-3 font-medium">{t('product.soldOutNote')}</p>}
          </div>
          <ProductOptions product={product} noPhoto={variant} />
        </div>
      </div>
    </div>
  );
}
