"use client";

/**
 * Reusable client-only print button. Used by /report/[token],
 * /admin/fabric-report/[fabricId]/print, and any other page that
 * needs a "Print / Save as PDF" action. Shared here so we avoid
 * cross-route imports across dynamic-segment paths (which some
 * bundler configurations refuse to resolve).
 */
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-4 py-2 bg-[#00b4c3] text-white text-sm font-semibold rounded hover:bg-[#0098a3]"
    >
      Print / Save as PDF
    </button>
  );
}
