"use client";

/**
 * <HighlightedRow rowId="..." > children </HighlightedRow> — Phase 13I.
 *
 * Wrap a list / table row. On mount, reads `?highlight=ID` from the
 * URL. If it matches `rowId`, scrolls into view + flashes a teal
 * highlight ring for 2 seconds.
 *
 * Use this for Notification deep-linking: a notification with
 * link="/tests?highlight=abc123" lands on the listing page and
 * the AB123 row pops + scrolls.
 */
import { useEffect, useRef, useState } from "react";

interface Props {
  rowId: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  children: React.ReactNode;
}

export default function HighlightedRow({
  rowId,
  as = "div",
  className = "",
  children,
}: Props) {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const target = params.get("highlight");
    if (target !== rowId) return;
    setActive(true);
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    const timer = setTimeout(() => setActive(false), 2400);
    return () => clearTimeout(timer);
  }, [rowId]);

  const Tag: any = as;
  return (
    <Tag
      ref={ref}
      data-highlight-id={rowId}
      className={`${className} ${
        active
          ? "ring-2 ring-[#00b4c3] ring-offset-2 bg-[#00b4c3]/5 transition-all"
          : "transition-all"
      }`}
    >
      {children}
    </Tag>
  );
}
