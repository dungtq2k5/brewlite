import { cx } from '@/lib/cx';

export function Notice({
  tone,
  children,
  className,
  role,
}: {
  tone?: 'error' | 'success' | 'warning';
  children: React.ReactNode;
  className?: string;
  role?: 'alert' | 'status';
}) {
  return (
    <div className={cx('notice', tone && `notice--${tone}`, className)} role={role}>
      {children}
    </div>
  );
}
