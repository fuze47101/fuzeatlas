"use client";

import { useState } from "react";
import type { SourceCitation } from "@/lib/sustainability";

/**
 * Phase 19.5 — info-icon tooltip for sourced numeric values on
 * /sustainability and elsewhere. Hover (desktop) or tap (mobile)
 * to surface the SDS / EPA label citation, verified date, and
 * "value as published" quote.
 *
 * Usage:
 *   <span>{num(value, 0)} kg</span>
 *   <SourceTooltip source={citation} />
 */
export default function SourceTooltip({
  source,
  inline = true,
}: {
  source: SourceCitation | undefined;
  /** Render the ⓘ icon inline (next to a number) vs. as a standalone block. */
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!source) return null;

  const isEstimated = source.estimated === true;

  return (
    <span className={inline ? "relative inline-flex items-center ml-1" : "relative inline-block"}>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((p) => !p)}
        aria-label={isEstimated ? "Source — estimated" : "Source"}
        className={`text-[10px] leading-none w-4 h-4 inline-flex items-center justify-center rounded-full font-bold transition-colors ${
          isEstimated
            ? "bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200"
            : "bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200"
        }`}
      >
        {isEstimated ? "~" : "ⓘ"}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-0 top-full mt-1 w-80 max-w-[90vw] bg-slate-900 text-white rounded-lg shadow-xl p-3 text-[11px] leading-snug normal-case font-normal text-left whitespace-normal"
        >
          {isEstimated && (
            <div className="text-amber-300 font-bold mb-1.5">
              ⚠ Estimated — no public SDS / EPA label available
            </div>
          )}
          {source.valueAsPublished && (
            <div className="mb-1.5">
              <span className="text-slate-400 uppercase tracking-wide text-[9px] font-bold">
                Value as published
              </span>
              <div className="text-white italic mt-0.5">&ldquo;{source.valueAsPublished}&rdquo;</div>
            </div>
          )}
          {source.estimationBasis && (
            <div className="mb-1.5">
              <span className="text-amber-300 uppercase tracking-wide text-[9px] font-bold">
                Estimation basis
              </span>
              <div className="text-amber-100 mt-0.5">{source.estimationBasis}</div>
            </div>
          )}
          {source.sdsUrl && (
            <div className="mb-1">
              <a
                href={source.sdsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-300 underline hover:text-cyan-100 break-all"
              >
                {source.sdsUrl}
              </a>
            </div>
          )}
          {(source.sdsDate || source.sdsSection) && (
            <div className="text-slate-300 mb-1">
              {source.sdsDate && <span>SDS dated {source.sdsDate}</span>}
              {source.sdsDate && source.sdsSection && <span> · </span>}
              {source.sdsSection && <span>{source.sdsSection}</span>}
            </div>
          )}
          <div className="text-slate-400 text-[10px] mt-2 pt-2 border-t border-slate-700">
            Verified {source.verifiedDate} by {source.verifiedBy}
          </div>
          {source.notes && (
            <div className="text-slate-300 text-[10px] mt-1 italic">{source.notes}</div>
          )}
        </span>
      )}
    </span>
  );
}
