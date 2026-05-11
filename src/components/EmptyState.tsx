"use client";

/**
 * <EmptyState /> — Phase 13A.
 *
 * One-stop empty-state renderer. Drop this in place of "No data"
 * / blank panels.
 *
 * Props:
 *   - icon      emoji or short string (defaults to neutral 📭)
 *   - title     short headline
 *   - body      one-sentence explanation
 *   - cta       optional CTA — { label, href } or { label, onClick }
 *   - className extra wrapper classes
 */
import Link from "next/link";

interface CtaLink { label: string; href: string }
interface CtaButton { label: string; onClick: () => void }
type Cta = CtaLink | CtaButton;

interface Props {
  icon?: string;
  title: string;
  body?: string;
  cta?: Cta;
  className?: string;
}

function isLink(c: Cta): c is CtaLink {
  return "href" in c;
}

export default function EmptyState({
  icon = "📭",
  title,
  body,
  cta,
  className = "",
}: Props) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-8 sm:p-10 text-center ${className}`}
    >
      <div className="text-4xl mb-3" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      {body && <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">{body}</p>}
      {cta && (
        <div className="mt-4">
          {isLink(cta) ? (
            <Link
              href={cta.href}
              className="inline-block px-4 py-2 rounded bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009aa8] focus:outline-none focus:ring-2 focus:ring-[#00b4c3] focus:ring-offset-2"
            >
              {cta.label}
            </Link>
          ) : (
            <button
              onClick={cta.onClick}
              className="px-4 py-2 rounded bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009aa8] focus:outline-none focus:ring-2 focus:ring-[#00b4c3] focus:ring-offset-2"
            >
              {cta.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
