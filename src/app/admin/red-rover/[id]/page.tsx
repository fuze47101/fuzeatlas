"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { HydrationFrame, useMountLog } from "@/components/HydrationFrame";
import { stageDefaultProb, effectiveProb, weightedValue, fmtUsd } from "@/lib/red-rover-ui";

/* ── Types ─────────────────────────────────────────────── */
interface Contact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  side: string;
  role: string;
  notes: string | null;
}
interface Activity {
  id: string;
  type: string;
  body: string;
  userId: string | null;
  occurredAt: string;
  createdAt: string;
}
interface Target {
  id: string;
  name: string;
  rank: number | null;
  tier: string;
  companyClass: string | null;
  geo: string | null;
  stage: string;
  ownerId: string | null;
  owner: { id: string; name: string } | null;
  initialContact: string | null;
  keyMeetings: string | null;
  currentAgreements: string | null;
  currentStatus: string | null;
  nextStep: string | null;
  whoDroveIt: string | null;
  intel: string | null;
  projectedValueUsd: number | null;
  winProbabilityPct: number | null;
  lastActivityAt: string | null;
  contacts: Contact[];
  activities: Activity[];
  attachments: Attachment[];
}
interface Attachment {
  id: string;
  filename: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  url: string | null;
  createdAt: string;
}
interface Owner {
  id: string;
  name: string;
}

const STAGE_ORDER = [
  "IDENTIFIED",
  "CONTACTED",
  "PRESENTATION",
  "TESTING",
  "AGREEMENT",
  "ACTIVE",
  "STALLED",
  "PARKED",
];
const STAGE_COLORS: Record<string, string> = {
  IDENTIFIED: "bg-slate-100 text-slate-700",
  CONTACTED: "bg-sky-100 text-sky-800",
  PRESENTATION: "bg-indigo-100 text-indigo-800",
  TESTING: "bg-violet-100 text-violet-800",
  AGREEMENT: "bg-amber-100 text-amber-900",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  STALLED: "bg-rose-100 text-rose-800",
  PARKED: "bg-gray-200 text-gray-600",
};
const ACTIVITY_TYPES = ["NOTE", "MEETING", "EMAIL", "STATUS_CHANGE", "MILESTONE"];
const ACTIVITY_ICON: Record<string, string> = {
  NOTE: "📝",
  MEETING: "🤝",
  EMAIL: "✉️",
  STATUS_CHANGE: "🔀",
  MILESTONE: "🏁",
};

/* ── Page ──────────────────────────────────────────────── */
export default function RedRoverDossierOuter() {
  return (
    <HydrationFrame name="/admin/red-rover/[id]">
      <RedRoverDossier />
    </HydrationFrame>
  );
}

function RedRoverDossier() {
  useMountLog("red-rover-dossier");
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const router = useRouter();
  const { user, loading } = useAuth();

  const [target, setTarget] = useState<Target | null>(null);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  const isAdmin = !!user && ["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role);

  const load = useCallback(async () => {
    if (!id) return;
    setFetching(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/red-rover/${id}`, { cache: "no-store" });
      if (!res.ok) {
        setErr(`API ${res.status}`);
      } else {
        const j = await res.json();
        setTarget(j.target);
        setOwners(j.owners || []);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setFetching(false);
    }
  }, [id]);

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) {
      router.replace("/home");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAdmin, id]);

  const patch = useCallback(
    async (data: Record<string, any>) => {
      const res = await fetch(`/api/admin/red-rover/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || `Update failed (${res.status})`);
        return false;
      }
      await load();
      return true;
    },
    [id, load],
  );

  if (loading || (fetching && !target)) {
    return <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-slate-500">Loading dossier…</div>;
  }
  if (!isAdmin) return null;
  if (err && !target) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Failed to load target: {err}
        </div>
        <Link href="/admin/red-rover" className="mt-4 inline-block text-sm text-rose-700 hover:underline">
          ← Back to Red Rover
        </Link>
      </div>
    );
  }
  if (!target) return null;

  async function deleteTarget() {
    if (!confirm(`Delete "${target!.name}" and all its contacts + activity? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/red-rover/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/red-rover");
    else alert("Delete failed");
  }

  const negotiation = target.contacts.filter((c) => c.role === "NEGOTIATION");
  const gatekeepers = target.contacts.filter((c) => c.role === "TECHNICAL_GATEKEEPER");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link href="/admin/red-rover" className="text-sm text-rose-700 hover:underline">
        ← Back to Red Rover
      </Link>

      {/* ── Header ── */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            <InlineText
              value={target.name}
              className="text-2xl font-bold text-slate-900"
              onSave={(v) => patch({ name: v })}
            />
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <InlineText
                value={target.companyClass || ""}
                placeholder="+ class"
                onSave={(v) => patch({ companyClass: v })}
              />
              <span>·</span>
              <InlineText value={target.geo || ""} placeholder="+ geo" onSave={(v) => patch({ geo: v })} />
            </div>
          </div>
          <button
            onClick={deleteTarget}
            className="rounded border border-rose-200 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50"
          >
            🗑 Delete
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HeaderSelect
            label="Stage"
            value={target.stage}
            options={STAGE_ORDER}
            onChange={(v) => patch({ stage: v })}
            badgeClass={STAGE_COLORS[target.stage]}
          />
          <HeaderSelect
            label="Tier"
            value={target.tier}
            options={["TIER1", "TIER2", "PARKED"]}
            onChange={(v) => patch({ tier: v })}
          />
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Owner</div>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={target.ownerId || ""}
              onChange={(e) => patch({ ownerId: e.target.value })}
            >
              <option value="">Unassigned</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Rank</div>
            <InlineText
              value={target.rank != null ? String(target.rank) : ""}
              placeholder="—"
              className="mt-1 block text-sm"
              onSave={(v) => patch({ rank: v === "" ? null : Number(v) })}
            />
          </div>
        </div>
        {target.lastActivityAt && (
          <div className="mt-3 text-xs text-slate-400">
            Last activity: {new Date(target.lastActivityAt).toLocaleString()}
          </div>
        )}

        {/* Forecast editor */}
        <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-slate-100 pt-3">
          <label className="text-xs text-slate-500">
            Projected value (USD)
            <div className="mt-0.5 flex items-center">
              <span className="mr-1 text-slate-400">$</span>
              <InlineText
                value={target.projectedValueUsd != null ? String(target.projectedValueUsd) : ""}
                placeholder="—"
                className="text-sm font-semibold"
                onSave={(v) => patch({ projectedValueUsd: v === "" ? null : Number(v) })}
              />
            </div>
          </label>
          <label className="text-xs text-slate-500">
            Win probability (%)
            <div className="mt-0.5">
              <InlineText
                value={target.winProbabilityPct != null ? String(target.winProbabilityPct) : ""}
                placeholder={`${stageDefaultProb(target.stage)} (stage default)`}
                className="text-sm font-semibold"
                onSave={(v) => patch({ winProbabilityPct: v === "" ? null : Number(v) })}
              />
            </div>
          </label>
          <div className="text-xs text-slate-500">
            Effective
            <div className="mt-0.5 text-sm font-semibold text-slate-800">
              {effectiveProb(target.stage, target.winProbabilityPct)}%
              {target.winProbabilityPct == null && <span className="ml-1 text-[10px] font-normal text-slate-400">(default)</span>}
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Weighted value
            <div className="mt-0.5 text-sm font-bold text-emerald-600">
              {fmtUsd(weightedValue(target.projectedValueUsd, target.winProbabilityPct, target.stage))}
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Next Best Action ── */}
      <NextActionPanel targetId={id} onLogged={load} />

      {/* ── Questionnaire cards ── */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <EditableCard label="Initial contact (who / when)" value={target.initialContact} onSave={(v) => patch({ initialContact: v })} />
        <EditableCard label="Key meetings & dates" value={target.keyMeetings} onSave={(v) => patch({ keyMeetings: v })} />
        <EditableCard label="Current agreements (NDA / MOU / pricing / terms)" value={target.currentAgreements} onSave={(v) => patch({ currentAgreements: v })} />
        <EditableCard label="Current status" value={target.currentStatus} onSave={(v) => patch({ currentStatus: v })} />
        <EditableCard label="Next step" value={target.nextStep} onSave={(v) => patch({ nextStep: v })} />
        <EditableCard label="Who drove it" value={target.whoDroveIt} onSave={(v) => patch({ whoDroveIt: v })} />
        <div className="md:col-span-2">
          <EditableCard label="Intel (levers · competitive · regulatory catalyst)" value={target.intel} onSave={(v) => patch({ intel: v })} />
        </div>
      </div>

      {/* ── Contacts ── */}
      <ContactsPanel targetId={id} negotiation={negotiation} gatekeepers={gatekeepers} onChange={load} />

      {/* ── Attachments ── */}
      <AttachmentsPanel targetId={id} attachments={target.attachments} onChange={load} />

      {/* ── Activity feed ── */}
      <ActivityPanel targetId={id} activities={target.activities} owners={owners} onChange={load} />
    </div>
  );
}

/* ── Inline text editor (single line) ──────────────────── */
function InlineText({
  value,
  onSave,
  className = "",
  placeholder = "—",
}: {
  value: string;
  onSave: (v: string) => Promise<boolean | void> | void;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={`text-left hover:bg-amber-50 ${className} ${!value ? "text-slate-400" : ""}`}
        title="Click to edit"
      >
        {value || placeholder}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        className="rounded border border-amber-300 px-1.5 py-0.5 text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(draft);
            setEditing(false);
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
      <button
        className="rounded bg-emerald-600 px-1.5 py-0.5 text-xs text-white"
        onClick={() => {
          onSave(draft);
          setEditing(false);
        }}
      >
        ✓
      </button>
      <button
        className="rounded bg-slate-200 px-1.5 py-0.5 text-xs"
        onClick={() => {
          setDraft(value);
          setEditing(false);
        }}
      >
        ✕
      </button>
    </span>
  );
}

/* ── Header select with optional badge ─────────────────── */
function HeaderSelect({
  label,
  value,
  options,
  onChange,
  badgeClass,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  badgeClass?: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <select
        className={`mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-medium ${badgeClass || ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ── Editable multi-line card ──────────────────────────── */
function EditableCard({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (v: string) => Promise<boolean | void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(value || ""), [value]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-rose-600 hover:underline">
            {value ? "Edit" : "+ Add"}
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <textarea
            autoFocus
            rows={4}
            className="w-full rounded border border-amber-300 px-2 py-1.5 text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onSave(draft.trim());
                setBusy(false);
                setEditing(false);
              }}
              className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setDraft(value || "");
                setEditing(false);
              }}
              className="rounded bg-slate-200 px-2.5 py-1 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-slate-700">
          {value || <span className="text-slate-400">Not set.</span>}
        </p>
      )}
    </div>
  );
}

/* ── AI Next Best Action ───────────────────────────────── */
function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function NextActionPanel({ targetId, onLogged }: { targetId: string; onLogged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<string | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    setErr(null);
    setFlagged(null);
    try {
      const res = await fetch(`/api/admin/red-rover/${targetId}/next-action`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || `API ${res.status}`);
        return;
      }
      setGenerated(true);
      if (j.flagged || !j.draftEmail) {
        setFlagged(j.flagReason || "Could not produce a brand-voice-compliant draft.");
        setActions(j.nextActions || []);
        setTo("");
        setSubject("");
        setBody("");
        return;
      }
      setActions(j.nextActions || []);
      setTo(j.draftEmail.to || "");
      setSubject(j.draftEmail.subject || "");
      setBody(htmlToText(j.draftEmail.bodyHtml || ""));
    } catch (e: any) {
      setErr(e?.message || "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  function copyDraft() {
    const text = `To: ${to}\nSubject: ${subject}\n\n${body}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function openMail() {
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  }

  async function logActivity() {
    const summary =
      `Drafted outreach${to ? ` to ${to}` : ""}: "${subject}".` +
      (actions.length ? `\n\nRecommended next actions:\n- ${actions.join("\n- ")}` : "") +
      (body ? `\n\nDraft:\n${body}` : "");
    const res = await fetch(`/api/admin/red-rover/${targetId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "NOTE", body: summary }),
    });
    if (res.ok) onLogged();
    else alert("Could not log activity");
  }

  return (
    <div className="mt-4 rounded-lg border border-rose-200 bg-gradient-to-r from-rose-50 to-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">🤖 Next Best Action</h2>
        <button
          onClick={generate}
          disabled={busy}
          className="rounded bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {busy ? "Thinking…" : generated ? "Regenerate" : "✨ Generate"}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        AI recommends the next moves + drafts an outreach email in FUZE voice. Review before sending — nothing is sent automatically.
      </p>

      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
      {flagged && (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⚠ Draft dropped — could not comply with the brand-voice / EPA-scope guard ({flagged}). Try regenerating.
        </div>
      )}

      {actions.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended next actions</div>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            {actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ol>
        </div>
      )}

      {generated && !flagged && (
        <div className="mt-4 rounded border border-slate-200 bg-white p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Draft outreach (editable)</div>
          <div className="space-y-2">
            <label className="block text-xs text-slate-500">
              To
              <input className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <label className="block text-xs text-slate-500">
              Subject
              <input className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
            <label className="block text-xs text-slate-500">
              Body
              <textarea rows={8} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={copyDraft} className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button onClick={openMail} className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
              ✉️ Open in mail
            </button>
            <button onClick={logActivity} className="rounded bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800">
              Log as activity
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Contacts panel ────────────────────────────────────── */
function ContactsPanel({
  targetId,
  negotiation,
  gatekeepers,
  onChange,
}: {
  targetId: string;
  negotiation: Contact[];
  gatekeepers: Contact[];
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);

  async function del(contactId: string) {
    if (!confirm("Delete this contact?")) return;
    const res = await fetch(`/api/admin/red-rover/${targetId}/contacts?contactId=${contactId}`, {
      method: "DELETE",
    });
    if (res.ok) onChange();
    else alert("Delete failed");
  }

  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Contacts</h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
        >
          + Add contact
        </button>
      </div>

      {adding && (
        <ContactForm
          targetId={targetId}
          onDone={() => {
            setAdding(false);
            onChange();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ContactGroup
          title="Negotiation contacts"
          accent="text-rose-700"
          contacts={negotiation}
          targetId={targetId}
          onChange={onChange}
          onDelete={del}
        />
        <ContactGroup
          title="Technical gatekeepers"
          accent="text-violet-700"
          contacts={gatekeepers}
          targetId={targetId}
          onChange={onChange}
          onDelete={del}
        />
      </div>
    </div>
  );
}

function ContactGroup({
  title,
  accent,
  contacts,
  targetId,
  onChange,
  onDelete,
}: {
  title: string;
  accent: string;
  contacts: Contact[];
  targetId: string;
  onChange: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded border border-slate-100 bg-slate-50 p-3">
      <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${accent}`}>
        {title} ({contacts.length})
      </div>
      {contacts.length === 0 && <p className="text-xs text-slate-400">None yet.</p>}
      <div className="space-y-2">
        {contacts.map((c) => (
          <ContactCard key={c.id} contact={c} targetId={targetId} onChange={onChange} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function ContactCard({
  contact,
  targetId,
  onChange,
  onDelete,
}: {
  contact: Contact;
  targetId: string;
  onChange: () => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <ContactForm
        targetId={targetId}
        contact={contact}
        onDone={() => {
          setEditing(false);
          onChange();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }
  return (
    <div className="rounded border border-slate-200 bg-white p-2 text-sm">
      <div className="flex items-start justify-between">
        <div>
          <span className="font-medium text-slate-800">{contact.name}</span>
          {contact.side === "FUZE" && (
            <span className="ml-1 rounded bg-blue-100 px-1 text-[10px] font-medium text-blue-700">FUZE</span>
          )}
          {contact.title && <div className="text-xs text-slate-500">{contact.title}</div>}
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="text-xs text-rose-600 hover:underline">
              {contact.email}
            </a>
          )}
          {contact.notes && <div className="mt-0.5 text-xs italic text-slate-500">{contact.notes}</div>}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setEditing(true)} className="text-xs text-slate-500 hover:underline">
            edit
          </button>
          <button onClick={() => onDelete(contact.id)} className="text-xs text-rose-500 hover:underline">
            del
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactForm({
  targetId,
  contact,
  onDone,
  onCancel,
}: {
  targetId: string;
  contact?: Contact;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    name: contact?.name || "",
    title: contact?.title || "",
    email: contact?.email || "",
    side: contact?.side || "TARGET",
    role: contact?.role || "NEGOTIATION",
    notes: contact?.notes || "",
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    setBusy(true);
    const isEdit = !!contact;
    const res = await fetch(`/api/admin/red-rover/${targetId}/contacts`, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? { contactId: contact!.id, ...f } : f),
    });
    setBusy(false);
    if (res.ok) onDone();
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Save failed");
    }
  }

  return (
    <form onSubmit={submit} className="mb-3 grid grid-cols-2 gap-2 rounded border border-amber-200 bg-amber-50 p-3">
      <input
        className="rounded border border-slate-300 px-2 py-1 text-sm"
        placeholder="Name *"
        value={f.name}
        onChange={(e) => setF({ ...f, name: e.target.value })}
        required
      />
      <input
        className="rounded border border-slate-300 px-2 py-1 text-sm"
        placeholder="Title"
        value={f.title}
        onChange={(e) => setF({ ...f, title: e.target.value })}
      />
      <input
        className="col-span-2 rounded border border-slate-300 px-2 py-1 text-sm"
        placeholder="Email"
        value={f.email}
        onChange={(e) => setF({ ...f, email: e.target.value })}
      />
      <select
        className="rounded border border-slate-300 px-2 py-1 text-sm"
        value={f.side}
        onChange={(e) => setF({ ...f, side: e.target.value })}
      >
        <option value="TARGET">Side: TARGET</option>
        <option value="FUZE">Side: FUZE</option>
      </select>
      <select
        className="rounded border border-slate-300 px-2 py-1 text-sm"
        value={f.role}
        onChange={(e) => setF({ ...f, role: e.target.value })}
      >
        <option value="NEGOTIATION">NEGOTIATION</option>
        <option value="TECHNICAL_GATEKEEPER">TECHNICAL_GATEKEEPER</option>
      </select>
      <input
        className="col-span-2 rounded border border-slate-300 px-2 py-1 text-sm"
        placeholder="Notes"
        value={f.notes}
        onChange={(e) => setF({ ...f, notes: e.target.value })}
      />
      <div className="col-span-2 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : contact ? "Save" : "Add"}
        </button>
        <button type="button" onClick={onCancel} className="rounded bg-slate-200 px-2.5 py-1 text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ── Attachments ───────────────────────────────────────── */
function fmtBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentsPanel({
  targetId,
  attachments,
  onChange,
}: {
  targetId: string;
  attachments: Attachment[];
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      // 1) presigned URL
      const pre = await fetch(`/api/admin/red-rover/${targetId}/attachments/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream" }),
      });
      const pj = await pre.json();
      if (!pre.ok) throw new Error(pj.error || "Could not get upload URL");
      // 2) PUT to S3
      const put = await fetch(pj.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error(`S3 upload failed (${put.status})`);
      // 3) record the Document
      const rec = await fetch(`/api/admin/red-rover/${targetId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || null,
          sizeBytes: file.size,
          s3Key: pj.s3Key,
          bucket: pj.bucket,
          publicUrl: pj.publicUrl,
        }),
      });
      if (!rec.ok) {
        const rj = await rec.json().catch(() => ({}));
        throw new Error(rj.error || "Could not record attachment");
      }
      onChange();
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function del(docId: string) {
    if (!confirm("Delete this attachment?")) return;
    const res = await fetch(`/api/admin/red-rover/${targetId}/attachments?docId=${docId}`, { method: "DELETE" });
    if (res.ok) onChange();
    else alert("Delete failed");
  }

  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Attachments <span className="font-normal text-slate-400">(NDAs · term sheets · dossier PDFs)</span></h2>
        <label className="cursor-pointer rounded bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700">
          {busy ? "Uploading…" : "＋ Upload"}
          <input
            type="file"
            className="hidden"
            disabled={busy}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {err && <div className="mb-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">{err}</div>}
      {attachments.length === 0 ? (
        <p className="text-sm text-slate-400">No attachments yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-1.5 text-sm">
              <a href={a.url || "#"} target="_blank" rel="noopener noreferrer" className="text-rose-700 hover:underline">
                📎 {a.filename || "file"}
              </a>
              <span className="flex items-center gap-3 text-xs text-slate-400">
                <span>{fmtBytes(a.sizeBytes)}</span>
                <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                <button onClick={() => del(a.id)} className="text-rose-500 hover:underline">del</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Activity feed ─────────────────────────────────────── */
function ActivityPanel({
  targetId,
  activities,
  owners,
  onChange,
}: {
  targetId: string;
  activities: Activity[];
  owners: Owner[];
  onChange: () => void;
}) {
  const [type, setType] = useState("NOTE");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [busy, setBusy] = useState(false);

  const ownerName = (uid: string | null) => owners.find((o) => o.id === uid)?.name || null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/admin/red-rover/${targetId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, body: body.trim(), occurredAt: occurredAt || undefined }),
    });
    setBusy(false);
    if (res.ok) {
      setBody("");
      setOccurredAt("");
      setType("NOTE");
      onChange();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Log failed");
    }
  }

  // Time-ordered, newest first (activities arrive reverse-chron from the API).
  const ordered = [...activities].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">Timeline</h2>

      {/* Vertical time-ordered timeline (above the log form) */}
      {ordered.length === 0 ? (
        <p className="mb-4 text-sm text-slate-400">No activity logged yet.</p>
      ) : (
        <ol className="relative mb-5 ml-3 border-l-2 border-slate-200">
          {ordered.map((a) => (
            <li key={a.id} className="relative ml-5 pb-5 last:pb-0">
              <span className="absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] ring-2 ring-slate-200">
                {ACTIVITY_ICON[a.type] || "•"}
              </span>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{a.type}</span>
                <span>·</span>
                <time>{new Date(a.occurredAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</time>
                {ownerName(a.userId) && (
                  <>
                    <span>·</span>
                    <span>{ownerName(a.userId)}</span>
                  </>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{a.body}</p>
            </li>
          ))}
        </ol>
      )}

      {/* Always-visible log form (below the timeline) */}
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Log activity</div>
      <form onSubmit={submit} className="rounded border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_ICON[t]} {t}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            title="Occurred at (defaults to now)"
          />
        </div>
        <textarea
          rows={2}
          className="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Log an activity — call, email, meeting, milestone…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="mt-2 rounded bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {busy ? "Logging…" : "Log activity"}
        </button>
      </form>
    </div>
  );
}
