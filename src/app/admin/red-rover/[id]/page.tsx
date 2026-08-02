"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { HydrationFrame, useMountLog } from "@/components/HydrationFrame";

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
  lastActivityAt: string | null;
  contacts: Contact[];
  activities: Activity[];
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
      </div>

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

  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">Activity feed</h2>

      {/* Always-visible log form */}
      <form onSubmit={submit} className="mb-4 rounded border border-slate-200 bg-slate-50 p-3">
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

      {/* Reverse-chron list */}
      {activities.length === 0 ? (
        <p className="text-sm text-slate-400">No activity logged yet.</p>
      ) : (
        <ol className="space-y-3">
          {activities.map((a) => (
            <li key={a.id} className="flex gap-3">
              <div className="text-lg">{ACTIVITY_ICON[a.type] || "•"}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{a.type}</span>
                  <span>·</span>
                  <span>{new Date(a.occurredAt).toLocaleString()}</span>
                  {ownerName(a.userId) && (
                    <>
                      <span>·</span>
                      <span>{ownerName(a.userId)}</span>
                    </>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{a.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
