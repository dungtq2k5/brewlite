import { cx } from '@/lib/cx';

export type TagTone = 'accent' | 'success' | 'warning' | 'error' | 'muted';

export function Tag({
  tone,
  children,
  className,
}: {
  tone?: TagTone;
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cx('tag', tone && `tag--${tone}`, className)}>{children}</span>;
}
