'use client';

import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

/** The top bar's title follows the section: *Orders board* (*Orders* on a phone) or *Stock*. */
export function StaffTitle() {
  const { t } = useTranslation(['common', 'staff']);
  const stock = usePathname().startsWith('/staff/products');
  return (
    <h1 className="text-2xl font-semibold max-sm:text-xl">
      {stock ? (
        t('staff:stock.title')
      ) : (
        <>
          <span className="max-sm:hidden">{t('common:staff.title')}</span>
          <span className="sm:hidden">{t('common:staff.titleShort')}</span>
        </>
      )}
    </h1>
  );
}
