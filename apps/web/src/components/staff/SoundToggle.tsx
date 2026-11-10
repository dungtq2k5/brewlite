'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { setSound, soundOn, soundOnOnServer, subscribeSound } from '@/lib/staff/chime';

/**
 * *Enable sound* → *Sound on* (D04 decision 1): off by default, remembered on the device. After a
 * reload with it on, the browser still wants a tap before it plays — any tap on the board does that,
 * and the pill says *Sound on* meanwhile. Below 1024 only the icon shows.
 */
export function SoundToggle() {
  const { t } = useTranslation('staff');
  const on = useSyncExternalStore(subscribeSound, soundOn, soundOnOnServer);
  // The chime is for new orders: the board's top bar has it, the stock page's does not.
  if (usePathname().startsWith('/staff/products')) return null;
  const label = t(on ? 'sound.on' : 'sound.enable');
  const Icon = on ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={() => setSound(!on)}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold ${
        on ? 'bg-secondary border-secondary' : 'border-base-300'
      }`}
    >
      <Icon aria-hidden size={18} />
      <span className="max-lg:sr-only">{label}</span>
    </button>
  );
}
