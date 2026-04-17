// @ts-nocheck
"use client";

/**
 * Floating "Need help?" button. Lives in the app root layout so it is present
 * on every page for every user. Opens a modal with TWO modes:
 *
 *   1. "How do I…?"  — scans the current page path + user role and surfaces
 *      curated step-by-step answers from `lib/how-to-kb.ts`. If the user's
 *      question isn't covered, a big "Open a support ticket" button escalates
 *      them into mode 2 with the question pre-filled.
 *
 *   2. "Report a problem" — the original bug/feedback form. Category chips,
 *      title, description, paste/drop a screenshot, auto-captures URL/UA.
 *
 * On successful submit the requestor sees a "thanks, we'll follow up when it's
 * fixed" confirmation. Admin triage happens on /admin/feedback.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Mode = "LANDING" | "HOWTO" | "TICKET";

type HowToEntry = {
  id: string;
  title: string;
  shortAnswer: string;
  steps: string[];
  applicableRoles: string[];
  applicablePaths: string[];
  keywords: string[];
  relatedLinks?: { label: string; href: string }[];
};

const CATEGORIES: { id: string; label: string; icon: string; hint: string }[] = [
  {
    id: "PROBLEM",
    label: "Something's broken",
    icon: "💥",
    hint: "It doesn't work the way it should",
  },
  { id: "ERROR", label: "I got an error", icon: "⚠️", hint: "Red message, page crash, 500" },
  {
    id: "BROKEN_LINK",
    label: "Broken link",
    icon: "🔗",
    hint: "Button or link goes nowhere / 404",
  },
  {
    id: "CONFUSING",
    label: "This is confusing",
    icon: "❓",
    hint: "I don't understand what to do",
  },
  {
    id: "MISSING",
    label: "Something's missing",
    icon: "🧩",
    hint: "I need a button / feature / data",
  },
  { id: "SUGGESTION", label: "I have an idea", icon: "💡", hint: "This could be better if…" },
  { id: "OTHER", label: "Other", icon: "💬", hint: "Doesn't fit the list above" },
];

/** Convert a File (image) to a compact JPEG data URL via a canvas. Caps long side at 1600px. */
async function fileToCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image load failed"));
      img.onload = () => {
        const MAX = 1600;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const scale = MAX / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function FeedbackButton() {
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode | null>(null);

  const hidden =
    !pathname ||
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/request-access") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email");

  if (hidden) return null;

  return (
    <>
      {/* Two separate floating buttons — FAQ on the left, Support on the right */}
      <div className="fixed bottom-5 right-5 z-[9998] flex items-center gap-2">
        <button
          onClick={() => setMode("HOWTO")}
          title="Step-by-step how-tos for what you're trying to do"
          className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-full shadow-lg text-sm font-semibold flex items-center gap-2 transition-all hover:shadow-xl"
        >
          <span className="text-base">💡</span>
          <span className="hidden sm:inline">How do I?</span>
        </button>
        <button
          onClick={() => setMode("TICKET")}
          title="Report a bug, confusion, or request a feature"
          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-lg text-sm font-semibold flex items-center gap-2 transition-all hover:shadow-xl"
        >
          <span className="text-base">🐞</span>
          <span className="hidden sm:inline">Support ticket</span>
        </button>
      </div>
      {mode && <HelpModal initialMode={mode} onClose={() => setMode(null)} />}
    </>
  );
}

function HelpModal({
  initialMode = "LANDING",
  onClose,
}: {
  initialMode?: Mode;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [handoff, setHandoff] = useState<{ question?: string } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Esc to close. If we opened straight into HOWTO/TICKET (no landing), Esc
  // closes. Only back-out to LANDING if we actually came from LANDING.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (initialMode !== "LANDING" || mode === "LANDING") onClose();
      else setMode("LANDING");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, mode, initialMode]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            {mode !== "LANDING" && initialMode === "LANDING" && (
              <button
                onClick={() => setMode("LANDING")}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                aria-label="Back"
                title="Back"
              >
                ←
              </button>
            )}
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {mode === "LANDING" && "💬 How can we help?"}
                {mode === "HOWTO" && "🧭 How do I…?"}
                {mode === "TICKET" && "🐛 Report a problem"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {mode === "LANDING" && "Pick a path — quick answers or tell us what's wrong."}
                {mode === "HOWTO" && "Answers tuned to this page and your role."}
                {mode === "TICKET" && "Andrew reviews these. You'll be notified when it's fixed."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {mode === "LANDING" && (
            <LandingPicker
              onPick={(m) => {
                setHandoff(null);
                setMode(m);
              }}
            />
          )}
          {mode === "HOWTO" && (
            <HowToView
              onEscalate={(question) => {
                setHandoff({ question });
                setMode("TICKET");
              }}
            />
          )}
          {mode === "TICKET" && (
            <TicketForm
              initialTitle={handoff?.question || ""}
              initialDescription={
                handoff?.question
                  ? `I couldn't find an answer to: "${handoff.question}"\n\nWhat I was trying to do:\n`
                  : ""
              }
              onClose={onClose}
              modalRef={modalRef}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Landing — pick a mode
   ────────────────────────────────────────────────────────────── */
function LandingPicker({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        onClick={() => onPick("HOWTO")}
        className="group text-left p-5 rounded-xl border-2 border-slate-200 hover:border-[#00b4c3] hover:bg-cyan-50 transition-all"
      >
        <div className="text-3xl mb-2">🧭</div>
        <div className="text-base font-black text-slate-900 mb-1">How do I…?</div>
        <div className="text-xs text-slate-600 leading-relaxed">
          Step-by-step instructions for the thing you&apos;re trying to do. We pick answers based on
          the page you&apos;re on and your role.
        </div>
      </button>

      <button
        onClick={() => onPick("TICKET")}
        className="group text-left p-5 rounded-xl border-2 border-slate-200 hover:border-rose-400 hover:bg-rose-50 transition-all"
      >
        <div className="text-3xl mb-2">🐛</div>
        <div className="text-base font-black text-slate-900 mb-1">Report a problem</div>
        <div className="text-xs text-slate-600 leading-relaxed">
          Something&apos;s broken, confusing, or missing — or you have an idea. Drop a screenshot
          and we&apos;ll get it fixed.
        </div>
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   How-Do-I view
   ────────────────────────────────────────────────────────────── */
function HowToView({ onEscalate }: { onEscalate: (question: string) => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HowToEntry[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [catalogSize, setCatalogSize] = useState<number>(0);
  const [searched, setSearched] = useState(false);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch results whenever query (debounced) or path changes
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (debounced.trim()) params.set("q", debounced.trim());
        if (pathname) params.set("path", pathname);
        const res = await fetch(`/api/how-to?${params.toString()}`);
        const j = await res.json();
        if (!j.ok) throw new Error(j.error || "Search failed");
        if (!cancelled) {
          setResults(j.results || []);
          setCatalogSize(j.catalogSize || 0);
          setSearched(true);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [debounced, pathname]);

  const hasQuery = debounced.trim().length > 0;
  const noResults = searched && !loading && results.length === 0;

  const headingText = useMemo(() => {
    if (hasQuery) return `Answers matching "${debounced.trim()}"`;
    if (pathname && pathname !== "/") return `Relevant to this page`;
    return "Top answers";
  }, [hasQuery, debounced, pathname]);

  return (
    <div className="space-y-5">
      {/* Search box */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
          What do you want to do?
        </label>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. submit a fabric, request a test, add a factory…"
            className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3] outline-none"
            autoFocus
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">
          We&apos;re on <code className="px-1 py-0.5 bg-slate-100 rounded">{pathname || "/"}</code>{" "}
          — we surface answers tied to this page first.
        </p>
      </div>

      {/* Heading */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-700 uppercase">{headingText}</h3>
        {loading && <span className="text-[11px] text-slate-400">Searching…</span>}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      {/* Results */}
      {!error && !noResults && results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <HowToCard
              key={r.id}
              entry={r}
              expanded={!!expanded[r.id]}
              onToggle={() => setExpanded((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
            />
          ))}
        </div>
      )}

      {/* No-results escalation */}
      {noResults && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="text-2xl mb-1">🤷‍♂️</div>
          <p className="text-sm font-bold text-slate-900 mb-1">
            We don&apos;t have a how-to for that yet.
          </p>
          <p className="text-xs text-slate-600 mb-3">
            Open a support ticket and your question is pre-filled. We&apos;ll add a how-to when we
            answer it so the next person gets an instant reply.
          </p>
          <button
            onClick={() => onEscalate(query.trim() || debounced.trim())}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold"
          >
            Open a support ticket →
          </button>
        </div>
      )}

      {/* Soft escalation — always show if there IS a query and we got some hits */}
      {!noResults && hasQuery && (
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">Not what you&apos;re looking for?</span>
          <button
            onClick={() => onEscalate(query.trim())}
            className="px-3 py-1.5 border border-slate-300 hover:border-slate-900 text-slate-700 hover:text-slate-900 rounded-md font-semibold"
          >
            Open a support ticket
          </button>
        </div>
      )}

      {/* Catalog size note */}
      {catalogSize > 0 && !hasQuery && (
        <p className="text-[11px] text-slate-400 text-center pt-2">
          Showing {results.length} of {catalogSize} how-tos. Search to find more.
        </p>
      )}
    </div>
  );
}

function HowToCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: HowToEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-lg border transition-all ${
        expanded
          ? "border-[#00b4c3] bg-cyan-50/40"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-start gap-3"
      >
        <span className={`mt-0.5 text-base ${expanded ? "rotate-90" : ""} transition-transform`}>
          ▶
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-slate-900">{entry.title}</div>
          <div className="text-xs text-slate-600 mt-0.5">{entry.shortAnswer}</div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pl-11 space-y-3">
          <ol className="space-y-2">
            {entry.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-700">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#00b4c3] text-white text-[11px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>

          {entry.relatedLinks && entry.relatedLinks.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {entry.relatedLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:border-[#00b4c3] hover:text-[#00b4c3]"
                >
                  {l.label} →
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Ticket form (the original feedback flow, with optional prefill)
   ────────────────────────────────────────────────────────────── */
function TicketForm({
  initialTitle,
  initialDescription,
  onClose,
  modalRef,
}: {
  initialTitle: string;
  initialDescription: string;
  onClose: () => void;
  modalRef: React.RefObject<HTMLDivElement | null>;
}) {
  // If we arrived here from a How-Do-I miss, pre-select CONFUSING so triage
  // knows this was a how-do-I that we didn't have an answer for.
  const [category, setCategory] = useState<string>(initialTitle ? "CONFUSING" : "");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const descRef = useRef<HTMLTextAreaElement>(null);

  // Paste handler — image anywhere in the modal
  useEffect(() => {
    const node = modalRef.current;
    if (!node) return;
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            try {
              const dataUrl = await fileToCompressedDataUrl(file);
              setScreenshot(dataUrl);
            } catch (err: any) {
              setError("Couldn't read pasted image: " + err.message);
            }
          }
          e.preventDefault();
          break;
        }
      }
    };
    node.addEventListener("paste", onPaste);
    return () => node.removeEventListener("paste", onPaste);
  }, [modalRef]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Only image files please (png, jpg, webp)");
      return;
    }
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setScreenshot(dataUrl);
      setError(null);
    } catch (err: any) {
      setError("Couldn't read image: " + err.message);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const submit = async () => {
    if (!category) {
      setError("Pick what kind of thing you're reporting");
      return;
    }
    if (!title.trim()) {
      setError("A short title helps us triage — one sentence is fine");
      return;
    }
    if (!description.trim()) {
      setError("Tell us what happened or what you were trying to do");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        category,
        title: title.trim(),
        description: description.trim(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        referer: document.referrer || null,
        screenshotDataUrl: screenshot || null,
      };
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Submission failed");
      setSuccess("Thanks! We got it. You'll hear back when it's fixed.");
      setTimeout(() => onClose(), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="text-5xl mb-3">✅</div>
        <p className="text-slate-900 font-bold text-lg">{success}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {initialTitle && (
        <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-xs text-slate-700">
          💡 We pre-filled this from your how-to question. Edit if it doesn&apos;t match what you
          meant — the more detail the better.
        </div>
      )}

      {/* Category chips */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
          What kind of thing is this?
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`text-left px-3 py-2 rounded-lg border-2 transition-all text-xs ${
                category === c.id
                  ? "border-[#00b4c3] bg-cyan-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{c.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
          One-line summary *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Factory dropdown is empty on order creation"
          maxLength={250}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3] outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") descRef.current?.focus();
          }}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
          What happened? What were you trying to do? *
        </label>
        <textarea
          ref={descRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Steps to reproduce help a lot. Example: 'Clicked Create Order → picked customer → the factory dropdown shows no options.'"
          rows={5}
          maxLength={10000}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3] outline-none resize-y"
        />
      </div>

      {/* Screenshot drop zone */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
          Screenshot{" "}
          <span className="text-slate-400 font-normal normal-case text-[10px]">
            — paste with ⌘V / Ctrl+V, drop an image, or pick a file
          </span>
        </label>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          {screenshot ? (
            <div className="space-y-2">
              <img
                src={screenshot}
                alt="Screenshot preview"
                className="max-h-48 mx-auto rounded-md border border-slate-200"
              />
              <button
                onClick={() => setScreenshot(null)}
                className="text-xs text-red-600 hover:text-red-800 font-semibold"
              >
                Remove screenshot
              </button>
            </div>
          ) : (
            <>
              <div className="text-2xl mb-1">📎</div>
              <p className="text-xs text-slate-500 mb-2">
                Paste a screenshot or drop an image here
              </p>
              <label className="inline-block px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold cursor-pointer hover:bg-slate-50">
                Browse files
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </label>
            </>
          )}
        </div>
      </div>

      {/* Auto-captured context note */}
      <div className="text-[11px] text-slate-400 italic border-t border-slate-100 pt-3">
        We&apos;ll automatically include: this page&apos;s URL, your user role, your browser and
        screen size. No passwords, no form contents.
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="px-5 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009ba8] disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Send it"}
        </button>
      </div>
    </div>
  );
}
