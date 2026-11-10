import { notFound } from 'next/navigation';
import { adminProductsControllerGet } from '@brewlite/api-client';
import { ProductEditor } from '@/components/admin/ProductEditor';
import { getT } from '@/i18n/server';
import { loadEditorLists } from '@/lib/admin/editor-data';
import { firstParam, type RawParams } from '@/lib/admin/list-params';
import { ApiClientError } from '@brewlite/api-client';
import { withRequestId } from '@/lib/with-request-id';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('admin');
  return { title: t('product.title') };
}

export default async function EditProductPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ id: string }>; searchParams: Promise<RawParams> }>) {
  const { id } = await params;
  const notice = firstParam(await searchParams, 'notice');
  const [res, lists] = await Promise.all([adminProductsControllerGet(id), loadEditorLists()]).catch(
    (error: unknown) => {
      if (error instanceof ApiClientError && (error.status === 404 || error.status === 400))
        notFound();
      throw withRequestId(error);
    },
  );
  if (res.status !== 200) notFound();
  return (
    <ProductEditor
      product={res.data.data}
      categories={lists.categories}
      toppings={lists.toppings}
      nextSortOrder={0}
      notice={notice === 'created' || notice === 'photoFailed' ? notice : undefined}
    />
  );
}
