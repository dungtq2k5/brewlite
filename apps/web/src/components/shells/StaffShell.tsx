import ConsoleShell from '@/components/shells/ConsoleShell';
import { consoleCopy } from '@/i18n/console';
import { getLocale } from '@/i18n/locale.server';
import type { SessionUser } from '@/lib/session';

export default async function StaffShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const { t } = consoleCopy(locale);

  return (
    <ConsoleShell
      variant="staff"
      locale={locale}
      roleLabel={t('Quầy', 'Counter')}
      user={{ fullName: user.fullName, email: user.email }}
      note={t(
        'Bảng đơn tự cập nhật khi khách đặt hoặc thanh toán.',
        'The board refreshes when an order is placed or paid.',
      )}
      nav={[
        { href: '/staff', label: t('Bảng đơn', 'Order board') },
        { href: '/staff/stock', label: t('Kho & món', 'Stock & menu') },
      ]}
    >
      {children}
    </ConsoleShell>
  );
}
