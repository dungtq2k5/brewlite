/** The board's skeleton (frame 84:2467): three columns of ghost cards. */
export default function BoardLoading() {
  return (
    <div aria-hidden className="grid h-full animate-pulse gap-3 lg:grid-cols-3">
      {[0, 1, 2].map((c) => (
        <div
          key={c}
          className="bg-base-200 rounded-box flex flex-col gap-3 p-3 max-lg:hidden first:max-lg:flex"
        >
          <div className="bg-base-300 h-7 w-28 rounded" />
          {[0, 1].map((i) => (
            <div key={i} className="bg-base-100 rounded-box h-56" />
          ))}
        </div>
      ))}
    </div>
  );
}
