import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { createInstance, type i18n as I18n } from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { LOCALE_COOKIE } from '@/lib/cookies';
import { resolveLocale } from './locale';
import { DEFAULT_LOCALE, NAMESPACES, type Locale, type Namespace } from './settings';

/** This request's language. */
export const getLocale = cache(async (): Promise<Locale> => {
  return resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
});

/**
 * One i18next instance **per request** (memoised by React `cache()`), never a module-level
 * singleton — that would share one visitor's language with every other (conventions §11.6).
 * Every namespace is loaded: they are small, and the client provider reuses the store.
 */
const getInstance = cache(async (): Promise<I18n> => {
  const lng = await getLocale();
  const instance = createInstance();
  await instance
    .use(resourcesToBackend((l: string, ns: string) => import(`./locales/${l}/${ns}.json`)))
    .init({
      lng,
      fallbackLng: DEFAULT_LOCALE,
      ns: [...NAMESPACES],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      initAsync: false,
      returnNull: false,
    } as Parameters<I18n['init']>[0]);
  return instance;
});

export async function getT(ns: Namespace = 'common') {
  const instance = await getInstance();
  return { t: instance.getFixedT(null, ns), i18n: instance, locale: instance.language as Locale };
}

/** The loaded resources, handed to the client provider so its first render matches the HTML. */
export async function getResources() {
  return (await getInstance()).store.data;
}
