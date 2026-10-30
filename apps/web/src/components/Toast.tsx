'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface ToastOptions {
  message: string;
  action?: { label: string; href: string };
}

const ToastContext = createContext<((toast: ToastOptions) => void) | null>(null);

const SHOW_FOR_MS = 5000;

/**
 * One toast at a time, in the customer shell so it survives the navigation that follows
 * *Add to cart* (the product page hands over to the menu). `role="status"`: announced, not alarming.
 */
export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const show = useCallback((options: ToastOptions) => setToast({ ...options, id: Date.now() }), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md justify-center"
      >
        {toast && (
          <div
            key={toast.id}
            className="bg-neutral text-neutral-content rounded-box pointer-events-auto flex w-full items-center justify-between gap-4 px-4 py-3 shadow-lg"
          >
            <span>{toast.message}</span>
            {toast.action && (
              <Link
                href={toast.action.href}
                onClick={() => setToast(null)}
                className="text-accent flex min-h-11 items-center font-semibold whitespace-nowrap"
              >
                {toast.action.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast needs <ToastProvider> — it lives in the customer shell');
  return show;
}
