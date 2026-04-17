// @ts-nocheck
"use client";

// Tiny client wrapper so the server component can render a "Print" button
// without pulling the whole page into the client bundle. Triggers the
// browser's print dialog on click.
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") window.print();
      }}
      className="px-4 py-2 rounded-lg text-sm font-bold bg-[#00b4c3] text-white hover:bg-[#009ba8]"
    >
      🖨 Print
    </button>
  );
}
