/** The order page streams in behind the header; a skeleton of the ticket and the first card. */
export default function OrderLoading() {
  return (
    <div aria-hidden className="mx-auto flex max-w-xl animate-pulse flex-col gap-4 py-4">
      <div className="bg-base-200 rounded-box mx-auto h-24 w-56" />
      <div className="bg-base-200 rounded-box h-24" />
      <div className="bg-base-200 rounded-box h-48" />
    </div>
  );
}
