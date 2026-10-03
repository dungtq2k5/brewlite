export default function MenuLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-20 bg-base-300 rounded-2xl w-full"></div>
      <div className="flex gap-2">
        <div className="h-8 w-16 bg-base-300 rounded-full"></div>
        <div className="h-8 w-24 bg-base-300 rounded-full"></div>
        <div className="h-8 w-20 bg-base-300 rounded-full"></div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-base-300 rounded-2xl w-full"></div>
        ))}
      </div>
    </div>
  );
}
