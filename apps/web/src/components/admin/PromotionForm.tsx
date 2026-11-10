'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CreatePromotionDto,
  PromotionResponseDto,
  UpdatePromotionDto,
} from '@brewlite/api-client';
import {
  MAX_PRICE_VND,
  PROMO_CODE_MAX_LENGTH,
  PROMO_CODE_PATTERN,
  PROMO_DESCRIPTION_MAX_LENGTH,
  instantToVietnamLocal,
  vietnamLocalToInstant,
} from '@brewlite/contracts';
import { createPromotion, deletePromotion, updatePromotion } from '@/actions/admin/promotions';
import { formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { discountWords } from '@/lib/admin/discount-words';
import { clearUnsaved, setUnsaved } from '@/lib/admin/unsaved';
import { Alert } from '../Alert';
import { AdminConfirmDialog } from './AdminConfirmDialog';
import { useAdminError } from './useAdminError';

interface Fields {
  code: string;
  description: string;
  type: 'PERCENT' | 'FIXED';
  value: string;
  cap: string;
  min: string;
  starts: string;
  ends: string;
  maxUses: string;
  perUser: string;
  active: boolean;
}

const fromPromotion = (p: PromotionResponseDto): Fields => ({
  code: p.code,
  description: p.description ?? '',
  type: p.discountType,
  value: String(p.discountValue),
  cap: p.maxDiscountVnd === null ? '' : String(p.maxDiscountVnd),
  min: String(p.minSubtotalVnd),
  starts: instantToVietnamLocal(p.startsAt),
  ends: instantToVietnamLocal(p.endsAt),
  maxUses: p.maxUses === null ? '' : String(p.maxUses),
  perUser: p.perUserLimit === null ? '' : String(p.perUserLimit),
  active: p.isActive,
});

const blank = (today: string, inThirtyDays: string): Fields => ({
  code: '',
  description: '',
  type: 'PERCENT',
  value: '',
  cap: '',
  min: '0',
  starts: `${today}T00:00`,
  ends: `${inThirtyDays}T23:59`,
  maxUses: '',
  perUser: '1',
  active: true,
});

const whole = (v: string) => /^\d+$/.test(v) && Number.isSafeInteger(Number(v));
const toInstant = (local: string): string | null => {
  try {
    return vietnamLocalToInstant(local);
  } catch {
    return null;
  }
};

/**
 * Create (`102:3633`) and edit (`102:4106`). On edit the code, discount and start are read-only with
 * the lock line; what stays editable is the description, the end, the two limits (each can be
 * emptied back to *unlimited*) and *Active*. Times are Vietnam time (`vietnamLocalToInstant`).
 */
export function PromotionForm({
  promotion,
  today,
  inThirtyDays,
  codeFont,
}: Readonly<{
  promotion?: PromotionResponseDto;
  today: string;
  inThirtyDays: string;
  codeFont: string;
}>) {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language as Locale;
  const router = useRouter();
  const message = useAdminError();
  const key = useId();
  const [initial, setInitial] = useState(() =>
    promotion ? fromPromotion(promotion) : blank(today, inThirtyDays),
  );
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const edit = Boolean(promotion);
  const set = (patch: Partial<Fields>) => {
    setF((x) => ({ ...x, ...patch }));
    setSaved(false);
  };

  const changed = JSON.stringify(f) !== JSON.stringify(initial);
  useEffect(() => {
    setUnsaved(key, changed ? ['basics'] : []);
    return () => clearUnsaved(key);
  }, [key, changed]);

  const validate = (): Partial<Record<keyof Fields, string>> => {
    const e: Partial<Record<keyof Fields, string>> = {};
    if (!edit) {
      if (!PROMO_CODE_PATTERN.test(f.code.toUpperCase())) e.code = t('promo.form.codeRule');
      const v = Number(f.value);
      if (!whole(f.value) || v < 1 || (f.type === 'PERCENT' && v > 100)) {
        e.value = f.type === 'PERCENT' ? t('promo.form.pctRange') : t('promo.form.needAmount');
      } else if (f.type === 'FIXED' && v > MAX_PRICE_VND) e.value = t('promo.form.needAmount');
      if (f.type === 'PERCENT' && f.cap !== '' && (!whole(f.cap) || Number(f.cap) < 1)) {
        e.cap = t('promo.form.needAmount');
      }
      if (!whole(f.min)) e.min = t('promo.form.needAmount');
      if (!toInstant(f.starts)) e.starts = t('promo.form.needDate');
    }
    if (f.description.length > PROMO_DESCRIPTION_MAX_LENGTH) {
      e.description = t('bilingual.tooLong', { max: PROMO_DESCRIPTION_MAX_LENGTH });
    }
    const end = toInstant(f.ends);
    const start = toInstant(f.starts);
    if (!end) e.ends = t('promo.form.needDate');
    else if (start && Date.parse(end) <= Date.parse(start)) e.ends = t('promo.form.endAfter');
    for (const [name, v] of [
      ['maxUses', f.maxUses],
      ['perUser', f.perUser],
    ] as const) {
      if (v !== '' && (!whole(v) || Number(v) < 1)) e[name] = t('promo.form.needNumber');
    }
    return e;
  };

  const limit = (v: string) => (v === '' ? null : Number(v));

  const submit = () => {
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;
    start(async () => {
      if (!promotion) {
        const body: CreatePromotionDto = {
          code: f.code.toUpperCase(),
          ...(f.description.trim() && { description: f.description.trim() }),
          discountType: f.type,
          discountValue: Number(f.value),
          ...(f.type === 'PERCENT' && f.cap !== '' && { maxDiscountVnd: Number(f.cap) }),
          minSubtotalVnd: Number(f.min),
          startsAt: toInstant(f.starts)!,
          endsAt: toInstant(f.ends)!,
          maxUses: limit(f.maxUses),
          perUserLimit: limit(f.perUser),
          isActive: f.active,
        };
        const res = await createPromotion(body);
        if (res.ok) {
          clearUnsaved(key);
          return router.push('/admin/promotions');
        }
        if (res.code === 'PROMO_CODE_TAKEN')
          return setErrors({ code: message(res.code, res.details) });
        return setFormError(message(res.code, res.details));
      }
      const body: UpdatePromotionDto = {};
      const trimmed = f.description.trim();
      if (trimmed !== initial.description.trim()) {
        if (trimmed === '') body.clearDescription = true;
        else body.description = trimmed;
      }
      if (f.ends !== initial.ends) body.endsAt = toInstant(f.ends)!;
      if (f.maxUses !== initial.maxUses) body.maxUses = limit(f.maxUses);
      if (f.perUser !== initial.perUser) body.perUserLimit = limit(f.perUser);
      if (f.active !== initial.active) body.isActive = f.active;
      const res = await updatePromotion(promotion.id, body);
      if (res.ok) {
        setInitial(f);
        setSaved(true);
        return router.refresh();
      }
      if (res.code === 'PROMO_MAX_USES_BELOW_USED') {
        return setErrors({ maxUses: message(res.code, res.details) });
      }
      setFormError(message(res.code, res.details));
    });
  };

  const field = (name: keyof Fields) => (errors[name] ? 'border-error' : '');
  const err = (name: keyof Fields) =>
    errors[name] ? <span className="text-error text-sm">{errors[name]}</span> : null;
  const money = (v: string) => (whole(v) ? formatVnd(Number(v), locale) : '');

  const previewWhat = (() => {
    const v = Number(f.value);
    if (!whole(f.value) || v < 1) return null;
    const words = discountWords(t, locale, {
      discountType: f.type,
      discountValue: v,
      maxDiscountVnd:
        f.type === 'PERCENT' && whole(f.cap) && Number(f.cap) > 0 ? Number(f.cap) : null,
    });
    return whole(f.min) && Number(f.min) > 0
      ? `${words} · ${t('promo.form.previewMin', { amount: formatVnd(Number(f.min), locale) })}`
      : words;
  })();

  const card = 'border-base-300 bg-base-100 rounded-box flex flex-col gap-4 border p-6';
  const lockedRow = (label: string, value: string, mono = false) => (
    <div className="flex items-center gap-2">
      <Lock aria-hidden size={16} />
      <span className="text-base-content/70 w-28 text-sm">{label}</span>
      <span className={mono ? `${codeFont} font-semibold` : 'font-semibold'}>{value}</span>
    </div>
  );

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Link href="/admin/promotions" className="min-h-11 text-sm font-medium underline">
        ‹ {t('promo.back')}
      </Link>
      <h1 className="text-3xl font-bold">{promotion ? promotion.code : t('promo.titleNew')}</h1>
      {saved && <Alert type="success">{t('promo.saved')}</Alert>}
      {formError && <Alert type="error">{formError}</Alert>}

      <section className={card}>
        {edit ? (
          <>
            {lockedRow(t('promo.form.code'), promotion!.code, true)}
            {lockedRow(
              t('promo.form.discount'),
              `${discountWords(t, locale, promotion!)}${
                promotion!.minSubtotalVnd > 0
                  ? ` · ${t('promo.min', { amount: formatVnd(promotion!.minSubtotalVnd, locale) })}`
                  : ''
              }`,
            )}
            {lockedRow(t('promo.form.starts'), f.starts.replace('T', ' '))}
            <p className="text-base-content/70 text-sm">{t('promo.locked')}</p>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className="font-medium">{t('promo.form.code')}</span>
              <input
                value={f.code}
                maxLength={PROMO_CODE_MAX_LENGTH}
                aria-invalid={errors.code ? true : undefined}
                onChange={(e) =>
                  set({ code: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() })
                }
                className={`input w-64 uppercase ${codeFont} ${field('code')}`}
              />
              <span className="text-base-content/70 text-sm">{t('promo.form.codeHint')}</span>
              {err('code')}
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-medium">{t('promo.form.discount')}</legend>
              {(['PERCENT', 'FIXED'] as const).map((type) => (
                <label key={type} className="flex min-h-11 items-center gap-3">
                  <input
                    type="radio"
                    name={`${key}-type`}
                    className="radio"
                    checked={f.type === type}
                    onChange={() => set({ type })}
                  />
                  {t(type === 'PERCENT' ? 'promo.form.typePercent' : 'promo.form.typeFixed')}
                </label>
              ))}
              <div className="flex flex-wrap gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-sm">
                    {f.type === 'PERCENT' ? t('promo.form.percent') : t('promo.form.amount')}
                  </span>
                  <input
                    inputMode="numeric"
                    value={f.value}
                    aria-invalid={errors.value ? true : undefined}
                    onChange={(e) => set({ value: e.target.value.replace(/\D/g, '') })}
                    className={`input w-32 ${field('value')}`}
                  />
                  {err('value')}
                </label>
                {f.type === 'PERCENT' && (
                  <label className="flex flex-col gap-1">
                    <span className="text-sm">{t('promo.form.cap')}</span>
                    <input
                      inputMode="numeric"
                      value={f.cap}
                      aria-invalid={errors.cap ? true : undefined}
                      onChange={(e) => set({ cap: e.target.value.replace(/\D/g, '') })}
                      className={`input w-40 ${field('cap')}`}
                    />
                    <span className="text-base-content/70 text-sm">{money(f.cap)}</span>
                    {err('cap')}
                  </label>
                )}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1">
              <span className="font-medium">{t('promo.form.minSubtotal')}</span>
              <input
                inputMode="numeric"
                value={f.min}
                aria-invalid={errors.min ? true : undefined}
                onChange={(e) => set({ min: e.target.value.replace(/\D/g, '') })}
                className={`input w-40 ${field('min')}`}
              />
              <span className="text-base-content/70 text-sm">{t('promo.form.minHint')}</span>
              {err('min')}
            </label>
          </>
        )}
        <label className="flex flex-col gap-1">
          <span className="font-medium">
            {t('promo.form.description')}{' '}
            <span className="text-base-content/70 text-sm font-normal">
              {t('promo.form.descriptionHint')}
            </span>
          </span>
          <input
            value={f.description}
            maxLength={PROMO_DESCRIPTION_MAX_LENGTH}
            onChange={(e) => set({ description: e.target.value })}
            className={`input w-full ${field('description')}`}
          />
          {err('description')}
        </label>
      </section>

      <section className={card}>
        <div className="flex flex-wrap gap-4">
          {!edit && (
            <label className="flex flex-col gap-1">
              <span className="font-medium">
                {t('promo.form.starts')}{' '}
                <span className="text-base-content/70 text-sm font-normal">
                  {t('promo.form.vnTime')}
                </span>
              </span>
              <input
                type="datetime-local"
                value={f.starts}
                aria-invalid={errors.starts ? true : undefined}
                onChange={(e) => set({ starts: e.target.value })}
                className={`input ${field('starts')}`}
              />
              {err('starts')}
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-medium">
              {t('promo.form.ends')}{' '}
              <span className="text-base-content/70 text-sm font-normal">
                {t('promo.form.vnTime')}
              </span>
            </span>
            <input
              type="datetime-local"
              value={f.ends}
              aria-invalid={errors.ends ? true : undefined}
              onChange={(e) => set({ ends: e.target.value })}
              className={`input ${field('ends')}`}
            />
            {err('ends')}
          </label>
        </div>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ['maxUses', 'promo.form.maxUses'],
              ['perUser', 'promo.form.perUser'],
            ] as const
          ).map(([name, label]) => (
            <label key={name} className="flex flex-col gap-1">
              <span className="font-medium">
                {t(label)}{' '}
                <span className="text-base-content/70 text-sm font-normal">
                  {t('promo.form.unlimited')}
                </span>
              </span>
              <input
                inputMode="numeric"
                value={f[name]}
                aria-invalid={errors[name] ? true : undefined}
                onChange={(e) => set({ [name]: e.target.value.replace(/\D/g, '') })}
                className={`input w-40 ${field(name)}`}
              />
              {err(name)}
            </label>
          ))}
        </div>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="checkbox"
            checked={f.active}
            onChange={(e) => set({ active: e.target.checked })}
          />
          {t('promo.form.active')}
        </label>
      </section>

      {previewWhat && (
        <p className="bg-secondary rounded-box px-4 py-3 font-medium" aria-live="polite">
          {t('promo.form.preview', { what: previewWhat })}
        </p>
      )}

      {promotion && (
        <section className={card}>
          <button
            type="button"
            className="btn btn-outline btn-error min-h-11 self-start"
            onClick={() => {
              setDeleteError(null);
              setConfirmDelete(true);
            }}
          >
            {t('action.delete')}
          </button>
        </section>
      )}
      {confirmDelete && promotion && (
        <AdminConfirmDialog
          title={t('promo.deleteTitle', { code: promotion.code })}
          body={t('promo.deleteBody')}
          confirmLabel={t('action.delete')}
          pending={pending}
          error={deleteError}
          onConfirm={() =>
            start(async () => {
              const res = await deletePromotion(promotion.id);
              if (res.ok) {
                clearUnsaved(key);
                return router.push('/admin/promotions');
              }
              setDeleteError(message(res.code, res.details));
            })
          }
          onClose={() => setConfirmDelete(false)}
        />
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          className="btn btn-primary min-h-11"
          disabled={pending || (edit && !changed)}
        >
          {pending ? t('action.saving') : edit ? t('action.save') : t('promo.create')}
        </button>
        <Link href="/admin/promotions" className="btn btn-ghost min-h-11">
          {t('action.cancel')}
        </Link>
      </div>
    </form>
  );
}
