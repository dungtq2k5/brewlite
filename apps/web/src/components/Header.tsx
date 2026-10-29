import Link from 'next/link';
import BuyerNav from '@/components/BuyerNav';
import type { Locale } from '@/i18n/locale';

export default function Header({ locale }: { locale: Locale }) {
  return (
    <header className="buyer-masthead">
      <div className="buyer-masthead-inner">
        <Link className="wordmark" href="/">
          BrewLite
        </Link>
        <BuyerNav locale={locale} />
      </div>
    </header>
  );
}
