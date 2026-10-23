import type { ReactNode } from 'react';

const STYLE = {
  info: 'alert-info',
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
} as const;

/** A page-level message; `role="alert"` for errors so it is announced when it appears. */
export function Alert({
  type,
  children,
}: Readonly<{ type: keyof typeof STYLE; children: ReactNode }>) {
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`alert ${STYLE[type]} alert-soft`}>
      <div>{children}</div>
    </div>
  );
}
