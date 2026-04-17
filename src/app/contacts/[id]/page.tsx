// @ts-nocheck
"use client";

/**
 * ══════════════════════════════════════════════════════════════════════
 * /contacts/[id] — CRM Contact Detail Page (Task #53)
 *
 * The full-interaction surface for a single contact. Before this page,
 * "contacts" were rendered as a read-only row inside their parent
 * brand/factory page and you could do nothing with them but edit the
 * name and email. This page turns every contact into a first-class CRM
 * object you can email, schedule with, call, and annotate — with a
 * unified timeline of everything that's ever happened with that person.
 *
 * Sections:
 *   1. Header card  — identity, seniority/vertical/decision-maker badges,
 *                     LinkedIn, company, email status, outreach status
 *   2. Action row   — Email, Schedule Meeting, Log Call, Add Note
 *   3. Timeline     — unified feed from /api/contacts/[id]/activity
 *
 * Design notes:
 *   • Email sends via /api/admin/outreach/send (same path #48 introduced
 *     from the brand page) and also fires POST /api/notes with
 *     noteType=EMAIL so the record shows up on the contact's timeline
 *     via the activity endpoint.
 *   • Meeting scheduling posts to /api/meetings with the contact attached
 *     as an attendee so the existing Meetings module picks it up.
 *   • Calls and notes both hit /api/notes (different noteType), which
 *     thanks to the contactId extension in this same PR also auto-links
 *     the log to the contact timeline AND stamps lastActivityAt on the
 *     parent brand (BD inactivity cron).
 * ══════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

// ──────────────────────────────────────────────────────────────────────
// Types

type Contact = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  title?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  personalEmail?: string | null;
  phone?: string | null;
  address?: string | null;
  linkedinUrl?: string | null;
  seniority?: string | null;
  emailStatus?: string | null;
  enrichmentSource?: string | null;
  enrichedAt?: string | null;
  vertical?: string | null;
  decisionMaker?: boolean;
  companyRevenue?: string | null;
  outreachStatus?: string | null;
  lastContactedAt?: string | null;
  outreachCount?: number;
  brandId?: string | null;
  factoryId?: string | null;
  distributorId?: string | null;
  brand?: { id: string; name: string } | null;
  factory?: { id: string; name: string } | null;
  distributor?: { id: string; name: string } | null;
};

type TimelineItem = {
  id: string;
  kind: "NOTE" | "EMAIL" | "OUTREACH" | "MESSAGE";
  at: string;
  data: any;
};

// ──────────────────────────────────────────────────────────────────────
// Small helpers

const SENIORITY_LABELS: Record<string, string> = {
  c_suite: "C-Suite",
  vp: "VP",
  director: "Director",
  lead: "Head / Lead",
  manager: "Manager",
};

const VERTICAL_LABELS: Record<string, string> = {
  apparel: "Apparel",
  hospitality: "Hospitality",
  workwear: "Workwear",
  home_textiles: "Home Textiles",
  medical: "Medical",
  outdoor: "Outdoor",
};

const OUTREACH_LABELS: Record<string, string> = {
  not_contacted: "Not contacted",
  contacted: "Contacted",
  responded: "Responded",
  meeting_booked: "Meeting booked",
  not_interested: "Not interested",
};

const OUTREACH_COLORS: Record<string, string> = {
  not_contacted: "bg-slate-100 text-slate-500",
  contacted: "bg-blue-100 text-blue-700",
  responded: "bg-emerald-100 text-emerald-700",
  meeting_booked: "bg-violet-100 text-violet-700",
  not_interested: "bg-red-100 text-red-700",
};

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yday = new Date(now);
  yday.setDate(yday.getDate() - 1);
  const isYday = d.toDateString() === yday.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  if (isYday) return `Yesterday · ${time}`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + time;
}

// ──────────────────────────────────────────────────────────────────────
// Page

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [contact, setContact] = useState<Contact | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state — only one open at a time
  const [modal, setModal] = useState<null | "email" | "meeting" | "call" | "note">(null);

  const fetchEverything = useCallback(async () => {
    try {
      setLoading(true);
      const [contactRes, activityRes] = await Promise.all([
        fetch(`/api/contacts?`).then(() => null), // placeholder, see next fetch
        fetch(`/api/contacts/${id}/activity`).then((r) => r.json()),
      ]);

      // Activity route returns both the contact and the timeline in one
      // call — use it as the source of truth for consistency.
      if (!activityRes?.ok) {
        setError(activityRes?.error || "Failed to load contact");
        return;
      }

      // But the activity endpoint only returns a thin contact projection,
      // so pull the full record via the single-contact endpoint.
      const fullRes = await fetch(`/api/contacts/${id}/full`).catch(() => null);
      let fullContact: Contact | null = null;
      if (fullRes?.ok) {
        const j = await fullRes.json();
        fullContact = j.contact || null;
      }
      // Fallback to the thin projection if /full isn't available (it's
      // introduced in this same PR; older builds will still render).
      setContact(fullContact || activityRes.contact);
      setTimeline(activityRes.timeline || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchEverything();
  }, [id, fetchEverything]);

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-slate-200 rounded" />
          <div className="h-32 bg-slate-100 rounded-xl" />
          <div className="h-24 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error || "Contact not found"}
        </div>
      </div>
    );
  }

  const parent =
    contact.brand
      ? { kind: "brand", id: contact.brand.id, name: contact.brand.name, href: `/brands/${contact.brand.id}` }
      : contact.factory
      ? { kind: "factory", id: contact.factory.id, name: contact.factory.name, href: `/factories/${contact.factory.id}` }
      : contact.distributor
      ? { kind: "distributor", id: contact.distributor.id, name: contact.distributor.name, href: `/admin/distributors/${contact.distributor.id}` }
      : null;

  const displayName = contact.name || `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "Unnamed Contact";
  const displayTitle = contact.title || contact.jobTitle || "";

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
        <Link href="/contacts" className="hover:text-slate-700">
          Contacts
        </Link>
        {parent && (
          <>
            <span>›</span>
            <Link href={parent.href} className="hover:text-slate-700">
              {parent.name}
            </Link>
          </>
        )}
        <span>›</span>
        <span className="text-slate-700 font-medium">{displayName}</span>
      </div>

      {/* ─── Header card ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{displayName}</h1>
                {displayTitle && <div className="text-slate-600 mt-0.5">{displayTitle}</div>}
                {parent && (
                  <div className="text-sm text-slate-500 mt-0.5">
                    at{" "}
                    <Link href={parent.href} className="text-blue-600 hover:underline font-medium">
                      {parent.name}
                    </Link>
                  </div>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 items-start">
                {contact.decisionMaker && (
                  <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 font-bold">
                    ★ Decision Maker
                  </span>
                )}
                {contact.seniority && (
                  <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                    {SENIORITY_LABELS[contact.seniority] || contact.seniority}
                  </span>
                )}
                {contact.vertical && (
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                    {VERTICAL_LABELS[contact.vertical] || contact.vertical}
                  </span>
                )}
                {contact.outreachStatus && (
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      OUTREACH_COLORS[contact.outreachStatus] || "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {OUTREACH_LABELS[contact.outreachStatus] || contact.outreachStatus}
                  </span>
                )}
              </div>
            </div>

            {/* Contact methods */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {contact.email && (
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="text-slate-400">✉</span>
                  <a
                    href={`mailto:${contact.email}`}
                    className="hover:text-blue-600 truncate"
                    title={contact.email}
                  >
                    {contact.email}
                  </a>
                  {contact.emailStatus && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        contact.emailStatus === "verified"
                          ? "bg-emerald-100 text-emerald-700"
                          : contact.emailStatus === "extrapolated"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {contact.emailStatus}
                    </span>
                  )}
                </div>
              )}
              {contact.personalEmail && contact.personalEmail !== contact.email && (
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="text-slate-400">✉</span>
                  <a href={`mailto:${contact.personalEmail}`} className="hover:text-blue-600 truncate">
                    {contact.personalEmail}
                  </a>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-500">
                    personal
                  </span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="text-slate-400">📞</span>
                  <a href={`tel:${contact.phone}`} className="hover:text-blue-600">
                    {contact.phone}
                  </a>
                </div>
              )}
              {contact.linkedinUrl && (
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="text-slate-400">in</span>
                  <a
                    href={contact.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 truncate"
                  >
                    LinkedIn profile
                  </a>
                </div>
              )}
              {contact.companyRevenue && (
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="text-slate-400">💰</span>
                  <span>{contact.companyRevenue}</span>
                </div>
              )}
              {contact.enrichmentSource && (
                <div className="flex items-center gap-2 text-slate-500 text-xs">
                  <span>Enriched via {contact.enrichmentSource}</span>
                  {contact.enrichedAt && (
                    <span>
                      · {new Date(contact.enrichedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Action row ─── */}
        <div className="mt-5 pt-5 border-t border-slate-100 flex flex-wrap gap-2">
          <button
            onClick={() => setModal("email")}
            disabled={!contact.email && !contact.personalEmail}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            📧 Email
          </button>
          <button
            onClick={() => setModal("meeting")}
            className="px-3 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 flex items-center gap-2"
          >
            📅 Schedule Meeting
          </button>
          <button
            onClick={() => setModal("call")}
            disabled={!contact.phone}
            className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            📞 Log Call
          </button>
          <button
            onClick={() => setModal("note")}
            className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 flex items-center gap-2"
          >
            📝 Add Note
          </button>
        </div>
      </div>

      {/* ─── Timeline ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Activity</h2>
          <div className="text-xs text-slate-500">
            {timeline.length} {timeline.length === 1 ? "item" : "items"}
          </div>
        </div>

        {timeline.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            No activity yet. Fire off an email or log a call to start the timeline.
          </div>
        ) : (
          <ol className="space-y-3 relative border-l-2 border-slate-100 ml-2">
            {timeline.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="ml-4 pl-4 relative">
                <span
                  className={`absolute -left-[9px] top-2 w-4 h-4 rounded-full border-2 border-white ${
                    item.kind === "EMAIL"
                      ? "bg-blue-500"
                      : item.kind === "OUTREACH" || item.kind === "MESSAGE"
                      ? "bg-amber-500"
                      : item.data?.noteType === "CALL"
                      ? "bg-emerald-500"
                      : item.data?.noteType === "MEETING"
                      ? "bg-violet-500"
                      : item.data?.noteType === "AI_INSIGHT"
                      ? "bg-indigo-500"
                      : "bg-slate-400"
                  }`}
                />
                <TimelineCard item={item} />
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ─── Modals ─── */}
      {modal === "email" && (
        <EmailModal
          contact={contact}
          onClose={() => setModal(null)}
          onSent={() => {
            setModal(null);
            fetchEverything();
          }}
        />
      )}
      {modal === "meeting" && (
        <MeetingModal
          contact={contact}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            fetchEverything();
          }}
        />
      )}
      {modal === "call" && (
        <NoteModal
          contact={contact}
          kind="CALL"
          title="Log a call"
          placeholder="What did you talk about? Outcome, objections, next steps..."
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            fetchEverything();
          }}
        />
      )}
      {modal === "note" && (
        <NoteModal
          contact={contact}
          kind="NOTE"
          title="Add a note"
          placeholder="Context, research, reminders..."
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            fetchEverything();
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Timeline card

function TimelineCard({ item }: { item: TimelineItem }) {
  const at = fmtDate(item.at);

  if (item.kind === "EMAIL") {
    const n = item.data;
    return (
      <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
          <span className="font-semibold text-blue-700">
            {n.emailDirection === "INBOUND" ? "📨 Inbound email" : "📤 Sent email"}
          </span>
          <span>{at}</span>
        </div>
        {n.emailSubject && (
          <div className="text-sm font-semibold text-slate-800 truncate">{n.emailSubject}</div>
        )}
        <div className="text-sm text-slate-700 whitespace-pre-wrap mt-1">{n.content}</div>
        {n.user?.name && (
          <div className="text-xs text-slate-400 mt-2">— {n.user.name}</div>
        )}
      </div>
    );
  }

  if (item.kind === "MESSAGE") {
    const m = item.data;
    return (
      <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
          <span className="font-semibold text-amber-700">
            ✉ Outreach ({m.channel || "email"})
          </span>
          <span>{at}</span>
        </div>
        {m.subject && (
          <div className="text-sm font-semibold text-slate-800 truncate">{m.subject}</div>
        )}
        {m.body && <div className="text-sm text-slate-700 whitespace-pre-wrap mt-1 line-clamp-5">{m.body}</div>}
      </div>
    );
  }

  if (item.kind === "OUTREACH") {
    const o = item.data;
    return (
      <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
          <span className="font-semibold text-amber-700">📇 Outreach check · {o.type}</span>
          <span>{at}</span>
        </div>
        {o.notes && <div className="text-sm text-slate-700 whitespace-pre-wrap mt-1">{o.notes}</div>}
        {o.user?.name && <div className="text-xs text-slate-400 mt-2">— {o.user.name}</div>}
      </div>
    );
  }

  // Notes (including CALL, MEETING, AI_INSIGHT)
  const n = item.data;
  const kindLabel =
    n.noteType === "CALL"
      ? "📞 Call logged"
      : n.noteType === "MEETING"
      ? "📅 Meeting"
      : n.noteType === "AI_INSIGHT"
      ? "🤖 AI insight"
      : "📝 Note";
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
        <span className="font-semibold text-slate-700">{kindLabel}</span>
        <span>{at}</span>
      </div>
      <div className="text-sm text-slate-700 whitespace-pre-wrap">{n.content}</div>
      {n.user?.name && <div className="text-xs text-slate-400 mt-2">— {n.user.name}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Email modal — reuses the #48 pattern. Sends via /api/admin/outreach/send
// and logs a note via /api/notes for the contact timeline.

function EmailModal({
  contact,
  onClose,
  onSent,
}: {
  contact: Contact;
  onClose: () => void;
  onSent: () => void;
}) {
  const parentName = contact.brand?.name || contact.factory?.name || contact.distributor?.name || "your company";
  const firstName = contact.firstName || (contact.name || "").split(" ")[0] || "there";

  const defaultSubject = `${parentName} × FUZE — quick intro`;
  const defaultBody = `Hi ${firstName},\n\nI wanted to reach out from FUZE Biotech. FUZE is a proprietary metamaterial antimicrobial treatment that bonds to textile fibers during standard mill finishing — compatible with exhaust, pad-dry-cure, and spray, with no special machinery required. Our F1 tier is rated for 100 wash cycles and validated against bacteria, fungi, and odor-causing microorganisms per AATCC 100 and ISO 20743.\n\nFUZE is OEKO-TEX Standard 100 Class I, bluesign® approved, EPA registered, and completely PFAS-free.\n\nWould you have 20 minutes next week to see whether it fits anywhere in your current fabric program?\n\nThanks,\n`;

  const toAddress = contact.email || contact.personalEmail || "";

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const handleSend = async () => {
    if (!toAddress) return;
    setSending(true);
    setErr("");
    try {
      const sendRes = await fetch("/api/admin/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          channel: "email",
          subject,
          body,
          toAddress,
        }),
      });
      const sendJson = await sendRes.json();
      if (!sendJson.ok) throw new Error(sendJson.error || "Email send failed");

      // Log to contact timeline
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: body,
          noteType: "EMAIL",
          contactId: contact.id,
          contactName: contact.name || null,
        }),
      }).catch(() => {});

      onSent();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal onClose={onClose} title={`Email ${contact.name || contact.firstName || "contact"}`}>
      <div className="space-y-3">
        <div className="text-sm text-slate-500">
          To: <span className="font-mono text-slate-700">{toAddress || "(no email on file)"}</span>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "12pt" }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 mt-1"
          />
        </div>
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !toAddress || !subject.trim() || !body.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:bg-slate-300"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Meeting modal

function MeetingModal({
  contact,
  onClose,
  onSaved,
}: {
  contact: Contact;
  onClose: () => void;
  onSaved: () => void;
}) {
  const parentName = contact.brand?.name || contact.factory?.name || contact.distributor?.name || "";
  const now = new Date();
  const nextSlot = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  nextSlot.setMinutes(0, 0, 0);
  const defaultStart = nextSlot.toISOString().slice(0, 16);
  const endTime = new Date(nextSlot.getTime() + 30 * 60 * 1000).toISOString().slice(0, 16);

  const [title, setTitle] = useState(
    parentName ? `${parentName} × FUZE — intro` : `${contact.name || "Contact"} — intro`,
  );
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTimeStr, setEndTimeStr] = useState(endTime);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          meetingType: "SALES",
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTimeStr).toISOString(),
          brandId: contact.brandId || undefined,
          attendees: contact.email
            ? [{ email: contact.email, name: contact.name || "" }]
            : [],
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Failed to create meeting");

      // Log to contact timeline
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `Meeting scheduled: ${title}\n${new Date(startTime).toLocaleString()}`,
          noteType: "MEETING",
          contactId: contact.id,
          contactName: contact.name || null,
        }),
      }).catch(() => {});

      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Schedule meeting">
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Start</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">End</label>
            <input
              type="datetime-local"
              value={endTimeStr}
              onChange={(e) => setEndTimeStr(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Agenda (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
          />
        </div>
        <div className="text-xs text-slate-500">
          Attendee: <span className="font-mono">{contact.email || "(no email on file)"}</span>
        </div>
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:bg-slate-300"
          >
            {saving ? "Saving…" : "Schedule"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Note / Call modal — same shape, different noteType

function NoteModal({
  contact,
  kind,
  title,
  placeholder,
  onClose,
  onSaved,
}: {
  contact: Contact;
  kind: "NOTE" | "CALL";
  title: string;
  placeholder: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          noteType: kind,
          contactId: contact.id,
          contactName: contact.name || null,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Failed to save");
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title={title}>
      <div className="space-y-3">
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          rows={8}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className={`px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:bg-slate-300 ${
              kind === "CALL" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-700 hover:bg-slate-800"
            }`}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Modal shell

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 text-xl flex items-center justify-center"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
