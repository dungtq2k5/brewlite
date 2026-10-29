'use client';

import { useEffect, useId, type ReactNode } from 'react';

/**
 * The one modal shell for admin forms. Closes on Escape or a click on the dim layer;
 * the caller owns the open/closed state and the busy state of its submit button.
 */
export function Modal({
  title,
  meta,
  wide,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  meta?: ReactNode;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="modal-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={wide ? 'modal modal--wide' : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {meta && <p className="page-meta">{meta}</p>}
          </div>
          <button type="button" className="modal-close" aria-label="Đóng" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{footer}</div>
      </div>
    </div>
  );
}
