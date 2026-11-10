import Link from 'next/link';
import { hrefWith } from '@/lib/admin/list-params';
import type { RangePreset } from '@/lib/admin/range';

/**
 * Preset chips as links plus a *Custom…* pair of date inputs in a plain GET form — the range lives
 * in the address (`?range=7d`, `?range=custom&from=…&to=…`), so a reload and a shared link keep it.
 * A bad custom range flags both fields (`error`) and the page sends nothing to the API.
 */
export function RangePicker({
  path,
  params,
  presets,
  defaultPreset,
  labels,
  active,
  custom,
  error,
  fromLabel,
  toLabel,
  applyLabel,
  navLabel,
}: Readonly<{
  path: string;
  /** Other parameters to keep (`{ id }` is in the path, so usually empty). */
  params: Record<string, string>;
  presets: readonly RangePreset[];
  /** The chip that needs no `range` parameter. */
  defaultPreset: RangePreset;
  labels: Record<string, string>;
  active: RangePreset;
  custom: { from: string; to: string };
  error?: string;
  fromLabel: string;
  toLabel: string;
  applyLabel: string;
  navLabel: string;
}>) {
  const chip = 'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium';
  const on = 'bg-neutral text-neutral-content border-neutral';
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label={navLabel} className="flex flex-wrap gap-2">
        {presets
          .filter((p) => p !== 'custom')
          .map((p) => (
            <Link
              key={p}
              href={hrefWith(path, params, {
                range: p === defaultPreset ? undefined : p,
                from: undefined,
                to: undefined,
              })}
              replace
              aria-current={active === p ? 'true' : undefined}
              className={`${chip} ${active === p ? on : 'border-base-300'}`}
            >
              {labels[p]}
            </Link>
          ))}
        <Link
          href={hrefWith(path, params, { range: 'custom', from: custom.from, to: custom.to })}
          replace
          aria-current={active === 'custom' ? 'true' : undefined}
          className={`${chip} ${active === 'custom' ? on : 'border-base-300'}`}
        >
          {labels.custom}
        </Link>
      </nav>
      {active === 'custom' && (
        <form method="get" action={path} className="flex flex-wrap items-end gap-3">
          {Object.entries(params).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="range" value="custom" />
          {(
            [
              ['from', fromLabel, custom.from],
              ['to', toLabel, custom.to],
            ] as const
          ).map(([name, label, value]) => (
            <label key={name} className="flex flex-col gap-1">
              <span className="text-sm font-medium">{label}</span>
              <input
                type="date"
                name={name}
                defaultValue={value}
                aria-invalid={error ? true : undefined}
                className={`input ${error ? 'border-error' : ''}`}
              />
            </label>
          ))}
          <button type="submit" className="btn btn-outline min-h-11">
            {applyLabel}
          </button>
          {error && (
            <p role="alert" className="text-error w-full text-sm">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
