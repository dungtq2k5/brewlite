'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminToppingResponseDto } from '@brewlite/api-client';
import { MAX_PRICE_VND, TOPPING_NAME_MAX_LENGTH } from '@brewlite/contracts';
import {
  createTopping,
  deleteTopping,
  restoreTopping,
  updateTopping,
} from '@/actions/admin/toppings';
import { formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { checkPair, type PairIssue } from '@/lib/admin/bilingual';
import { Alert } from '../Alert';
import { AdminConfirmDialog } from './AdminConfirmDialog';
import { AdminTable, Td, Th } from './AdminTable';
import { BilingualField } from './BilingualField';
import { useAdminError } from './useAdminError';

type Topping = AdminToppingResponseDto;

function ToppingDialog({
  topping,
  onClose,
  onSaved,
}: Readonly<{ topping?: Topping; onClose: () => void; onSaved: () => void }>) {
  const { t } = useTranslation('admin');
  const message = useAdminError();
  const [name, setName] = useState({ en: topping?.name.en ?? '', vi: topping?.name.vi ?? '' });
  const [price, setPrice] = useState(topping ? String(topping.priceVnd) : '');
  const [issues, setIssues] = useState<PairIssue[]>([]);
  const [priceError, setPriceError] = useState(false);
  const [serverErrors, setServerErrors] = useState<{ en?: string; vi?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const found = checkPair(name, { required: true, max: TOPPING_NAME_MAX_LENGTH });
    const amount = Number(price);
    const badPrice =
      price === '' || !Number.isInteger(amount) || amount < 0 || amount > MAX_PRICE_VND;
    setIssues(found);
    setPriceError(badPrice);
    setServerErrors({});
    setError(null);
    if (found.length > 0 || badPrice) return;
    const input = { name: { en: name.en.trim(), vi: name.vi.trim() }, priceVnd: amount };
    startTransition(async () => {
      const result = topping ? await updateTopping(topping.id, input) : await createTopping(input);
      if (result.ok) return onSaved();
      if (result.code === 'TOPPING_NAME_TAKEN') {
        const language =
          (result.details as { locale?: string } | undefined)?.locale === 'vi' ? 'vi' : 'en';
        return setServerErrors({ [language]: message(result.code, result.details) });
      }
      setError(message(result.code, result.details));
    });
  };

  return (
    <AdminConfirmDialog
      title={topping ? t('topping.edit') : t('topping.new')}
      confirmLabel={topping ? t('action.save') : t('topping.create')}
      keepLabel={t('action.cancel')}
      tone="primary"
      pending={pending}
      error={error}
      onConfirm={submit}
      onClose={onClose}
    >
      <BilingualField
        label={t('editor.name')}
        required
        max={TOPPING_NAME_MAX_LENGTH}
        value={name}
        onChange={setName}
        issues={issues}
        serverErrors={serverErrors}
      />
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t('topping.price')}</span>
        <input
          inputMode="numeric"
          value={price}
          aria-invalid={priceError || undefined}
          onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
          className={`input w-40 ${priceError ? 'border-error' : ''}`}
        />
      </label>
    </AdminConfirmDialog>
  );
}

/** `/admin/toppings` (`98:2144` …): a bounded list with create / edit, the *Available* switch, delete and restore. */
export function ToppingsView({
  toppings,
  deleted,
}: Readonly<{ toppings: Topping[]; deleted: boolean }>) {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language as Locale;
  const other: Locale = locale === 'vi' ? 'en' : 'vi';
  const router = useRouter();
  const message = useAdminError();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<Topping | 'new' | null>(null);
  const [removing, setRemoving] = useState<Topping | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // The switches show what was just chosen until the refresh brings the server's truth back.
  const [source, setSource] = useState(toppings);
  const [switches, setSwitches] = useState<Record<string, boolean>>({});
  if (source !== toppings) {
    setSource(toppings);
    setSwitches({});
  }

  const flip = (topping: Topping, next: boolean) => {
    setSwitches((s) => ({ ...s, [topping.id]: next }));
    setNotice(null);
    startTransition(async () => {
      const result = await updateTopping(topping.id, { isAvailable: next });
      if (result.ok) return router.refresh();
      setSwitches((s) => ({ ...s, [topping.id]: topping.isAvailable }));
      setNotice(t('topping.switchFailed'));
    });
  };

  const confirmDelete = async () => {
    if (!removing) return;
    setRemovePending(true);
    const result = await deleteTopping(removing.id);
    setRemovePending(false);
    if (result.ok) {
      setRemoving(null);
      return router.refresh();
    }
    setRemoveError(message(result.code, result.details));
  };

  const link = 'min-h-11 px-2 text-sm font-semibold underline';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('topping.title')}</h1>
          <p className="text-base-content/80">{t('topping.intro')}</p>
        </div>
        {!deleted && (
          <button
            type="button"
            className="btn btn-primary min-h-11"
            onClick={() => setEditing('new')}
          >
            {t('topping.new')}
          </button>
        )}
      </div>
      <div>
        <Link
          href={deleted ? '/admin/toppings' : '/admin/toppings?deleted=true'}
          replace
          aria-pressed={deleted}
          className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${
            deleted ? 'bg-neutral text-neutral-content border-neutral' : 'border-base-300'
          }`}
        >
          {t('list.deleted')}
        </Link>
      </div>
      {notice && <Alert type="error">{notice}</Alert>}

      {toppings.length === 0 ? (
        <p className="border-base-300 rounded-box border px-4 py-10 text-center">
          {deleted ? t('topping.noneDeleted') : t('topping.none')}
        </p>
      ) : (
        <AdminTable caption={t('topping.title')}>
          <thead>
            <tr>
              <Th>{t('topping.cols.name')}</Th>
              <Th className="text-right">{t('topping.cols.price')}</Th>
              <Th>{t('topping.cols.status')}</Th>
              <Th>
                <span className="sr-only">{t('action.edit')}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {toppings.map((topping) => {
              const name = localized(topping.name, locale);
              const available = switches[topping.id] ?? topping.isAvailable;
              return (
                <tr key={topping.id}>
                  <Td>
                    <p className="font-semibold">{name}</p>
                    <p className="text-base-content/60 text-sm">{localized(topping.name, other)}</p>
                  </Td>
                  <Td className="text-right tabular-nums">{formatVnd(topping.priceVnd, locale)}</Td>
                  <Td>
                    {deleted ? (
                      <span className="bg-base-200 rounded-full px-3 py-1 text-sm font-semibold">
                        {t('status.deleted')}
                      </span>
                    ) : (
                      <label className="flex min-h-11 items-center gap-3">
                        <input
                          type="checkbox"
                          role="switch"
                          className="toggle toggle-success"
                          aria-label={`${t('topping.available')}, ${name}`}
                          checked={available}
                          onChange={(e) => flip(topping, e.target.checked)}
                        />
                        <span className="text-sm font-medium">
                          {available ? t('topping.available') : t('topping.unavailable')}
                        </span>
                      </label>
                    )}
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {deleted ? (
                      <button
                        type="button"
                        className={link}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await restoreTopping(topping.id);
                            if (result.ok) return router.refresh();
                            setNotice(message(result.code, result.details));
                          })
                        }
                      >
                        {t('action.restore')}
                      </button>
                    ) : (
                      <>
                        <button type="button" className={link} onClick={() => setEditing(topping)}>
                          {t('action.edit')}
                        </button>
                        <button
                          type="button"
                          className={`${link} text-error`}
                          onClick={() => {
                            setRemoveError(null);
                            setRemoving(topping);
                          }}
                        >
                          {t('action.delete')}
                        </button>
                      </>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </AdminTable>
      )}

      {editing && (
        <ToppingDialog
          topping={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {removing && (
        <AdminConfirmDialog
          title={t('confirm.deleteTitle', { name: localized(removing.name, locale) })}
          body={t('confirm.deleteBody')}
          confirmLabel={t('action.delete')}
          pending={removePending}
          error={removeError}
          onConfirm={() => void confirmDelete()}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
