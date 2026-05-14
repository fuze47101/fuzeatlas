"use client";

/**
 * <KeyboardShortcuts /> — NICE-4 root-mounted listener + help modal.
 *
 * Drop this in the admin layout once. It mounts a single
 * document-level keydown listener and renders the help modal when
 * the user hits `?`. No-op for non-internal roles.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import {
  SHORTCUTS,
  SHORTCUT_ALLOWED_ROLES,
  isTypingTarget,
  type ShortcutDefinition,
} from "@/lib/keyboard-shortcuts";

const SEQUENCE_TIMEOUT_MS = 1500;

function focusFirstSearchInput() {
  const candidates = [
    document.querySelector<HTMLInputElement>(
      'input[type="search"]:not([disabled])',
    ),
    document.querySelector<HTMLInputElement>(
      'input[placeholder*="search" i]:not([disabled])',
    ),
    document.querySelector<HTMLInputElement>(
      'input[placeholder*="Search" i]:not([disabled])',
    ),
  ].filter(Boolean) as HTMLInputElement[];
  const el = candidates[0];
  if (el) {
    el.focus();
    el.select();
    return true;
  }
  return false;
}

export default function KeyboardShortcuts() {
  const { user } = useAuth();
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  const enabled = !!user && SHORTCUT_ALLOWED_ROLES.has(user.role);

  useEffect(() => {
    if (!enabled) return;

    let pendingPrefix: string | null = null;
    let prefixTimer: ReturnType<typeof setTimeout> | null = null;

    function clearPrefix() {
      pendingPrefix = null;
      if (prefixTimer) {
        clearTimeout(prefixTimer);
        prefixTimer = null;
      }
    }

    function dispatch(combo: string) {
      // `/` and `?` are inline-handled; everything else maps to SHORTCUTS.
      const def = SHORTCUTS.find((s) => s.display === combo);
      if (!def) return;
      if (def.href) {
        router.push(def.href);
      } else if (def.handler) {
        def.handler();
      }
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Don't hijack keystrokes while the user is typing.
      if (isTypingTarget(e.target)) {
        // Allow `?` from text fields too? No — feels intrusive. Skip.
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
        clearPrefix();
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        focusFirstSearchInput();
        clearPrefix();
        return;
      }

      if (e.key === "Escape") {
        setHelpOpen(false);
        clearPrefix();
        return;
      }

      // Two-key "g X" sequence.
      if (pendingPrefix === "g") {
        const combo = `g ${e.key.toLowerCase()}`;
        dispatch(combo);
        clearPrefix();
        return;
      }

      if (e.key.toLowerCase() === "g") {
        pendingPrefix = "g";
        prefixTimer = setTimeout(clearPrefix, SEQUENCE_TIMEOUT_MS);
        return;
      }
    }

    document.addEventListener("keydown", onKeydown);
    return () => {
      document.removeEventListener("keydown", onKeydown);
      clearPrefix();
    };
  }, [enabled, router]);

  if (!enabled || !helpOpen) return null;

  const grouped: Record<string, ShortcutDefinition[]> = {};
  for (const s of SHORTCUTS) {
    if (!grouped[s.group]) grouped[s.group] = [];
    grouped[s.group].push(s);
  }

  return (
    <div
      role="dialog"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
      onClick={() => setHelpOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
      >
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
            Keyboard shortcuts
          </h2>
          <button
            onClick={() => setHelpOpen(false)}
            className="text-xs text-slate-500 hover:text-[#00b4c3]"
          >
            Close (Esc)
          </button>
        </div>
        <div className="p-5 space-y-4">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                {group}
              </p>
              <ul className="space-y-1.5">
                {items.map((s) => (
                  <li
                    key={s.display}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-slate-700">{s.label}</span>
                    <kbd className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-xs text-slate-700">
                      {s.display}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="px-5 py-2 border-t border-slate-100 text-[11px] text-slate-500">
          Press <kbd className="px-1 rounded bg-slate-100">?</kbd> any time to toggle this
          panel.
        </div>
      </div>
    </div>
  );
}
