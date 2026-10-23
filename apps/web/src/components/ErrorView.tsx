import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

/** The 500 look (16:309): an icon in a cream circle, the words, two actions, the request id small. */
export function ErrorView({
  title,
  body,
  retryLabel,
  onRetry,
  home,
  reference,
}: Readonly<{
  title: string;
  body: string;
  retryLabel: string;
  onRetry: () => void;
  home: ReactNode;
  reference?: string;
}>) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-12 text-center">
      <span className="bg-base-200 grid h-24 w-24 place-items-center rounded-full">
        <TriangleAlert aria-hidden size={40} />
      </span>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p>{body}</p>
      <button type="button" className="btn btn-primary w-full" onClick={onRetry}>
        {retryLabel}
      </button>
      {home}
      {reference && <p className="mt-8 text-xs break-all">{reference}</p>}
    </div>
  );
}
