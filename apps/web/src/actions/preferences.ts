'use server';

import { cookies } from 'next/headers';
import { cookieSecure, HERO_COOKIE, HERO_MAX_AGE_SECONDS } from '@/lib/cookies';

/** Hides the menu hero on this device for good — kept across sign-in and sign-out (architecture §4.7). */
export async function dismissHero(): Promise<void> {
  const jar = await cookies();
  jar.set(HERO_COOKIE, 'dismissed', {
    path: '/',
    sameSite: 'lax',
    secure: cookieSecure(),
    maxAge: HERO_MAX_AGE_SECONDS,
  });
}
