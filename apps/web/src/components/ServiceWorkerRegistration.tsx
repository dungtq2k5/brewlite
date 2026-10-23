'use client';

import { useEffect } from 'react';

/** Production only — a worker in `next dev` caches dev chunks and confuses every reload (ADR 0032). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID}`, { scope: '/' })
      .catch(() => {
        // Installability is an enhancement; a failed registration changes nothing else.
      });
  }, []);
  return null;
}
