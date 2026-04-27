"use client";

/**
 * Tiny client-only print button. Lives next to the data shape the page
 * already loaded — no state of its own. Extracted so the parent page can
 * stay an async server component (window.print is browser-only).
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
