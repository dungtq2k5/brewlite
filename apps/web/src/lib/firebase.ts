'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { parsePublicEnv } from '@/config/env.schema';

let emulatorConnected = false;

/** The Firebase web SDK, used only to prove a Google / Apple sign-in; it keeps no session (architecture §4.4). */
export function firebaseAuth(): Auth {
  const env = parsePublicEnv();
  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
  const auth = getAuth(app);
  if (env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL && !emulatorConnected) {
    connectAuthEmulator(auth, env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL, {
      disableWarnings: true,
    });
    emulatorConnected = true;
  }
  return auth;
}
