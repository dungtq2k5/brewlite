'use client';

import { useEffect, useState } from 'react';

/** The clock as state, re-read every `periodMs` — for waits, countdowns and things that expire. */
export function useNow(periodMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), periodMs);
    return () => clearInterval(timer);
  }, [periodMs]);
  return now;
}
