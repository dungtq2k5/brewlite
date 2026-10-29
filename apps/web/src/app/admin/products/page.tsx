import {
  adminCategoriesControllerList,
  adminProductsControllerList,
  adminToppingsControllerList,
  type AdminCategoryResponseDto,
  type AdminProductListItemResponseDto,
  type AdminToppingResponseDto,
} from '@brewlite/api-client';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { readPage } from '@/lib/api-server';
import { ADMIN_PAGE_SIZE, parsePageParam } from '@/lib/pagination';
import ProductsClient from './ProductsClient';

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    q?: string | string[];
    categoryId?: string | string[];
    deleted?: string | string[];
  }>;
}) {
  const params = await searchParams;
  let pageNumber = parsePageParam(params.page);
  const query = first(params.q).trim().slice(0, 100);
  const categoryId = first(params.categoryId);
  const deletedOnly = first(params.deleted) === '1';

  let rows: AdminProductListItemResponseDto[] = [];
  let total: number | null = null;
  let categories: AdminCategoryResponseDto[] = [];
  let toppings: AdminToppingResponseDto[] = [];
  let failed = false;

  const [categoryResult, toppingResult] = await Promise.allSettled([
    adminCategoriesControllerList(),
    adminToppingsControllerList(),
  ]);
  if (categoryResult.status === 'fulfilled') {
    categories = readPage<AdminCategoryResponseDto>(categoryResult.value.data).rows;
  }
  if (toppingResult.status === 'fulfilled') {
    toppings = readPage<AdminToppingResponseDto>(toppingResult.value.data).rows;
  }

  try {
    const load = (page: number) =>
      adminProductsControllerList({
        page,
        pageSize: ADMIN_PAGE_SIZE,
        sort: 'sortOrder',
        ...(query && { q: query }),
        ...(categoryId && { categoryId }),
        ...(deletedOnly && { deleted: 'true' }),
      });

    let response = await load(pageNumber);
    let page = readPage<AdminProductListItemResponseDto>(response.data);
    const totalPages = Math.max(1, Math.ceil((page.total ?? page.rows.length) / ADMIN_PAGE_SIZE));
    if (pageNumber > totalPages) {
      pageNumber = totalPages;
      response = await load(pageNumber);
      page = readPage<AdminProductListItemResponseDto>(response.data);
    }
    rows = page.rows;
    total = page.total;
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <>
        <PageHead title="Sản phẩm" meta="Không đọc được dữ liệu" />
        <Notice tone="error">
          <strong>Không tải được sản phẩm.</strong> Kiểm tra kết nối mạng rồi tải lại trang.
        </Notice>
      </>
    );
  }

  const queryString = new URLSearchParams({
    ...(query && { q: query }),
    ...(categoryId && { categoryId }),
    ...(deletedOnly && { deleted: '1' }),
  }).toString();

  return (
    <ProductsClient
      rows={rows}
      total={total}
      pageNumber={pageNumber}
      categories={categories}
      toppings={toppings}
      deletedOnly={deletedOnly}
      query={query}
      categoryId={categoryId}
      queryString={queryString}
    />
  );
}
