'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCameFromMenu } from '../PathTracker';

/**
 * The in-app back control (an installed app has no browser back — ADR 0032). From the menu it
 * is `router.back()`, which restores the scroll; from a link or a reload it goes to `/`.
 */
export function BackToMenu({ label }: Readonly<{ label: string }>) {
  const router = useRouter();
  const cameFromMenu = useCameFromMenu();
  return (
    <button
      type="button"
      onClick={() => (cameFromMenu() ? router.back() : router.push('/'))}
      className="inline-flex min-h-11 items-center gap-1 text-sm font-medium"
    >
      <ChevronLeft aria-hidden size={18} />
      {label}
    </button>
  );
}
