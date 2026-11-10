'use client';

import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminCategoryResponseDto } from '@brewlite/api-client';
import { CATEGORY_NAME_MAX_LENGTH } from '@brewlite/contracts';
import { createCategory, updateCategory } from '@/actions/admin/categories';
import { checkPair, type PairIssue } from '@/lib/admin/bilingual';
import { AdminConfirmDialog } from './AdminConfirmDialog';
import { BilingualField } from './BilingualField';
import { useAdminError } from './useAdminError';

/** Create or edit a category (`97:691`): both names, the sort number, *Active*. */
export function CategoryDialog({
  category,
  nextSortOrder,
  onClose,
  onSaved,
}: Readonly<{
  category?: AdminCategoryResponseDto;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}>) {
  const { t } = useTranslation('admin');
  const message = useAdminError();
  const [name, setName] = useState({ en: category?.name.en ?? '', vi: category?.name.vi ?? '' });
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? nextSortOrder));
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [issues, setIssues] = useState<PairIssue[]>([]);
  const [serverErrors, setServerErrors] = useState<{ en?: string; vi?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const found = checkPair(name, { required: true, max: CATEGORY_NAME_MAX_LENGTH });
    setIssues(found);
    setServerErrors({});
    setError(null);
    if (found.length > 0) return;
    const order = Number(sortOrder);
    const input = {
      name: { en: name.en.trim(), vi: name.vi.trim() },
      sortOrder: Number.isInteger(order) && order >= 0 ? order : nextSortOrder,
      isActive,
    };
    startTransition(async () => {
      const result = category
        ? await updateCategory(category.id, input)
        : await createCategory(input);
      if (result.ok) return onSaved();
      if (result.code === 'CATEGORY_NAME_TAKEN') {
        const language =
          (result.details as { locale?: string } | undefined)?.locale === 'vi' ? 'vi' : 'en';
        return setServerErrors({ [language]: message(result.code, result.details) });
      }
      setError(message(result.code, result.details));
    });
  };

  return (
    <AdminConfirmDialog
      title={category ? t('category.edit') : t('category.new')}
      confirmLabel={category ? t('action.save') : t('category.create')}
      tone="primary"
      pending={pending}
      error={error}
      onConfirm={submit}
      onClose={onClose}
      keepLabel={t('action.cancel')}
    >
      <BilingualField
        label={t('editor.name')}
        required
        max={CATEGORY_NAME_MAX_LENGTH}
        value={name}
        onChange={setName}
        issues={issues}
        serverErrors={serverErrors}
      />
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t('category.sortOrder')}</span>
        <input
          inputMode="numeric"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value.replace(/\D/g, ''))}
          className="input w-32"
        />
      </label>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          className="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        {t('category.activeLabel')}
      </label>
    </AdminConfirmDialog>
  );
}
