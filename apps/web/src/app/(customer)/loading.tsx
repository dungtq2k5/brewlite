export default function MenuLoading() {
  return (
    <div className="stack" aria-busy="true" aria-label="Đang tải thực đơn">
      <div className="panel" style={{ padding: 'var(--space-md)' }}>
        <div className="skeleton skeleton--short" style={{ height: 24 }} />
        <div className="stack" style={{ marginTop: 'var(--space-sm)' }}>
          <div className="skeleton skeleton--med" />
          <div className="skeleton" />
        </div>
      </div>

      <div className="stack">
        {[1, 2, 3].map((row) => (
          <div className="panel" key={row} style={{ padding: 'var(--space-md)' }}>
            <div className="skeleton skeleton--med" />
            <div className="skeleton" style={{ marginTop: 'var(--space-xs)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
