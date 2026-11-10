import { describe, expect, it } from 'vitest';
import {
  basicsPatch,
  dirtySections,
  planSave,
  runSteps,
  type ProductForm,
  type Step,
} from './product-save';

const form = (over: Partial<ProductForm> = {}): ProductForm => ({
  categoryId: 'c1',
  name: { en: 'Latte', vi: 'Latte' },
  description: { en: 'Smooth', vi: 'Mượt' },
  basePriceVnd: 45_000,
  sortOrder: 10,
  sizes: [
    { size: 'S', priceDeltaVnd: 0 },
    { size: 'M', priceDeltaVnd: 6_000 },
  ],
  toppingIds: ['t1', 't2'],
  photo: { kind: 'unchanged' },
  ...over,
});

describe('dirtySections', () => {
  it('is empty when nothing changed — even if the toppings are in another order', () => {
    expect(dirtySections(form(), form({ toppingIds: ['t2', 't1'] }))).toEqual([]);
  });

  it('names each changed section', () => {
    expect(dirtySections(form(), form({ basePriceVnd: 50_000 }))).toEqual(['basics']);
    expect(dirtySections(form(), form({ sizes: [{ size: 'S', priceDeltaVnd: 0 }] }))).toEqual([
      'sizes',
    ]);
    expect(dirtySections(form(), form({ toppingIds: ['t1'] }))).toEqual(['toppings']);
    expect(dirtySections(form(), form({ photo: { kind: 'clear' } }))).toEqual(['photo']);
  });

  it('sizes compare by size and price change, not by the order they are listed', () => {
    const swapped = form({
      sizes: [
        { size: 'M', priceDeltaVnd: 6_000 },
        { size: 'S', priceDeltaVnd: 0 },
      ],
    });
    expect(dirtySections(form(), swapped)).toEqual([]);
  });

  it('text is judged trimmed', () => {
    expect(dirtySections(form(), form({ name: { en: ' Latte ', vi: 'Latte' } }))).toEqual([]);
  });
});

describe('basicsPatch', () => {
  it('sends only the changed fields', () => {
    expect(basicsPatch(form(), form({ basePriceVnd: 50_000, sortOrder: 20 }))).toEqual({
      basePriceVnd: 50_000,
      sortOrder: 20,
    });
  });

  it('a cleared description is null; a changed one is the pair', () => {
    expect(basicsPatch(form(), form({ description: { en: '', vi: '' } }))).toEqual({
      description: null,
    });
    expect(basicsPatch(form(), form({ description: { en: 'New', vi: 'Mới' } }))).toEqual({
      description: { en: 'New', vi: 'Mới' },
    });
  });
});

describe('planSave — an existing product', () => {
  it('sends only dirty sections, in order: basics, sizes, toppings, photo', () => {
    const file = new Blob(['x']);
    const steps = planSave(
      'existing',
      form(),
      form({
        sortOrder: 5,
        toppingIds: ['t1'],
        photo: { kind: 'set', file },
        sizes: [{ size: 'L', priceDeltaVnd: 9_000 }],
      }),
    );
    expect(steps.map((s) => s.call)).toEqual([
      'update',
      'replaceSizes',
      'replaceToppings',
      'setImage',
    ]);
  });

  it('sends nothing for a clean form', () => {
    expect(planSave('existing', form(), form())).toEqual([]);
  });

  it('removing the photo is clearImage', () => {
    expect(
      planSave('existing', form(), form({ photo: { kind: 'clear' } })).map((s) => s.call),
    ).toEqual(['clearImage']);
  });
});

describe('planSave — a new product', () => {
  it('is one create with everything, then the photo if one was chosen', () => {
    const file = new Blob(['x']);
    const steps = planSave('new', form(), form({ photo: { kind: 'set', file } }));
    expect(steps.map((s) => s.call)).toEqual(['create', 'setImage']);
    expect(steps[0]).toMatchObject({
      call: 'create',
      body: { categoryId: 'c1', toppingIds: ['t1', 't2'], sizes: [{ size: 'S' }, { size: 'M' }] },
    });
  });

  it('leaves the description out of the body when both languages are empty', () => {
    const [create] = planSave('new', form(), form({ description: { en: '', vi: '' } })) as [
      Extract<Step, { call: 'create' }>,
    ];
    expect(create.body).not.toHaveProperty('description');
  });
});

describe('runSteps', () => {
  const steps = planSave(
    'existing',
    form(),
    form({ sortOrder: 5, toppingIds: ['t9'], basePriceVnd: 1 }),
  );

  it('keeps going after a failed section and reports each one', async () => {
    const results = await runSteps(steps, async (step) =>
      step.section === 'toppings'
        ? { ok: false, error: 'RESOURCE_REFERENCE_INVALID' }
        : { ok: true },
    );
    expect(results).toEqual([
      { section: 'basics', ok: true },
      { section: 'toppings', ok: false, error: 'RESOURCE_REFERENCE_INVALID' },
    ]);
  });

  it("runs them in the plan's order", async () => {
    const seen: string[] = [];
    await runSteps(steps, async (step) => {
      seen.push(step.section);
      return { ok: true };
    });
    expect(seen).toEqual(['basics', 'toppings']);
  });

  it('a failed create stops the rest — there is no product for the photo', async () => {
    const created = planSave(
      'new',
      form(),
      form({ photo: { kind: 'set', file: new Blob(['x']) } }),
    );
    const calls: string[] = [];
    const results = await runSteps(created, async (step) => {
      calls.push(step.call);
      return { ok: false, error: 'PRODUCT_NAME_TAKEN' };
    });
    expect(calls).toEqual(['create']);
    expect(results).toHaveLength(1);
  });

  it('a failed update does not stop the photo', async () => {
    const mixed = planSave('existing', form(), form({ basePriceVnd: 2, photo: { kind: 'clear' } }));
    const results = await runSteps(mixed, async (step) =>
      step.call === 'update' ? { ok: false, error: 'x' } : { ok: true },
    );
    expect(results.map((r) => [r.section, r.ok])).toEqual([
      ['basics', false],
      ['photo', true],
    ]);
  });
});
