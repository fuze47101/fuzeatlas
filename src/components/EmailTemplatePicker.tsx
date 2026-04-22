"use client";
// @ts-nocheck

/**
 * EmailTemplatePicker — dropdown that lists the user's saved email templates
 * and inserts the chosen one (with {variable} substitution applied) into the
 * compose form.
 *
 * Ticket #24 (Viktor 4/17). Designed to drop into any compose surface:
 *   - BD Wizard DraftStep
 *   - Contact email button on /brands/[id]
 *   - Future Outlook compose deep-links
 *
 * Props:
 *   contextVars — optional bag of values for {firstName} / {company} / etc.
 *   onApply     — called with rendered { subject, body } when the user picks
 *                 a template. Caller is responsible for setState on its
 *                 subject/body inputs.
 *
 * Behavior:
 *   - Lazy-loads templates on first open (avoids hammering /api/email-templates
 *     on every brand page mount).
 *   - Fires POST /api/email-templates/[id]/use after applying, so the
 *     "most-used first" sort stays accurate. Fire-and-forget — failures are
 *     logged but never block the compose flow.
 */
import { useState, useEffect, useRef } from "react";
import { renderTemplate, listTemplateVars, type TemplateContext } from "@/lib/email-template-vars";

interface Template {
  id: string;
  title: string;
  subject: string;
  body: string;
  category: string | null;
  scope: "PRIVATE" | "SHARED" | "GLOBAL";
  useCount: number;
  ownerId: string | null;
  owner?: { id: string; name: string } | null;
}

interface Props {
  contextVars?: TemplateContext;
  onApply: (rendered: { subject: string; body: string; templateId: string }) => void;
  className?: string;
  buttonLabel?: string;
}

export function EmailTemplatePicker({
  contextVars,
  onApply,
  className = "",
  buttonLabel = "📋 Templates",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click-outside-to-close — keeps the picker out of the way when the rep
  // gives up and goes back to typing.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const loadTemplates = async () => {
    if (loaded) return; // cache for the session
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/email-templates");
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || "Failed to load templates");
        return;
      }
      setTemplates(j.templates || []);
      setLoaded(true);
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadTemplates();
  };

  const handlePick = async (tpl: Template) => {
    const rendered = renderTemplate(tpl, contextVars || {});
    onApply({ ...rendered, templateId: tpl.id });
    setOpen(false);
    // Fire-and-forget usage tracking — never block the flow.
    fetch(`/api/email-templates/${tpl.id}/use`, { method: "POST" }).catch((e) =>
      console.warn("[EmailTemplatePicker] use-tracker failed:", e),
    );
  };

  const scopeBadge = (scope: Template["scope"]) => {
    if (scope === "GLOBAL") return { label: "GLOBAL", cls: "bg-purple-100 text-purple-700" };
    if (scope === "SHARED") return { label: "SHARED", cls: "bg-sky-100 text-sky-700" };
    return { label: "PRIVATE", cls: "bg-slate-100 text-slate-600" };
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs hover:bg-slate-50 transition"
      >
        {buttonLabel}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-80 max-h-96 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-30">
          <div className="p-3 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Insert template
          </div>
          {loading && <div className="px-3 py-4 text-sm text-slate-500">Loading…</div>}
          {error && <div className="px-3 py-3 text-sm text-red-600 bg-red-50">{error}</div>}
          {!loading && !error && templates.length === 0 && (
            <div className="px-3 py-4 text-sm text-slate-500">
              No templates yet. Create one in Settings → Email Templates.
            </div>
          )}
          {!loading && !error && templates.length > 0 && (
            <div className="py-1">
              {templates.map((tpl) => {
                const badge = scopeBadge(tpl.scope);
                const missingVars = listTemplateVars(tpl.subject + " " + tpl.body).filter((k) => {
                  const v = (contextVars as any)?.[k];
                  return v === undefined || v === null || v === "";
                });
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handlePick(tpl)}
                    className="w-full text-left px-3 py-2 hover:bg-sky-50 border-b border-slate-50 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-slate-900 truncate">
                        {tpl.title}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">{tpl.subject}</div>
                    {tpl.category && (
                      <div className="text-[10px] text-slate-400 mt-1">#{tpl.category}</div>
                    )}
                    {missingVars.length > 0 && (
                      <div className="text-[10px] text-amber-600 mt-1">
                        ⚠ Unfilled: {missingVars.map((v) => "{" + v + "}").join(" ")}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500">
            Tokens like {"{firstName}"}, {"{company}"} are replaced from the current contact.
          </div>
        </div>
      )}
    </div>
  );
}
