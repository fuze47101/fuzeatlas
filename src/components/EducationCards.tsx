"use client";

/**
 * <EducationCards role={...} /> — Phase 14C.
 *
 * Drop-in card grid for portal landings. Pulls from
 * src/lib/education-cards.ts and renders 3-6 tiles per role.
 */
import Link from "next/link";
import { cardsForRole } from "@/lib/education-cards";

export default function EducationCards({
  role,
  limit = 6,
  className = "",
}: {
  role: string;
  limit?: number;
  className?: string;
}) {
  const cards = cardsForRole(role).slice(0, limit);
  if (cards.length === 0) return null;
  return (
    <section className={`mt-6 ${className}`}>
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-3">
        Learn FUZE
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => (
          <Link
            key={c.url}
            href={c.url}
            className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-[#00b4c3] hover:shadow-md transition-all focus-ring"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">{c.title}</h3>
              {c.todo && (
                <span className="shrink-0 text-[9px] font-bold uppercase bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">
                  Soon
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-snug">{c.summary}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
