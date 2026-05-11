"use client";

/**
 * <HelpTooltip /> — Phase 13G.
 *
 * Tiny (?) icon with hover/focus popover. Use it next to a field
 * label to explain jargon in plain English.
 *
 * Built-in dictionary covers the common FUZE-specific terms; pass
 * `term="custom"` + `text="..."` for one-offs.
 *
 * Usage:
 *   <label>ICP cadence <HelpTooltip term="icp-cadence" /></label>
 *   <label>Custom field <HelpTooltip text="Plain explanation" /></label>
 */
import { useState } from "react";

const DICTIONARY: Record<string, { title: string; body: string }> = {
  "icp-cadence": {
    title: "ICP cadence",
    body: "How often FUZE Atlas requires a fresh ICP test on production fabric (e.g. every N batches OR every X liters consumed, whichever hits first). Verifies the FUZE metamaterial concentration is holding through real production.",
  },
  "f1-tier": {
    title: "F1 Full Spectrum",
    body: "Highest treatment tier — 1.0 mg of FUZE metamaterial per kg of fabric. Third-party validated to 100 washes.",
  },
  "f2-tier": {
    title: "F2 Advanced",
    body: "0.75 mg/kg loading — 75 washes validated. Common for activewear performance fabric.",
  },
  "f3-tier": {
    title: "F3 Core",
    body: "0.5 mg/kg loading — 50 washes validated. The hospitality / linen sweet spot.",
  },
  "f4-tier": {
    title: "F4 Foundation",
    body: "0.25 mg/kg loading — 25 washes validated. Entry-tier antimicrobial protection.",
  },
  "wastage-factor": {
    title: "Wastage factor %",
    body: "Buffer added to a FUZE order to absorb application loss during exhaust / pad-dry-cure / spray treatment. Typical 5-15% depending on method.",
  },
  "pickup-pct": {
    title: "Pickup %",
    body: "Percentage of bath the fabric absorbs as it passes through the padder. 70% pickup means 1 kg fabric pulls 700 g of bath liquid through the squeeze rollers.",
  },
  "squeeze-pressure": {
    title: "Squeeze pressure",
    body: "Bar pressure on the padder rollers — controls how much bath the fabric retains after the squeeze nip. Higher pressure = lower pickup.",
  },
  "vfd-frequency": {
    title: "VFD frequency",
    body: "Variable Frequency Drive setting on the padder. Controls line speed in Hz — combined with bath chemistry to dial in the per-meter FUZE loading.",
  },
  "fuze-number": {
    title: "FUZE number",
    body: "Atlas-assigned unique identifier for a fabric sample (FUZE-XXXX). Stable forever — every test, order, and certification chains off this number.",
  },
  "astm-e2149": {
    title: "ASTM E2149",
    body: "Dynamic-contact antimicrobial test — fabric shaken in bacterial suspension. The test designed for non-leaching antimicrobials like FUZE. Primary test for F3/F4 tiers.",
  },
  "aatcc-100": {
    title: "AATCC 100",
    body: "Stacked-layer antibacterial textile test. FUZE passes at F1/F2 density where the metamaterial concentration overcomes the inter-layer geometry.",
  },
};

interface Props {
  term?: string;
  text?: string;
  className?: string;
}

export default function HelpTooltip({ term, text, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const entry = term && DICTIONARY[term] ? DICTIONARY[term] : null;
  const title = entry?.title || null;
  const body = entry?.body || text || "No explanation set.";

  return (
    <span className={`relative inline-block ${className}`}>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        aria-label="More information"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold leading-none hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00b4c3] focus:ring-offset-1 ml-1 align-middle"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-0 top-6 w-64 rounded-lg bg-slate-900 text-white p-3 shadow-xl text-xs"
        >
          {title && <span className="block font-bold mb-1">{title}</span>}
          <span className="block leading-snug">{body}</span>
        </span>
      )}
    </span>
  );
}
