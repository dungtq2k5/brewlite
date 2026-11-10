/** The list's skeleton (`97:1985`). */
export default function PromotionsLoading() {
  return (
    <div aria-hidden className="flex animate-pulse flex-col gap-4">
      <div className="bg-base-200 h-9 w-48 rounded" />
      <div className="bg-base-200 h-4 w-96 rounded" />
      <div className="border-base-300 rounded-box border">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="border-base-300 bg-base-100 h-16 border-b last:border-b-0" />
        ))}
      </div>
    </div>
  );
}
