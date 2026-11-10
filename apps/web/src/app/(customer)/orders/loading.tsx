export default function OrdersLoading() {
  return (
    <div aria-hidden className="mx-auto flex max-w-xl animate-pulse flex-col gap-3 py-4">
      <div className="bg-base-200 h-9 w-40 rounded" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-base-200 rounded-box h-24" />
      ))}
    </div>
  );
}
