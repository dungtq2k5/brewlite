import Image from 'next/image';
import Link from 'next/link';
import { getT } from '@/i18n/server';

/** The lockup, or — below 380 px — the symbol alone, which keeps the home link (D01 §3.5). */
export async function Logo() {
  const { t } = await getT('common');
  return (
    <Link href="/" aria-label={t('header.home')} className="inline-flex min-h-11 items-center">
      <Image
        src="/logo.svg"
        alt=""
        width={124}
        height={28}
        priority
        unoptimized
        className="max-[379px]:hidden"
      />
      <Image
        src="/symbol.svg"
        alt=""
        width={28}
        height={28}
        priority
        unoptimized
        className="min-[380px]:hidden"
      />
    </Link>
  );
}
