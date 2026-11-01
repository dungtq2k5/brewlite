/** The stock list's skeleton (frame 86:6222). */
export default function StockLoading() {
  return (
    <div aria-hidden className="mx-auto flex max-w-3xl animate-pulse flex-col gap-3">
      <div className="bg-base-100 rounded-box h-14" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-base-100 rounded-box h-28" />
      ))}
    </div>
  );
}
