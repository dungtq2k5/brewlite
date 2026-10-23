'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

const DISMISSED_KEY = 'bl_install_dismissed';

// Chrome's install prompt event; not in lib.dom.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const noop = () => () => {};
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

const read = () => {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};
const remember = () => {
  try {
    window.localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Blocked storage: the invitation may come back; nothing worse.
  }
};

/**
 * The "keep BrewLite on your home screen" sheet (ADR 0032). Built here, **shown** by the order
 * tracking page after the first `COMPLETED` order. Android defers
 * `beforeinstallprompt`; iOS gets the two-step Share instruction. One dismissal hides it for good.
 */
export function InstallInvitation() {
  const { t } = useTranslation('pwa');
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [closed, setClosed] = useState(false);
  // Server snapshots say "already dismissed", so nothing flashes before the client decides.
  const dismissed = useSyncExternalStore(noop, read, () => true);
  const standalone = useSyncExternalStore(noop, isStandalone, () => true);
  const ios = useSyncExternalStore(noop, isIos, () => false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (closed || dismissed || standalone || (!prompt && !ios)) return null;

  const dismiss = () => {
    remember();
    setClosed(true);
  };
  const install = async () => {
    await prompt?.prompt();
    dismiss();
  };

  return (
    <section
      aria-labelledby="install-title"
      className="bg-base-100 border-base-300 rounded-box fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 border p-5 shadow-xl"
    >
      <h2 id="install-title" className="text-lg font-semibold">
        {t(ios ? 'installIos.title' : 'install.title')}
      </h2>
      {ios ? (
        <ol className="my-3 list-decimal pl-5">
          <li>{t('installIos.step1')}</li>
          <li>{t('installIos.step2')}</li>
        </ol>
      ) : (
        <p className="my-3">{t('install.body')}</p>
      )}
      <div className="flex flex-col gap-2">
        {!ios && (
          <button type="button" className="btn btn-primary" onClick={install}>
            {t('install.accept')}
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={dismiss}>
          {t(ios ? 'installIos.dismiss' : 'install.dismiss')}
        </button>
      </div>
    </section>
  );
}
