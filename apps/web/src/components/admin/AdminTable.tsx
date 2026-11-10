import type { ReactNode } from 'react';

/**
 * A real `<table>` (handoff §6): a caption, `th scope="col"`, the row's link on its first cell.
 * The caption is for assistive tech; the page's own heading is what people see.
 */
export function AdminTable({
  caption,
  children,
}: Readonly<{ caption: string; children: ReactNode }>) {
  return (
    <div className="border-base-300 bg-base-100 rounded-box overflow-hidden border">
      <table className="w-full table-auto text-left">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export const Th = ({
  children,
  className = '',
}: Readonly<{ children?: ReactNode; className?: string }>) => (
  <th scope="col" className={`bg-base-200 px-4 py-3 text-sm font-semibold ${className}`}>
    {children}
  </th>
);

export const Td = ({
  children,
  className = '',
}: Readonly<{ children?: ReactNode; className?: string }>) => (
  <td className={`border-base-300 border-t px-4 py-2 align-middle ${className}`}>{children}</td>
);
