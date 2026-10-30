import ConsoleShell from '@/components/shells/ConsoleShell';
import { consoleCopy } from '@/i18n/console';
import { getLocale } from '@/i18n/locale.server';
import type { SessionUser } from '@/lib/session';

export default async function AdminShell({
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
      variant="admin"
      locale={locale}
      roleLabel={t('Quản trị', 'Admin')}
      user={{ fullName: user.fullName, email: user.email }}
      note={t(
        'Dữ liệu vận hành hiển thị trực tiếp từ hệ thống.',
        'Operational data is read live from the system.',
      )}
      nav={[
        { href: '/admin', label: t('Tổng quan', 'Overview') },
        { href: '/admin/orders', label: t('Đơn hàng', 'Orders') },
        { href: '/admin/reports', label: t('Báo cáo', 'Reports') },
        { href: '/admin/users', label: t('Người dùng', 'Users') },
        { href: '/admin/products', label: t('Sản phẩm', 'Products') },
        { href: '/admin/categories', label: t('Danh mục', 'Categories') },
        { href: '/admin/toppings', label: t('Topping', 'Toppings') },
        { href: '/admin/promotions', label: t('Khuyến mãi', 'Promotions') },
      ]}
    >
      {children}
    </ConsoleShell>
  );
}
