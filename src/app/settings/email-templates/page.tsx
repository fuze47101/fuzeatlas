"use client";
// @ts-nocheck

/**
 * /settings/email-templates — manage saved email templates (ticket #24).
 *
 * Reps can:
 *   - See their PRIVATE templates + all SHARED + GLOBAL ones they can use.
 *   - Create new templates (PRIVATE by default; SHARED optional; GLOBAL admin-only).
 *   - Edit/archive templates they own; admins can edit anything.
 *   - Test the substitution preview with a sample contact + brand.
 *
 * UX choice: keep this all on one page (no modal flow). Reps do this once a
 * week max — a simple form-list combo keeps it learnable.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { renderTemplate } from "@/lib/email-template-vars";
import { useI18n } from "@/i18n";

interface Template {
  id: string;
  title: string;
  subject: string;
  body: string;
  category: string | null;
  scope: "PRIVATE" | "SHARED" | "GLOBAL";
  useCount: number;
  ownerId: string | null;
  owner?: { id: string; name: string; email: string } | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** BD Wizard quick-pick slot 1-10 — PRIVATE templates only. */
  bdSlot?: number | null;
}

interface Me {
  id: string;
  role: string;
  name: string;
  email: string;
}

const EMPTY_FORM = {
  title: "",
  subject: "",
  body: "",
  category: "",
  scope: "PRIVATE" as Template["scope"],
};

export default function EmailTemplatesSettings() {
  const { t } = useI18n();
  const T = t.settingsEmailTemplates;
  const [me, setMe] = useState<Me | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Preview pane uses these dummy values to show what the template will look
  // like after substitution. Reps can override to test their own scenarios.
  const [previewVars, setPreviewVars] = useState({
    firstName: "Sarah",
    lastName: "Chen",
    company: "Acme Apparel",
    title: "VP of Product",
  });

  const isAdmin = me?.role === "ADMIN";

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [meRes, tplRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/email-templates"),
      ]);
      const meJ = await meRes.json();
      const tplJ = await tplRes.json();
      if (!meJ.ok) throw new Error(meJ.error || T.errorLoadUser);
      if (!tplJ.ok) throw new Error(tplJ.error || T.errorLoadTemplates);
      setMe(meJ.user);
      setTemplates(tplJ.templates || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (tpl: Template) => {
    setEditingId(tpl.id);
    setShowAdd(false);
    setForm({
      title: tpl.title,
      subject: tpl.subject,
      body: tpl.body,
      category: tpl.category || "",
      scope: tpl.scope,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowAdd(false);
    setForm(EMPTY_FORM);
    setError("");
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.subject.trim() || !form.body.trim()) {
      setError(T.errorRequired);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = editingId ? `/api/email-templates/${editingId}` : "/api/email-templates";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      cancelEdit();
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (tpl: Template) => {
    if (!confirm(T.confirmArchive.replace("{title}", tpl.title))) return;
    try {
      const res = await fetch(`/api/email-templates/${tpl.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  /**
   * Pin/unpin a template to a BD Wizard quick-pick slot (1-10). Passing
   * slot=null clears the pin. Server-side we displace whatever other
   * template is currently in that slot so we never hit the unique constraint
   * from the client (see PATCH handler in /api/email-templates/[id]).
   */
  const handleSlotChange = async (tpl: Template, slot: number | null) => {
    setError("");
    try {
      const res = await fetch(`/api/email-templates/${tpl.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bdSlot: slot }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const canEdit = (tpl: Template) => {
    if (isAdmin) return true;
    if (tpl.scope === "GLOBAL") return false;
    return tpl.ownerId === me?.id;
  };

  // Live preview of the form being edited.
  const preview = renderTemplate({ subject: form.subject, body: form.body }, previewVars);

  // Group templates by scope for cleaner display.
  const grouped = {
    PRIVATE: templates.filter((t) => t.scope === "PRIVATE"),
    SHARED: templates.filter((t) => t.scope === "SHARED"),
    GLOBAL: templates.filter((t) => t.scope === "GLOBAL"),
  };

  // BD Wizard quick-pick map (#100). Build a slot-1 → slot-10 array out of
  // the user's PRIVATE templates so the "Your quick-pick slots" panel can
  // render all 10 buckets — including the empty ones so it's obvious where
  // the rep has headroom left.
  const mySlotMap: Array<Template | null> = Array.from({ length: 10 }, () => null);
  for (const t of grouped.PRIVATE) {
    if (t.ownerId === me?.id && t.bdSlot && t.bdSlot >= 1 && t.bdSlot <= 10) {
      mySlotMap[t.bdSlot - 1] = t;
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/settings" className="text-xs text-slate-500 hover:text-slate-700">
            {T.backToSettings}
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{T.pageTitle}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {T.pageSubtitle}
          </p>
        </div>
        {!showAdd && !editingId && (
          <button
            onClick={() => {
              setShowAdd(true);
              setForm(EMPTY_FORM);
              setEditingId(null);
            }}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700"
          >
            {T.btnNew}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {(showAdd || editingId) && (
        <div className="mb-6 grid lg:grid-cols-2 gap-6">
          {/* Editor */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="font-semibold text-slate-900 mb-4">
              {editingId ? T.formHeadingEdit : T.formHeadingNew}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{T.labelTitle}</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder={T.placeholderTitle}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.labelCategory}</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder={T.placeholderCategory}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.labelScope}</label>
                  <select
                    value={form.scope}
                    onChange={(e) =>
                      setForm({ ...form, scope: e.target.value as Template["scope"] })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="PRIVATE">{T.scopePrivate}</option>
                    <option value="SHARED">{T.scopeShared}</option>
                    {isAdmin && <option value="GLOBAL">{T.scopeGlobal}</option>}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{T.labelSubject}</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder={T.placeholderSubject}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{T.labelBody}</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={12}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  placeholder={`Hi {firstName},\n\nI noticed {company} is...`}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
                >
                  {saving ? T.btnSaving : editingId ? T.btnSaveChanges : T.btnCreate}
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
                >
                  {T.btnCancel}
                </button>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h2 className="font-semibold text-slate-900 mb-2">{T.previewHeading}</h2>
            <p className="text-xs text-slate-500 mb-3">
              {T.previewHelp}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(["firstName", "lastName", "company", "title"] as const).map((k) => (
                <input
                  key={k}
                  type="text"
                  value={(previewVars as any)[k]}
                  onChange={(e) => setPreviewVars({ ...previewVars, [k]: e.target.value })}
                  className="rounded border border-slate-300 px-2 py-1 text-xs"
                  placeholder={`{${k}}`}
                />
              ))}
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">{T.previewSubjectLabel}</div>
              <div className="text-sm font-semibold text-slate-900 mb-3">
                {preview.subject || <span className="text-slate-400">—</span>}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">{T.previewBodyLabel}</div>
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">
                {preview.body || <span className="text-slate-400">—</span>}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* BD Wizard quick-pick slot map (#100).
         Renders 10 numbered slots — each showing the pinned template's title
         or "empty". Reps assign templates to slots from the per-row dropdown
         below; the Wizard's Draft step then shows a 1-10 button strip so the
         rep can one-click-inject their favourite opener. Only rendered when
         the user owns at least one PRIVATE template, to keep brand-new
         accounts uncluttered. */}
      {!loading && grouped.PRIVATE.length > 0 && (
        <div className="mb-6 bg-sky-50 border border-sky-200 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-semibold text-slate-900">{T.slotsHeading}</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {T.slotsHelp}
              </p>
            </div>
            <Link
              href="/admin/bd/wizard"
              className="text-xs text-sky-700 hover:underline whitespace-nowrap"
            >
              {T.openBdWizard}
            </Link>
          </div>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
            {mySlotMap.map((tpl, i) => {
              const slot = i + 1;
              return (
                <div
                  key={slot}
                  className={`rounded-lg border p-2 text-center ${
                    tpl
                      ? "bg-white border-sky-300 shadow-sm"
                      : "bg-white/50 border-dashed border-slate-300"
                  }`}
                  title={tpl ? `${tpl.title}\n${tpl.subject}` : T.slotEmptyTitle}
                >
                  <div className="text-[10px] font-bold text-sky-700">{slot}</div>
                  <div className="text-[11px] text-slate-800 leading-tight truncate mt-0.5">
                    {tpl ? tpl.title : <span className="text-slate-400">{T.slotEmpty}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 text-sm">{T.loadingTemplates}</div>
      ) : (
        (["GLOBAL", "SHARED", "PRIVATE"] as const).map((scope) => {
          const list = grouped[scope];
          if (list.length === 0) return null;
          return (
            <div key={scope} className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                {scope === "PRIVATE"
                  ? T.groupPrivate
                  : scope === "SHARED"
                    ? T.groupShared
                    : T.groupGlobal}
                <span className="ml-2 text-slate-400 font-normal normal-case">({list.length})</span>
              </h2>
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {list.map((tpl) => (
                  <div key={tpl.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{tpl.title}</span>
                        {tpl.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            #{tpl.category}
                          </span>
                        )}
                        {tpl.useCount > 0 && (
                          <span className="text-[10px] text-slate-400">{T.usedSuffix} {tpl.useCount}×</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 mt-1 truncate">{tpl.subject}</div>
                      {tpl.owner && tpl.scope !== "PRIVATE" && (
                        <div className="text-[10px] text-slate-400 mt-1">{T.byPrefix} {tpl.owner.name}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {/* BD slot selector — PRIVATE + owned-by-me only.
                         Choose "—" to unpin, 1-10 to pin. Slot reassignment
                         (e.g. slot 3 already has another template) is
                         handled server-side via an atomic displace-then-
                         re-pin transaction. */}
                      {tpl.scope === "PRIVATE" && tpl.ownerId === me?.id && (
                        <label className="flex items-center gap-1 text-[11px] text-slate-600">
                          {T.bdSlot}
                          <select
                            value={tpl.bdSlot || ""}
                            onChange={(e) =>
                              handleSlotChange(
                                tpl,
                                e.target.value === "" ? null : Number(e.target.value),
                              )
                            }
                            className="rounded border border-slate-300 px-1 py-0.5 text-xs bg-white"
                          >
                            <option value="">—</option>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {canEdit(tpl) && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(tpl)}
                            className="text-xs text-sky-600 hover:underline"
                          >
                            {T.edit}
                          </button>
                          <button
                            onClick={() => handleArchive(tpl)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            {T.archive}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {!loading && templates.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
          {T.emptyTpl}
        </div>
      )}
    </div>
  );
}
