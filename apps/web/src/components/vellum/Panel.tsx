import { cx } from '@/lib/cx';

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cx('panel', className)}>{children}</section>;
}

export function PanelHead({
  title,
  action,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="panel-head">
      {title ? <h2>{title}</h2> : children}
      {action}
    </div>
  );
}

export function PanelBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cx('panel-body', className)}>{children}</div>;
}
