'use client';

import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '../useErrorMessage';

/**
 * The words for an API refusal on an admin screen: the handoff's sentence when `admin:error.<CODE>`
 * has one (`*_NAME_TAKEN` names the language from `details.locale`; `INVALID_STATE` is told apart by
 * `details.status`), else the shop's generic copy from `errors:`.
 */
export function useAdminError() {
  const { t, i18n } = useTranslation('admin');
  const shop = useErrorMessage();
  return (code: string, details?: unknown): string => {
    const d = (details ?? {}) as { locale?: string; status?: string; usedCount?: number };
    if (code.endsWith('_NAME_TAKEN') && i18n.exists(`admin:error.${code}`)) {
      return t(`error.${code}`, { language: t(`bilingual.${d.locale === 'vi' ? 'vi' : 'en'}`) });
    }
    if (
      code === 'INVALID_STATE' &&
      d.status &&
      i18n.exists(`admin:error.INVALID_STATE.${d.status}`)
    ) {
      return t(`error.INVALID_STATE.${d.status}`);
    }
    const plain = `admin:error.${code}`;
    if (i18n.exists(plain) && typeof i18n.t(plain) === 'string' && i18n.t(plain) !== plain) {
      return t(`error.${code}`, { usedCount: d.usedCount });
    }
    return shop(code, details);
  };
}
