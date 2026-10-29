export function PageHead({
  title,
  meta,
  lede,
  actions,
  titleClassName,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
  titleClassName?: string;
}) {
  return (
    <header className="page-head">
      <div>
        <h1 className={['page-title', titleClassName].filter(Boolean).join(' ')}>{title}</h1>
        {meta && <p className="page-meta">{meta}</p>}
        {lede && <p className="page-lede">{lede}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
