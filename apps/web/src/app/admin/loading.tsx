/** The overview's skeleton (`106:6600`). */
export default function OverviewLoading() {
  return (
    <div aria-hidden className="flex animate-pulse flex-col gap-4">
      <div className="bg-base-200 h-9 w-72 rounded" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-base-200 h-28 rounded-lg" />
        ))}
      </div>
      <div className="bg-base-200 h-48 rounded-lg" />
    </div>
  );
}
