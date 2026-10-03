import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  connectAuthEmulator,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'fake-api-key-for-dev',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-brewlite.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-brewlite',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abcdef',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Đảm bảo chỉ khởi tạo và gắn emulator đúng 1 lần trên client
declare global {
  var __FIREBASE_AUTH_INSTANCE: Auth | undefined;
  var __FIREBASE_EMULATOR_CONNECTED: boolean | undefined;
}

// Chỉ dùng emulator khi chạy dev, hoặc khi đặt biến NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST
const emulatorHost =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ||
  (process.env.NODE_ENV !== 'production' ? '127.0.0.1:29099' : '');

let authInstance: Auth;

if (typeof window !== 'undefined') {
  if (!globalThis.__FIREBASE_AUTH_INSTANCE) {
    globalThis.__FIREBASE_AUTH_INSTANCE = getAuth(app);
  }
  authInstance = globalThis.__FIREBASE_AUTH_INSTANCE;

  if (emulatorHost && !globalThis.__FIREBASE_EMULATOR_CONNECTED) {
    try {
      connectAuthEmulator(authInstance, `http://${emulatorHost}`, { disableWarnings: true });
      globalThis.__FIREBASE_EMULATOR_CONNECTED = true;
    } catch {
      // Bỏ qua nếu đã gắn trước đó
    }
  }
} else {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function loginWithGooglePopup(): Promise<string> {
  const result = await signInWithPopup(auth, googleProvider);
  return await result.user.getIdToken();
}
