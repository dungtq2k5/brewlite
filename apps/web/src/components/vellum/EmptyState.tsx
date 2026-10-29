import { cx } from '@/lib/cx';

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('well well--pad', className)} style={{ textAlign: 'center' }}>
      <h2
        style={{
          marginInline: 'auto',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-lg)',
        }}
      >
        {title}
      </h2>
      {children && (
        <p className="muted" style={{ marginTop: 'var(--space-2xs)' }}>
          {children}
        </p>
      )}
      {action && <div style={{ marginTop: 'var(--space-md)' }}>{action}</div>}
    </div>
  );
}
