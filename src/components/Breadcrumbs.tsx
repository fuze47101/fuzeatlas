"use client";

/**
 * <Breadcrumbs /> — Phase 13H-1.
 *
 * Standard Home › Section › Page rendering for pages deeper than
 * two levels. Drop-in for the existing ad-hoc breadcrumb blocks.
 *
 * Usage:
 *   <Breadcrumbs items={[
 *     { label: "Brand Portal", href: "/brand-portal" },
 *     { label: "Supply chain" },          // last item — no href, rendered as current
 *   ]} />
 *
 * If `home` is omitted, defaults to "Home" → "/home". Pass
 * `home={null}` to suppress the home segment entirely.
 */
import Link from "next/link";
import type { ReactNode } from "react";

export interface Crumb {
  label: ReactNode;
  href?: string;
}

interface Props {
  items: Crumb[];
  home?: Crumb | null;
  className?: string;
  separator?: ReactNode;
}

const DEFAULT_HOME: Crumb = { label: "Home", href: "/home" };

export default function Breadcrumbs({
  items,
  home = DEFAULT_HOME,
  className = "",
  separator = "›",
}: Props) {
  const all: Crumb[] = home ? [home, ...items] : items;
  const lastIndex = all.length - 1;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex flex-wrap items-center gap-2 text-xs text-slate-600 ${className}`}
    >
      {all.map((c, i) => {
        const isCurrent = i === lastIndex;
        return (
          <span key={i} className="inline-flex items-center gap-2">
            {c.href && !isCurrent ? (
              <Link
                href={c.href}
                className="hover:text-[#00b4c3] focus-ring rounded px-0.5"
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={
                  isCurrent
                    ? "font-medium text-slate-800"
                    : "text-slate-600"
                }
                aria-current={isCurrent ? "page" : undefined}
              >
                {c.label}
              </span>
            )}
            {!isCurrent && (
              <span aria-hidden="true" className="text-slate-400">
                {separator}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
