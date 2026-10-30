import type { Locale as ContractLocale } from '@brewlite/contracts';

// Written out here, not imported from contracts: client components import this file, and a
// runtime import of the contracts barrel would put all of it (zod, pricing, events) in the
// browser bundle. The check below fails the build if the two ever disagree.
export const SUPPORTED_LOCALES = ['en', 'vi'] as const;
export const DEFAULT_LOCALE = 'en' as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export const localesMatchContracts: Same<Locale, `${ContractLocale}`> = true;

/** One JSON file per namespace under `locales/<locale>/`. Later docs append theirs. */
export const NAMESPACES = [
  'common',
  'auth',
  'errors',
  'orders',
  'pwa',
  'menu',
  'cart',
  'checkout',
  'account',
] as const;
export type Namespace = (typeof NAMESPACES)[number];
