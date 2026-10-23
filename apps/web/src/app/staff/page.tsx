import { getT } from '@/i18n/server';

export default async function Page() {
  const { t } = await getT('common');
  return <p>{t('staff.placeholder')}</p>;
}
