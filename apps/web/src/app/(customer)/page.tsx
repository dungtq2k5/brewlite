import { getT } from '@/i18n/server';

export async function generateMetadata() {
  const { t } = await getT('common');
  return { title: t('home.title') };
}

// A placeholder until the menu arrives; `/` renders for a guest (ADR 0029).
export default async function HomePage() {
  const { t } = await getT('common');
  return (
    <>
      <h1 className="mb-4 text-3xl font-semibold">{t('home.title')}</h1>
      <p>{t('home.placeholder')}</p>
    </>
  );
}
