import { promotionsControllerList, type PromotionResponseDto } from '@brewlite/api-client';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { readPage } from '@/lib/api-server';
import { ADMIN_PAGE_SIZE, parsePageParam } from '@/lib/pagination';
import PromotionsClient from './PromotionsClient';

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function AdminPromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    q?: string | string[];
    active?: string | string[];
    deleted?: string | string[];
  }>;
}) {
  const params = await searchParams;
  let pageNumber = parsePageParam(params.page);
  const query = first(params.q).trim().slice(0, 32);
  const activeRaw = first(params.active);
  const activeFilter: 'true' | 'false' | '' =
    activeRaw === 'true' || activeRaw === 'false' ? activeRaw : '';
  const deletedOnly = first(params.deleted) === '1';

  let rows: PromotionResponseDto[] = [];
  let total: number | null = null;
  let failed = false;

  try {
    const load = (page: number) =>
      promotionsControllerList({
        page,
        pageSize: ADMIN_PAGE_SIZE,
        sort: '-createdAt',
        ...(query && { q: query }),
        ...(activeFilter && { active: activeFilter }),
        ...(deletedOnly && { deleted: 'true' }),
      });

    let response = await load(pageNumber);
    let page = readPage<PromotionResponseDto>(response.data);
    const totalPages = Math.max(1, Math.ceil((page.total ?? page.rows.length) / ADMIN_PAGE_SIZE));
    if (pageNumber > totalPages) {
      pageNumber = totalPages;
      response = await load(pageNumber);
      page = readPage<PromotionResponseDto>(response.data);
    }
    rows = page.rows;
    total = page.total;
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <>
        <PageHead title="Khuyến mãi" meta="Không đọc được dữ liệu" />
        <Notice tone="error">
          <strong>Không tải được khuyến mãi.</strong> Kiểm tra kết nối mạng rồi tải lại trang.
        </Notice>
      </>
    );
  }

  const queryString = new URLSearchParams({
    ...(query && { q: query }),
    ...(activeFilter && { active: activeFilter }),
    ...(deletedOnly && { deleted: '1' }),
  }).toString();

  return (
    <PromotionsClient
      rows={rows}
      total={total}
      pageNumber={pageNumber}
      deletedOnly={deletedOnly}
      query={query}
      activeFilter={activeFilter}
      queryString={queryString}
    />
  );
}
