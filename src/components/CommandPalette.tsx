"use client";

/**
 * <CommandPalette /> — NICE-5 ⌘K / Ctrl-K global search palette.
 *
 * Mounted in the root layout. Self-gates by role (internal allow-list
 * only — same set as KeyboardShortcuts). Opens on ⌘K / Ctrl-K from
 * anywhere; ESC or click-outside closes.
 *
 * Architecture: debounced fetch against /api/admin/search?q=, render
 * grouped results (Brands / Factories / Contacts / Fabrics / Test
 * Requests / Orders), keyboard-driven navigation (↑↓ to move,
 * Enter to open, Tab/Shift+Tab also work). Pure client-side state —
 * no router cache hits, no SSR.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { SHORTCUT_ALLOWED_ROLES, isTypingTarget } from "@/lib/keyboard-shortcuts";

interface PaletteItem {
  id: string;
  kind: string;
  href: string;
  title: string;
  subtitle?: string;
}

interface PaletteGroup {
  group: string;
  items: PaletteItem[];
}

const KIND_BADGES: Record<string, string> = {
  brand: "bg-purple-100 text-purple-700",
  factory: "bg-amber-100 text-amber-700",
  contact: "bg-blue-100 text-blue-700",
  fabric: "bg-cyan-100 text-cyan-700",
  testRequest: "bg-indigo-100 text-indigo-700",
  order: "bg-emerald-100 text-emerald-700",
};

export default function CommandPalette() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [groups, setGroups] = useState<PaletteGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const enabled = !!user && SHORTCUT_ALLOWED_ROLES.has(user.role);

  // Keyboard listener — ⌘K or Ctrl-K toggles. No-op for non-internal.
  useEffect(() => {
    if (!enabled) return;
    function onKeydown(e: KeyboardEvent) {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isModK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (open && e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, [enabled, open]);

  // Focus input on open.
  useEffect(() => {
    if (open) {
      // Wait one tick so the modal is mounted.
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      // Reset on close so the next ⌘K starts fresh.
      setQ("");
      setDebounced("");
      setGroups([]);
      setActiveIndex(0);
      setError(null);
    }
  }, [open]);

  // Debounce the query — 200ms snappy enough on a global palette.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q, open]);

  // Fetch on debounced query change.
  useEffect(() => {
    if (!open) return;
    if (debounced.length < 2) {
      setGroups([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/search?q=${encodeURIComponent(debounced)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j?.ok) {
          setError(j?.error || "Search failed.");
          setGroups([]);
        } else {
          setGroups(j.groups || []);
          setActiveIndex(0);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message || "Network error.");
          setGroups([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  // Flatten groups so ↑↓ navigate across boundaries.
  const flat = useMemo(() => {
    const out: { item: PaletteItem; groupIndex: number; groupName: string }[] = [];
    for (let gi = 0; gi < groups.length; gi++) {
      for (const item of groups[gi].items) {
        out.push({ item, groupIndex: gi, groupName: groups[gi].group });
      }
    }
    return out;
  }, [groups]);

  // Keyboard navigation inside the palette.
  const openItem = useCallback(
    (item: PaletteItem) => {
      setOpen(false);
      router.push(item.href);
    },
    [router],
  );

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, flat.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const active = flat[activeIndex];
      if (active) openItem(active.item);
    }
  }

  if (!enabled || !open) return null;

  return (
    <div
      role="dialog"
      aria-label="Command palette"
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-4 pt-[10vh]"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[70vh]"
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">
            ⌘K
          </span>
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search brands, factories, contacts, fabrics, POs, orders…"
            className="flex-1 outline-none text-sm placeholder:text-slate-400"
          />
          {loading && <span className="text-[10px] text-slate-400">searching…</span>}
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {debounced.length < 2 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              Type 2+ characters to search. Use ↑↓ to navigate, Enter to open, Esc to close.
            </div>
          ) : flat.length === 0 && !loading ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              No matches for "{debounced}".
            </div>
          ) : (
            groups.map((g) => {
              const baseIndex = flat.findIndex((f) => f.groupName === g.group);
              return (
                <div key={g.group}>
                  <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-100">
                    {g.group}
                  </div>
                  <ul>
                    {g.items.map((item, i) => {
                      const flatIdx = baseIndex + i;
                      const isActive = flatIdx === activeIndex;
                      return (
                        <li
                          key={item.id}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          onClick={() => openItem(item)}
                          className={`px-4 py-2 cursor-pointer flex items-start justify-between gap-3 ${
                            isActive ? "bg-[#00b4c3]/10" : ""
                          }`}
                        >
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <span
                              className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                                KIND_BADGES[item.kind] || "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {item.kind}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {item.title}
                              </div>
                              {item.subtitle && (
                                <div className="text-[11px] text-slate-500 truncate">
                                  {item.subtitle}
                                </div>
                              )}
                            </div>
                          </div>
                          {isActive && (
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">
                              ↵
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
          <span>
            <kbd className="px-1 rounded bg-slate-100">↑↓</kbd> nav ·{" "}
            <kbd className="px-1 rounded bg-slate-100">↵</kbd> open ·{" "}
            <kbd className="px-1 rounded bg-slate-100">Esc</kbd> close
          </span>
          <span className="font-mono uppercase tracking-wider text-slate-400">
            FUZE Atlas
          </span>
        </div>
      </div>
    </div>
  );
}
