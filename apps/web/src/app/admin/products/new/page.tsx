import { ProductEditor } from '@/components/admin/ProductEditor';
import { getT } from '@/i18n/server';
import { allLiveProducts } from '@/lib/admin/server-data';
import { loadEditorLists } from '@/lib/admin/editor-data';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('admin');
  return { title: t('editor.titleNew') };
}

export default async function NewProductPage() {
  const [{ categories, toppings }, products] = await Promise.all([
    loadEditorLists(),
    allLiveProducts(),
  ]);
  const next = products.reduce((max, p) => Math.max(max, p.sortOrder), 0) + 10;
  return <ProductEditor categories={categories} toppings={toppings} nextSortOrder={next} />;
}
