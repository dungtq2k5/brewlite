'use client';

import { CircleCheck } from 'lucide-react';
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
            className={`bg-neutral text-neutral-content pointer-events-auto flex min-h-13 items-center gap-2.5 rounded-full py-1 pl-4 shadow-[0_6px_10px_rgba(43,33,28,0.18)] ${toast.action ? 'pr-1.5' : 'pr-4'}`}
          >
            <CircleCheck aria-hidden size={20} className="shrink-0" />
            <span className="text-[15px] leading-[22px] font-semibold">{toast.message}</span>
            {toast.action && (
              <Link
                href={toast.action.href}
                onClick={() => setToast(null)}
                className="bg-neutral-content/14 flex h-11 items-center rounded-full px-3.5 text-[15px] leading-[22px] font-bold whitespace-nowrap"
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
