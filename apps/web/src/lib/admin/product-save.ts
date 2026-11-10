import type { CreateProductDto, ReplaceSizesDto, UpdateProductDto } from '@brewlite/api-client';
import { compareStrings } from '@brewlite/contracts';
import { toLocalized } from './bilingual';

export type Section = 'basics' | 'sizes' | 'toppings' | 'photo';

/** The order a save sends them in; each is an independent write. */
export const SECTION_ORDER: readonly Section[] = ['basics', 'sizes', 'toppings', 'photo'];

type Size = 'S' | 'M' | 'L';
const SIZE_ORDER: readonly Size[] = ['S', 'M', 'L'];

export interface Pair {
  en: string;
  vi: string;
}

/** What the editor holds — numbers are already numbers, pairs are raw text. */
export interface ProductForm {
  categoryId: string;
  name: Pair;
  description: Pair;
  basePriceVnd: number;
  sortOrder: number;
  /** Only the sizes on offer. */
  sizes: { size: Size; priceDeltaVnd: number }[];
  toppingIds: string[];
  photo: { kind: 'unchanged' } | { kind: 'set'; file: Blob } | { kind: 'clear' };
}

const samePair = (a: Pair, b: Pair) => a.en.trim() === b.en.trim() && a.vi.trim() === b.vi.trim();
const bySize = <T extends { size: Size }>(rows: readonly T[]) =>
  [...rows].sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));

function sameSizes(a: ProductForm['sizes'], b: ProductForm['sizes']) {
  const x = bySize(a);
  const y = bySize(b);
  return (
    x.length === y.length &&
    x.every((s, i) => s.size === y[i]!.size && s.priceDeltaVnd === y[i]!.priceDeltaVnd)
  );
}

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length &&
  [...a].sort(compareStrings).every((id, i) => id === [...b].sort(compareStrings)[i]);

/** Which sections differ from what was loaded. A new product's sections are all "dirty" by `planSave`. */
export function dirtySections(initial: ProductForm, current: ProductForm): Section[] {
  const dirty: Section[] = [];
  if (
    initial.categoryId !== current.categoryId ||
    !samePair(initial.name, current.name) ||
    !samePair(initial.description, current.description) ||
    initial.basePriceVnd !== current.basePriceVnd ||
    initial.sortOrder !== current.sortOrder
  ) {
    dirty.push('basics');
  }
  if (!sameSizes(initial.sizes, current.sizes)) dirty.push('sizes');
  if (!sameIds(initial.toppingIds, current.toppingIds)) dirty.push('toppings');
  if (current.photo.kind !== 'unchanged') dirty.push('photo');
  return dirty;
}

/** Only the changed basics; a cleared description is `null` (a description both-empty that had text). */
export function basicsPatch(initial: ProductForm, current: ProductForm): UpdateProductDto {
  const patch: UpdateProductDto = {};
  if (initial.categoryId !== current.categoryId) patch.categoryId = current.categoryId;
  if (!samePair(initial.name, current.name))
    patch.name = { en: current.name.en.trim(), vi: current.name.vi.trim() };
  if (!samePair(initial.description, current.description)) {
    patch.description = toLocalized(current.description);
  }
  if (initial.basePriceVnd !== current.basePriceVnd) patch.basePriceVnd = current.basePriceVnd;
  if (initial.sortOrder !== current.sortOrder) patch.sortOrder = current.sortOrder;
  return patch;
}

/** A write the editor will make — a Server Action is chosen by `call`. */
export type Step =
  | { section: 'basics'; call: 'create'; body: CreateProductDto }
  | { section: 'basics'; call: 'update'; body: UpdateProductDto }
  | { section: 'sizes'; call: 'replaceSizes'; body: ReplaceSizesDto }
  | { section: 'toppings'; call: 'replaceToppings'; body: { toppingIds: string[] } }
  | { section: 'photo'; call: 'setImage'; file: Blob }
  | { section: 'photo'; call: 'clearImage' };

/**
 * What *Save changes* sends, in order. A **new** product is one `create` (basics, sizes and toppings in
 * one body) and then the photo if one was chosen; an **existing** one sends each dirty section only.
 */
export function planSave(
  mode: 'new' | 'existing',
  initial: ProductForm,
  current: ProductForm,
): Step[] {
  const photo: Step[] =
    current.photo.kind === 'set'
      ? [{ section: 'photo', call: 'setImage', file: current.photo.file }]
      : current.photo.kind === 'clear'
        ? [{ section: 'photo', call: 'clearImage' }]
        : [];

  if (mode === 'new') {
    const description = toLocalized(current.description);
    const body: CreateProductDto = {
      categoryId: current.categoryId,
      name: { en: current.name.en.trim(), vi: current.name.vi.trim() },
      ...(description && { description }),
      basePriceVnd: current.basePriceVnd,
      sortOrder: current.sortOrder,
      sizes: bySize(current.sizes),
      toppingIds: current.toppingIds,
    };
    return [{ section: 'basics', call: 'create', body }, ...photo];
  }

  const dirty = new Set(dirtySections(initial, current));
  const steps: Step[] = [];
  if (dirty.has('basics')) {
    steps.push({ section: 'basics', call: 'update', body: basicsPatch(initial, current) });
  }
  if (dirty.has('sizes')) {
    steps.push({ section: 'sizes', call: 'replaceSizes', body: { sizes: bySize(current.sizes) } });
  }
  if (dirty.has('toppings')) {
    steps.push({
      section: 'toppings',
      call: 'replaceToppings',
      body: { toppingIds: current.toppingIds },
    });
  }
  return [...steps, ...photo];
}

export type StepResult<E> =
  { section: Section; ok: true } | { section: Section; ok: false; error: E };

/**
 * Runs the steps one after another and keeps every result. A failed section does **not** stop the
 * next ones — they are independent writes — except that a failed `create` stops everything: there
 * is no product to attach a photo to.
 */
export async function runSteps<E>(
  steps: readonly Step[],
  execute: (step: Step) => Promise<{ ok: true } | { ok: false; error: E }>,
): Promise<StepResult<E>[]> {
  const results: StepResult<E>[] = [];
  for (const step of steps) {
    const outcome = await execute(step);
    results.push(
      outcome.ok
        ? { section: step.section, ok: true }
        : { section: step.section, ok: false, error: outcome.error },
    );
    if (!outcome.ok && step.call === 'create') break;
  }
  return results;
}
