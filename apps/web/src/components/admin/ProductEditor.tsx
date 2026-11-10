'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AdminCategoryResponseDto,
  AdminProductResponseDto,
  AdminToppingResponseDto,
} from '@brewlite/api-client';
import {
  MAX_PRICE_VND,
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  computeUnitPrice,
} from '@brewlite/contracts';
import {
  clearProductImage,
  createProduct,
  deleteProduct,
  liveCategories,
  replaceSizes,
  replaceToppings,
  restoreProduct,
  setProductImage,
  updateProduct,
} from '@/actions/admin/products';
import { liveToppings } from '@/actions/admin/toppings';
import { formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { checkPair, type PairIssue } from '@/lib/admin/bilingual';
import {
  dirtySections,
  planSave,
  runSteps,
  type ProductForm,
  type Section,
  type Step,
} from '@/lib/admin/product-save';
import { clearUnsaved, setUnsaved } from '@/lib/admin/unsaved';
import { customerSees } from '@/lib/staff/stock';
import { Alert } from '../Alert';
import { AdminConfirmDialog } from './AdminConfirmDialog';
import { BilingualField } from './BilingualField';
import { ImageUploader, type PhotoChoice } from './ImageUploader';
import { SaveBar, type SaveBarState } from './SaveBar';
import { useAdminError } from './useAdminError';

type Product = AdminProductResponseDto;
const SIZES = ['S', 'M', 'L'] as const;

const toForm = (p: Product | undefined, sortOrder: number, categoryId: string): ProductForm => ({
  categoryId: p?.categoryId ?? categoryId,
  name: { en: p?.name.en ?? '', vi: p?.name.vi ?? '' },
  description: { en: p?.description?.en ?? '', vi: p?.description?.vi ?? '' },
  basePriceVnd: p?.basePriceVnd ?? 0,
  sortOrder: p?.sortOrder ?? sortOrder,
  sizes: p ? p.sizes.map((s) => ({ size: s.size, priceDeltaVnd: s.priceDeltaVnd })) : [],
  toppingIds: p?.toppingIds ?? [],
  photo: { kind: 'unchanged' },
});

const isMoney = (n: number) => Number.isInteger(n) && n >= 0 && n <= MAX_PRICE_VND;
const digits = (v: string) => (v === '' ? 0 : Number(v.replace(/\D/g, '')));

function Card({
  id,
  title,
  hint,
  error,
  children,
}: Readonly<{
  id: string;
  title: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}>) {
  return (
    <section
      aria-labelledby={id}
      className="border-base-300 bg-base-100 rounded-box flex flex-col gap-4 border p-6"
    >
      <div>
        <h2 id={id} className="text-xl font-semibold">
          {title}
        </h2>
        {hint && <p className="text-base-content/70">{hint}</p>}
      </div>
      {error && <Alert type="error">{error}</Alert>}
      {children}
    </section>
  );
}

/**
 * `/admin/products/new` and `/admin/products/[id]` (`100:1600`, `100:1968`): stacked section cards and a
 * sticky save bar. Each section is its own write (`planSave` / `runSteps`), so a failure in one
 * keeps every edit and says which section did not save.
 */
export function ProductEditor({
  product,
  categories,
  toppings: initialToppings,
  nextSortOrder,
  notice,
}: Readonly<{
  product?: Product;
  categories: AdminCategoryResponseDto[];
  toppings: AdminToppingResponseDto[];
  nextSortOrder: number;
  notice?: 'created' | 'photoFailed';
}>) {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language as Locale;
  const router = useRouter();
  const message = useAdminError();
  const key = useId();
  const mode = product ? 'existing' : 'new';
  const deleted = Boolean(product?.deletedAt);

  const [initial, setInitial] = useState(() =>
    toForm(product, nextSortOrder, categories[0]?.id ?? ''),
  );
  const [form, setForm] = useState(initial);
  const [photo, setPhoto] = useState<PhotoChoice>({ kind: 'unchanged' });
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? null);
  const [toppings, setToppings] = useState(initialToppings);
  const [cats, setCats] = useState(categories);
  const [issues, setIssues] = useState<{ name: PairIssue[]; description: PairIssue[] }>({
    name: [],
    description: [],
  });
  const [serverErrors, setServerErrors] = useState<{ en?: string; vi?: string }>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<Section, string>>>({});
  const [bar, setBar] = useState<SaveBarState | null>(null);
  const [leaveDelete, setLeaveDelete] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogPending, setDialogPending] = useState(false);
  const [restoreError, setRestoreError] = useState<{ category: string } | string | null>(null);
  const summary = useRef<HTMLDivElement>(null);

  const current: ProductForm = { ...form, photo };
  const dirty = useMemo(
    () =>
      deleted
        ? []
        : mode === 'new'
          ? ['basics' as Section]
          : dirtySections(initial, { ...form, photo }),
    [initial, form, photo, deleted, mode],
  );
  const changed = mode === 'new' ? isNewTouched(form, photo) : dirty.length > 0;
  const saving = bar?.kind === 'saving';

  useEffect(() => {
    setUnsaved(key, changed && !saving ? dirty : []);
    return () => clearUnsaved(key);
  }, [key, changed, saving, dirty]);

  const patch = (next: Partial<ProductForm>) => {
    setForm((f) => ({ ...f, ...next }));
    if (bar?.kind === 'saved') setBar(null);
  };

  const validate = (): boolean => {
    const name = checkPair(form.name, { required: true, max: PRODUCT_NAME_MAX_LENGTH });
    const description = checkPair(form.description, {
      required: false,
      max: PRODUCT_DESCRIPTION_MAX_LENGTH,
    });
    const errors: Record<string, string> = {};
    if (!form.categoryId) errors.category = t('error.RESOURCE_REFERENCE_INVALID.category');
    if (!isMoney(form.basePriceVnd)) errors.price = t('editor.priceInvalid');
    if (!Number.isInteger(form.sortOrder) || form.sortOrder < 0)
      errors.sort = t('editor.sortInvalid');
    if (form.sizes.length === 0) errors.sizes = t('editor.needOneSize');
    else if (form.sizes.some((s) => !isMoney(s.priceDeltaVnd)))
      errors.sizes = t('editor.priceInvalid');
    setIssues({ name, description });
    setFieldErrors(errors);
    setServerErrors({});
    setSectionErrors({});
    const count = name.length + description.length + Object.keys(errors).length;
    if (count > 0) requestAnimationFrame(() => summary.current?.focus());
    return count === 0;
  };
  const problems = issues.name.length + issues.description.length + Object.keys(fieldErrors).length;

  /** Names the toppings the API rejected: re-lists them and picks the selected ids no longer live. */
  const nameDeletedToppings = async (): Promise<string> => {
    const res = await liveToppings();
    if (!res.ok) return t('error.RESOURCE_REFERENCE_INVALID.toppings');
    setToppings(res.data);
    const live = new Set(res.data.filter((x) => !x.deletedAt).map((x) => x.id));
    const gone = form.toppingIds.filter((id) => !live.has(id));
    const names = gone
      .map((id) => toppings.find((x) => x.id === id))
      .filter((x): x is AdminToppingResponseDto => Boolean(x))
      .map((x) => localized(x.name, locale));
    return names.length === 0
      ? t('error.RESOURCE_REFERENCE_INVALID.toppings')
      : t('error.RESOURCE_REFERENCE_INVALID.toppingsNamed', {
          count: names.length,
          names: names.join(', '),
        });
  };

  const save = async (only?: Section) => {
    if (!validate()) return;
    let id = product?.id;
    let steps: Step[] = planSave(mode, initial, current);
    if (only) steps = steps.filter((s) => s.section === only);
    if (steps.length === 0) return;
    setBar({ kind: 'saving' });
    const failures: Partial<Record<Section, string>> = {};
    const done: Section[] = [];
    let latest = initial;

    const results = await runSteps<string>(steps, async (step) => {
      const target = id ?? '';
      const res =
        step.call === 'create'
          ? await createProduct(step.body)
          : step.call === 'update'
            ? await updateProduct(target, step.body)
            : step.call === 'replaceSizes'
              ? await replaceSizes(target, step.body)
              : step.call === 'replaceToppings'
                ? await replaceToppings(target, step.body)
                : step.call === 'setImage'
                  ? await setProductImage(target, imageForm(step.file))
                  : await clearProductImage(target);
      if (res.ok) {
        const data = res.data as Product | undefined;
        if (step.call === 'create' && data) id = data.id;
        if (data && 'imageUrl' in data) setImageUrl(data.imageUrl);
        return { ok: true };
      }
      const details = res.details as { field?: string; locale?: string } | undefined;
      if (res.code === 'PRODUCT_NAME_TAKEN') {
        const language = details?.locale === 'vi' ? 'vi' : 'en';
        setServerErrors({ [language]: message(res.code, res.details) });
        return { ok: false, error: message(res.code, res.details) };
      }
      if (res.code === 'RESOURCE_REFERENCE_INVALID') {
        if (step.section === 'toppings' || details?.field === 'toppingIds') {
          return { ok: false, error: await nameDeletedToppings() };
        }
        const fresh = await liveCategories();
        if (fresh.ok) setCats(fresh.data);
        setFieldErrors((e) => ({ ...e, category: t('error.RESOURCE_REFERENCE_INVALID.category') }));
        return { ok: false, error: t('error.RESOURCE_REFERENCE_INVALID.category') };
      }
      return { ok: false, error: message(res.code, res.details) };
    });

    for (const r of results) {
      if (r.ok) {
        done.push(r.section);
        latest = settle(latest, current, r.section);
      } else failures[r.section] = r.error;
    }
    const failed = Object.keys(failures) as Section[];

    if (mode === 'new' && id && !failed.includes('basics')) {
      // The product exists now: continue on its own page, carrying a failed photo along.
      clearUnsaved(key);
      const query = failed.includes('photo') ? '?notice=photoFailed' : '?notice=created';
      return router.replace(`/admin/products/${id}${query}`);
    }
    setInitial(latest);
    if (failed.length === 0) {
      if (photo.kind !== 'unchanged') setPhoto({ kind: 'unchanged' });
      setSectionErrors({});
      setBar({ kind: 'saved' });
      return router.refresh();
    }
    if (done.includes('photo')) setPhoto({ kind: 'unchanged' });
    setSectionErrors(failures);
    setBar({ kind: 'partial', saved: done, failed });
  };

  const discard = () => {
    setForm(initial);
    setPhoto({ kind: 'unchanged' });
    setIssues({ name: [], description: [] });
    setFieldErrors({});
    setServerErrors({});
    setSectionErrors({});
    setBar(null);
  };

  const removeProduct = async () => {
    if (!product) return;
    setDialogPending(true);
    const res = await deleteProduct(product.id);
    setDialogPending(false);
    if (!res.ok) return setDialogError(message(res.code, res.details));
    clearUnsaved(key);
    router.replace('/admin/products');
  };

  const restore = async () => {
    if (!product) return;
    setRestoreError(null);
    const res = await restoreProduct(product.id);
    if (res.ok) return router.refresh();
    const d = res.details as { status?: string } | undefined;
    if (res.code === 'INVALID_STATE' && d?.status === 'CATEGORY_DELETED') {
      return setRestoreError({ category: localized(product.categoryName, locale) });
    }
    setRestoreError(message(res.code, res.details));
  };

  const sees = product ? customerSees(product.isAvailable, product.stockQty) : null;
  const offered = (size: (typeof SIZES)[number]) => form.sizes.find((s) => s.size === size);
  const setDelta = (size: (typeof SIZES)[number], value: number | null) =>
    patch({
      sizes:
        value === null
          ? form.sizes.filter((s) => s.size !== size)
          : offered(size)
            ? form.sizes.map((s) => (s.size === size ? { ...s, priceDeltaVnd: value } : s))
            : [...form.sizes, { size, priceDeltaVnd: value }],
    });
  const title = product ? localized(product.name, locale) : t('editor.titleNew');

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/products" className="min-h-11 text-sm font-medium underline">
        ‹ {t('editor.back')}
      </Link>
      <h1 className="text-3xl font-bold">{title}</h1>
      {notice === 'created' && <Alert type="success">{t('editor.created')}</Alert>}
      {notice === 'photoFailed' && <Alert type="error">{t('editor.photoFailed')}</Alert>}
      {deleted && (
        <Alert type="info">
          <p>{t('editor.deletedHint')}</p>
        </Alert>
      )}
      {problems > 0 && (
        <div ref={summary} tabIndex={-1} role="alert" className="alert alert-error">
          {t('editor.summary', { count: problems })}
        </div>
      )}

      <fieldset disabled={deleted || saving} className="flex flex-col gap-4">
        <Card
          id={`${key}-basics`}
          title={t('editor.basics')}
          hint={t('editor.basicsHint')}
          error={sectionErrors.basics}
        >
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t('editor.category')}</span>
            <select
              value={form.categoryId}
              aria-invalid={fieldErrors.category ? true : undefined}
              onChange={(e) => patch({ categoryId: e.target.value })}
              className={`select w-full max-w-sm ${fieldErrors.category ? 'border-error' : ''}`}
            >
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {localized(c.name, locale)}
                </option>
              ))}
              {!cats.some((c) => c.id === form.categoryId) && form.categoryId && (
                <option value={form.categoryId}>
                  {localized(product?.categoryName ?? { en: '', vi: '' }, locale)}
                </option>
              )}
            </select>
            {fieldErrors.category && (
              <span className="text-error text-sm">{fieldErrors.category}</span>
            )}
          </label>
          <BilingualField
            label={t('editor.name')}
            required
            max={PRODUCT_NAME_MAX_LENGTH}
            value={form.name}
            onChange={(name) => patch({ name })}
            issues={issues.name}
            serverErrors={serverErrors}
          />
          <BilingualField
            label={t('editor.description')}
            kind="textarea"
            noun="description"
            max={PRODUCT_DESCRIPTION_MAX_LENGTH}
            value={form.description}
            onChange={(description) => patch({ description })}
            issues={issues.description}
          />
          <div className="flex flex-wrap gap-6">
            <label className="flex flex-col gap-1">
              <span className="font-medium">{t('editor.basePrice')}</span>
              <input
                inputMode="numeric"
                value={String(form.basePriceVnd)}
                aria-invalid={fieldErrors.price ? true : undefined}
                onChange={(e) => patch({ basePriceVnd: digits(e.target.value) })}
                className={`input w-44 ${fieldErrors.price ? 'border-error' : ''}`}
              />
              <span className="text-base-content/70 text-sm">
                {fieldErrors.price ??
                  t('editor.shownAs', { price: formatVnd(form.basePriceVnd, locale) })}
              </span>
              <span className="text-base-content/70 text-sm">{t('editor.priceNote')}</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">{t('editor.sortOrder')}</span>
              <input
                inputMode="numeric"
                value={String(form.sortOrder)}
                onChange={(e) => patch({ sortOrder: digits(e.target.value) })}
                className="input w-28"
              />
              {fieldErrors.sort && <span className="text-error text-sm">{fieldErrors.sort}</span>}
            </label>
          </div>
        </Card>

        <Card
          id={`${key}-sizes`}
          title={t('editor.sizes')}
          hint={t('editor.sizesHint')}
          error={sectionErrors.sizes ?? fieldErrors.sizes}
        >
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2">
            <span className="text-base-content/70 text-sm">{t('editor.offered')}</span>
            <span className="text-base-content/70 text-sm">{t('editor.change')}</span>
            <span className="text-base-content/70 text-right text-sm">{t('editor.pays')}</span>
            {SIZES.map((size) => {
              const row = offered(size);
              return (
                <div key={size} className="contents">
                  <label className="flex min-h-11 items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={Boolean(row)}
                      onChange={(e) => setDelta(size, e.target.checked ? 0 : null)}
                    />
                    {size}
                  </label>
                  {row ? (
                    <input
                      inputMode="numeric"
                      aria-label={`${t('editor.change')} ${size}`}
                      value={String(row.priceDeltaVnd)}
                      onChange={(e) => setDelta(size, digits(e.target.value))}
                      className="input w-36"
                    />
                  ) : (
                    <span className="text-base-content/60">{t('editor.notOffered')}</span>
                  )}
                  <span className="text-right tabular-nums">
                    {row && isMoney(form.basePriceVnd) && isMoney(row.priceDeltaVnd)
                      ? formatVnd(
                          computeUnitPrice(form.basePriceVnd, row.priceDeltaVnd, []),
                          locale,
                        )
                      : '—'}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-base-content/70 text-sm">
            {t('editor.sizesNote', { base: formatVnd(form.basePriceVnd, locale) })}
          </p>
        </Card>

        <Card
          id={`${key}-toppings`}
          title={t('editor.toppings')}
          hint={t('editor.toppingsHint')}
          error={sectionErrors.toppings}
        >
          {toppings.filter((x) => !x.deletedAt).length === 0 ? (
            <p>{t('editor.noToppings')}</p>
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {toppings
                .filter((x) => !x.deletedAt)
                .map((x) => (
                  <li key={x.id}>
                    <label className="flex min-h-11 items-center gap-3">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={form.toppingIds.includes(x.id)}
                        onChange={(e) =>
                          patch({
                            toppingIds: e.target.checked
                              ? [...form.toppingIds, x.id]
                              : form.toppingIds.filter((id) => id !== x.id),
                          })
                        }
                      />
                      <span>{localized(x.name, locale)}</span>
                      <span className="text-base-content/70 ml-auto text-sm tabular-nums">
                        +{formatVnd(x.priceVnd, locale)}
                      </span>
                    </label>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card
          id={`${key}-photo`}
          title={t('editor.photo')}
          hint={t('editor.photoHint')}
          error={sectionErrors.photo}
        >
          <ImageUploader
            currentUrl={imageUrl}
            choice={photo}
            onChange={setPhoto}
            disabled={deleted}
          />
        </Card>
      </fieldset>

      {product && sees && (
        <Card id={`${key}-stock`} title={t('editor.stock')}>
          <p>
            {product.stockQty === null
              ? t('editor.stockNone')
              : t('editor.stockCounted', { count: product.stockQty })}
          </p>
          <p className="font-semibold">
            {t('sees.label')}: {t(`sees.${sees}`)}
          </p>
          <Link href="/staff/products" className="min-h-11 font-medium underline">
            {t('editor.openStock')}
          </Link>
        </Card>
      )}

      {product && (
        <Card
          id={`${key}-danger`}
          title={t('editor.danger')}
          hint={deleted ? undefined : t('editor.deleteHint')}
        >
          {restoreError && (
            <Alert type="error">
              {typeof restoreError === 'string' ? (
                restoreError
              ) : (
                <>
                  {t('product.restoreRefused', { name: restoreError.category })}{' '}
                  <Link href="/admin/categories?deleted=true" className="underline">
                    {t('product.restoreCategory')}
                  </Link>
                </>
              )}
            </Alert>
          )}
          {deleted ? (
            <button
              type="button"
              className="btn btn-outline min-h-11 self-start"
              onClick={() => void restore()}
            >
              {t('editor.restore')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-outline btn-error min-h-11 self-start"
              onClick={() => {
                setDialogError(null);
                setLeaveDelete(true);
              }}
            >
              {t('action.delete')}
            </button>
          )}
        </Card>
      )}

      {(changed || (bar && bar.kind !== 'saved') || bar?.kind === 'saved') && !deleted && (
        <SaveBar
          state={bar ?? { kind: 'unsaved', sections: dirty }}
          onSave={() => void save()}
          onDiscard={discard}
          onRetry={(section) => void save(section)}
        />
      )}

      {leaveDelete && product && (
        <AdminConfirmDialog
          title={t('confirm.deleteTitle', { name: title })}
          body={t('editor.deleteHint')}
          confirmLabel={t('action.delete')}
          pending={dialogPending}
          error={dialogError}
          onConfirm={() => void removeProduct()}
          onClose={() => setLeaveDelete(false)}
        />
      )}
    </div>
  );
}

/** A new form counts as edited once anything differs from a blank one. */
function isNewTouched(form: ProductForm, photo: PhotoChoice): boolean {
  return (
    form.name.en !== '' ||
    form.name.vi !== '' ||
    form.description.en !== '' ||
    form.description.vi !== '' ||
    form.basePriceVnd !== 0 ||
    form.sizes.length > 0 ||
    form.toppingIds.length > 0 ||
    photo.kind !== 'unchanged'
  );
}

function imageForm(file: Blob): FormData {
  const data = new FormData();
  data.append('file', file);
  return data;
}

/** What `initial` becomes once `section` has been saved: that section now matches the form. */
function settle(initial: ProductForm, current: ProductForm, section: Section): ProductForm {
  switch (section) {
    case 'basics':
      return {
        ...initial,
        categoryId: current.categoryId,
        name: current.name,
        description: current.description,
        basePriceVnd: current.basePriceVnd,
        sortOrder: current.sortOrder,
      };
    case 'sizes':
      return { ...initial, sizes: current.sizes };
    case 'toppings':
      return { ...initial, toppingIds: current.toppingIds };
    case 'photo':
      return initial;
  }
}
