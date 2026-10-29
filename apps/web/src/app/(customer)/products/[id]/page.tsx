import Link from 'next/link';
import {
  ApiClientError,
  categoriesControllerList,
  productsControllerGet,
  type CategoryResponseDto,
  type ProductDetailResponseDto,
} from '@brewlite/api-client';
import { EmptyState } from '@/components/vellum/EmptyState';
import { localized } from '@/i18n/format';
import { getLocale } from '@/i18n/locale.server';
import { unwrap } from '@/lib/api-server';
import ProductDetailClient from './ProductDetailClient';

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const [{ id }, locale] = await Promise.all([params, getLocale()]);
  const isVi = locale === 'vi';

  let product: ProductDetailResponseDto | null = null;
  let notFound = false;

  try {
    const response = await productsControllerGet(id);
    product = unwrap<ProductDetailResponseDto>(response.data);
  } catch (error) {
    // A malformed id is a 400/422; a deleted or unknown one is a 404. None of
    // them is a catalog outage, so they must not read as "try again later".
    notFound =
      error instanceof ApiClientError &&
      (error.status === 400 || error.status === 404 || error.status === 422);
  }

  if (!product) {
    return (
      <>
        <nav className="breadcrumb" aria-label={isVi ? 'Đường dẫn' : 'Breadcrumb'}>
          <Link href="/">{isVi ? 'Thực đơn' : 'Menu'}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{isVi ? 'Không tìm thấy' : 'Not found'}</span>
        </nav>

        <EmptyState
          title={
            notFound
              ? isVi
                ? 'Không tìm thấy món này'
                : 'This item was not found'
              : isVi
                ? 'Không tải được món'
                : 'The item could not be loaded'
          }
          action={
            <Link className="btn btn--primary" href="/">
              {isVi ? 'Quay lại thực đơn' : 'Back to the menu'}
            </Link>
          }
        >
          {notFound
            ? isVi
              ? 'Món có thể đã ngừng bán hoặc đường dẫn không còn đúng.'
              : 'The item may no longer be on sale, or the link is out of date.'
            : isVi
              ? 'Catalog chưa phản hồi. Thử lại sau ít phút.'
              : 'The catalog did not respond. Try again in a moment.'}
        </EmptyState>
      </>
    );
  }

  let category: CategoryResponseDto | null = null;
  try {
    const response = await categoriesControllerList();
    category =
      unwrap<CategoryResponseDto[]>(response.data).find((row) => row.id === product.categoryId) ??
      null;
  } catch {
    // The breadcrumb loses its category step, the page still renders.
  }

  const productName = localized(product.name, locale);

  return (
    <>
      <nav className="breadcrumb" aria-label={isVi ? 'Đường dẫn' : 'Breadcrumb'}>
        <Link href="/">{isVi ? 'Thực đơn' : 'Menu'}</Link>
        <span aria-hidden="true">/</span>
        {category && (
          <>
            <Link href={`/?categoryId=${category.id}`}>{localized(category.name, locale)}</Link>
            <span aria-hidden="true">/</span>
          </>
        )}
        <span aria-current="page">{productName}</span>
      </nav>

      <ProductDetailClient product={product} locale={locale} />
    </>
  );
}
