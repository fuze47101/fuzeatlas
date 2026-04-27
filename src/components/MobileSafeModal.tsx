"use client";

/**
 * Mobile-safe modal wrapper. Built after Andrew hit the access-requests
 * modal on iPhone where the company-picker pushed the Approve button
 * below the viewport with no scroll path. The pattern that breaks:
 *
 *   <div class="fixed inset-0 flex items-center justify-center">
 *     <div class="max-w-lg overflow-hidden">  ← content taller than
 *                                                viewport gets clipped
 *
 * The fix this component bakes in:
 *   1. Outer overlay scrolls (`overflow-y-auto`) and uses
 *      `items-start sm:items-center` so on mobile the modal anchors
 *      to the top with breathing room and you scroll to read more.
 *   2. Inner card is a flex column with `max-h-[calc(100vh-2rem)]` so
 *      it never exceeds the viewport.
 *   3. Caller renders { header, body, footer } as separate slots.
 *      Header + footer are flex-shrink-0 (pinned). Body is flex-1 with
 *      its own overflow-y-auto so long content scrolls INSIDE the
 *      modal while the action buttons stay tap-able at the bottom.
 *
 * Use this for any new modal going forward. Existing modals can be
 * migrated incrementally — search for `fixed inset-0` + `items-center`.
 */

import { ReactNode, useEffect } from "react";

interface MobileSafeModalProps {
  open: boolean;
  onClose: () => void;
  header?: ReactNode;
  /** Action buttons / submit row that stays pinned to the bottom of the modal. */
  footer?: ReactNode;
  /** Main content. Will scroll if taller than the modal's max-height. */
  children: ReactNode;
  /** Tailwind size class — defaults to max-w-lg. */
  maxWidth?: string;
  /** Z-index. Defaults to 50. Bump for modals that need to sit above floating buttons. */
  zIndex?: number;
  /** Set false if you want the overlay click to NOT close the modal (e.g. unsaved changes). */
  closeOnOverlayClick?: boolean;
}

export default function MobileSafeModal({
  open,
  onClose,
  header,
  footer,
  children,
  maxWidth = "max-w-lg",
  zIndex = 50,
  closeOnOverlayClick = true,
}: MobileSafeModalProps) {
  // Lock body scroll while open so the page underneath doesn't move.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-4 px-4"
      style={{ zIndex }}
      onClick={() => {
        if (closeOnOverlayClick) onClose();
      }}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden my-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {header && (
          <div className="flex-shrink-0 border-b border-slate-200">
            {header}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex-shrink-0 border-t border-slate-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
