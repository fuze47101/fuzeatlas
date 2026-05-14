/**
 * src/lib/keyboard-shortcuts.ts — NICE-4 keyboard navigation.
 *
 * Global key bindings for the admin surface. Driven by the
 * <KeyboardShortcuts /> client component which mounts a single
 * document-level keydown listener.
 *
 * Pattern: a two-key "go-to" sequence (g + p for pipeline, g + f
 * for factories, …). Inspired by GitHub / Linear. Single-key
 * primary actions for `/` (focus search) and `?` (show help).
 *
 * Admin-only — KeyboardShortcuts component reads useAuth and
 * skips the listener for any role outside the internal allow list.
 */

export type ShortcutHandler = () => void;

export interface ShortcutDefinition {
  /** Display key in the help modal (e.g. "g p"). */
  display: string;
  /** Short label for the help modal. */
  label: string;
  /** Either a navigation path (router.push) or a custom handler. */
  href?: string;
  handler?: ShortcutHandler;
  /** Group name for the help modal. */
  group: string;
}

export const SHORTCUTS: ShortcutDefinition[] = [
  { display: "g p", label: "Brand pipeline", href: "/admin/brand-pipeline", group: "Navigate" },
  { display: "g f", label: "Factories", href: "/factories", group: "Navigate" },
  { display: "g d", label: "Distributors", href: "/admin/distributors", group: "Navigate" },
  { display: "g l", label: "Labs", href: "/labs", group: "Navigate" },
  { display: "g a", label: "Audit log", href: "/admin/audit-log", group: "Navigate" },
  { display: "g o", label: "Orders dashboard", href: "/admin/orders-dashboard", group: "Navigate" },
  { display: "g h", label: "Home", href: "/home", group: "Navigate" },
  { display: "/", label: "Focus search", group: "Action" }, // handled inline
  { display: "?", label: "Show this help", group: "Action" }, // handled inline
];

export const SHORTCUT_ALLOWED_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "TESTING_MANAGER",
  "FABRIC_MANAGER",
]);

/** Inputs we should never intercept keystrokes from. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}
