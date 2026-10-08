'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Accessible modal built on the native <dialog> element (focus trapping, Esc, inert background).
 * Content is only mounted while open, so per-attempt state (e.g. idempotency keys) resets each time.
 */
export function Modal({
  open,
  onClose,
  title,
  dismissible = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Set to false while a payment is in flight so it can't be closed mid-request. */
  dismissible?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && dismissible) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-zinc-900 p-0 text-zinc-100 ring-1 ring-zinc-700 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-lg font-bold text-white">
              {title}
            </h2>
            {dismissible && (
              <button onClick={onClose} className="-m-1 rounded p-1 text-zinc-400 hover:text-white" aria-label="Close">
                <svg viewBox="0 0 20 20" className="size-5" fill="currentColor" aria-hidden="true">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            )}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
