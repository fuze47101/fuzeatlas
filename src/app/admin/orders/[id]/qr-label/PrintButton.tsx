"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-semibold hover:bg-[#009aa8] shadow-sm"
    >
      🖨 Print Label
    </button>
  );
}
