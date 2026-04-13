"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──
interface TimelineItem {
  type: "note" | "outreach" | "meeting";
  subtype: string;
  id: string;
  date: string;
  content?: string;
  contactName?: string;
  contactId?: string;
  user?: { id: string; name: string };
  // note-specific
  // outreach-specific
  subject?: string;
  toAddress?: string;
  status?: string;
  // meeting-specific
  title?: string;
  location?: string;
  teamsLink?: string;
  attendees?: any;
  endTime?: string;
}

interface Contact {
  id: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  outreachStatus: string | null;
  lastContactedAt: string | null;
  outreachCount: number | null;
  decisionMaker: boolean | null;
  seniority: string | null;
  createdAt: string;
}

interface ActivitySummary {
  totalNotes: number;
  totalOutreach: number;
  totalMeetings: number;
  totalContacts: number;
}

// ── Icons & Colors ──
const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  NOTE: { icon: "📝", color: "text-slate-700", bg: "bg-slate-100", label: "Note" },
  CALL: { icon: "📞", color: "text-blue-700", bg: "bg-blue-100", label: "Call" },
  EMAIL: { icon: "✉️", color: "text-violet-700", bg: "bg-violet-100", label: "Email" },
  MEETING: { icon: "🤝", color: "text-green-700", bg: "bg-green-100", label: "Meeting" },
  TASK: { icon: "✅", color: "text-amber-700", bg: "bg-amber-100", label: "Task" },
  FOLLOW_UP: { icon: "🔄", color: "text-orange-700", bg: "bg-orange-100", label: "Follow-up" },
  outreach_email: { icon: "📤", color: "text-indigo-700", bg: "bg-indigo-100", label: "Outreach Email" },
  outreach_sms: { icon: "💬", color: "text-teal-700", bg: "bg-teal-100", label: "SMS" },
  meeting_event: { icon: "📅", color: "text-emerald-700", bg: "bg-emerald-100", label: "Meeting" },
};

const NOTE_TYPES = ["NOTE", "CALL", "EMAIL", "MEETING", "TASK", "FOLLOW_UP"];

function getConfig(item: TimelineItem) {
  if (item.type === "outreach") return TYPE_CONFIG[`outreach_${item.subtype}`] || TYPE_CONFIG.EMAIL;
  if (item.type === "meeting") return TYPE_CONFIG.meeting_event;
  return TYPE_CONFIG[item.subtype] || TYPE_CONFIG.NOTE;
}

// ── Main Component ──
export default function ActivityFeed({ entityType, entityId }: { entityType: "brand" | "factory"; entityId: string }) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ content: "", noteType: "NOTE", contactName: "" });

  const apiBase = entityType === "brand" ? `/api/brands/${entityId}/activity` : `/api/factories/${entityId}/activity`;

  const loadActivity = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (data.ok) {
        setTimeline(data.timeline || []);
        setContacts(data.contacts || []);
        setSummary(data.summary || null);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { loadActivity(); }, [loadActivity]);

  // Add note (uses existing /api/notes endpoint)
  const handleAddNote = async () => {
    if (!form.content.trim()) return;
    setSaving(true);
    setError("");
    try {
      const body: any = { content: form.content, noteType: form.noteType, contactName: form.contactName || undefined };
      if (entityType === "brand") body.brandId = entityId;
      else body.factoryId = entityId;

      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setForm({ content: "", noteType: "NOTE", contactName: "" });
        setShowAdd(false);
        loadActivity();
      } else {
        setError(data.error || "Failed to save");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Delete this note?")) return;
    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) loadActivity();
    } catch {}
  };

  // Filtered timeline
  const filtered = filter === "all" ? timeline : timeline.filter((item) => {
    if (filter === "notes") return item.type === "note";
    if (filter === "outreach") return item.type === "outreach";
    if (filter === "meetings") return item.type === "meeting";
    if (filter === "calls") return item.type === "note" && item.subtype === "CALL";
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Strip */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-50 border rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-black text-slate-700">{summary.totalContacts}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Contacts</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-black text-blue-700">{summary.totalNotes}</p>
            <p className="text-[10px] font-semibold text-blue-500 uppercase">Notes</p>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-black text-indigo-700">{summary.totalOutreach}</p>
            <p className="text-[10px] font-semibold text-indigo-500 uppercase">Outreach</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-black text-emerald-700">{summary.totalMeetings}</p>
            <p className="text-[10px] font-semibold text-emerald-500 uppercase">Meetings</p>
          </div>
        </div>
      )}

      {/* Contacts Panel */}
      {contacts.length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Key Contacts</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                  {(c.name || "?")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-slate-800 truncate">{c.name}</span>
                    {c.decisionMaker && <span className="px-1 py-0 rounded text-[9px] font-bold bg-amber-100 text-amber-700">DM</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{c.jobTitle || "No title"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {c.email && <a href={`mailto:${c.email}`} className="text-[10px] text-blue-600 hover:underline truncate">{c.email}</a>}
                    {c.linkedinUrl && (
                      <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100">
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>
                {c.outreachStatus && (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                    c.outreachStatus === "contacted" ? "bg-blue-100 text-blue-700" :
                    c.outreachStatus === "responded" ? "bg-green-100 text-green-700" :
                    c.outreachStatus === "meeting_set" ? "bg-emerald-100 text-emerald-700" :
                    "bg-slate-100 text-slate-500"
                  }`}>
                    {c.outreachStatus.replace("_", " ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Note + Filters */}
      <div className="bg-white border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase">Activity Timeline</h4>
            <span className="text-[10px] text-slate-400">({filtered.length} items)</span>
          </div>
          <button
            onClick={() => { setShowAdd(!showAdd); setError(""); }}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
          >
            {showAdd ? "Cancel" : "+ Log Activity"}
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                <select
                  value={form.noteType}
                  onChange={(e) => setForm({ ...form, noteType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {NOTE_TYPES.map((nt) => (
                    <option key={nt} value={nt}>{nt.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Contact / Person</label>
                <input
                  type="text"
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Who was this with?"
                />
              </div>
            </div>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What happened? Meeting notes, call summary, discussion points..."
              autoFocus
            />
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleAddNote}
                disabled={saving || !form.content.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mb-3 border-b border-slate-100 pb-2">
          {[
            { key: "all", label: "All" },
            { key: "notes", label: "Notes" },
            { key: "calls", label: "Calls" },
            { key: "outreach", label: "Outreach" },
            { key: "meetings", label: "Meetings" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filter === f.key
                  ? "bg-blue-100 text-blue-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {filtered.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-400 text-sm">No activity yet</p>
            <p className="text-slate-300 text-xs mt-1">Log a call, meeting, or note to get started</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((item) => {
              const cfg = getConfig(item);
              const dateStr = item.date ? new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
              const timeStr = item.date ? new Date(item.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

              return (
                <div key={`${item.type}-${item.id}`} className="group flex gap-3 p-3 rounded-lg hover:bg-slate-50 transition">
                  {/* Icon */}
                  <div className="shrink-0 mt-0.5">
                    <span className="text-base">{cfg.icon}</span>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {item.contactName && (
                        <span className="text-xs text-slate-600 font-semibold">{item.contactName}</span>
                      )}
                      {item.user?.name && (
                        <span className="text-[10px] text-slate-400">by {item.user.name}</span>
                      )}
                      {item.status && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          item.status === "sent" ? "bg-green-100 text-green-700" :
                          item.status === "draft" ? "bg-slate-100 text-slate-500" :
                          item.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                          "bg-slate-100 text-slate-500"
                        }`}>
                          {item.status}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 ml-auto shrink-0">{dateStr} {timeStr}</span>
                    </div>

                    {/* Meeting title */}
                    {item.type === "meeting" && item.title && (
                      <p className="text-sm font-semibold text-slate-800 mb-0.5">{item.title}</p>
                    )}

                    {/* Outreach subject */}
                    {item.type === "outreach" && item.subject && (
                      <p className="text-sm font-semibold text-slate-800 mb-0.5">{item.subject}</p>
                    )}

                    {/* Content */}
                    {item.content && (
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.content}</p>
                    )}

                    {/* Meeting extras */}
                    {item.type === "meeting" && (
                      <div className="flex gap-3 mt-1">
                        {item.location && <span className="text-[10px] text-slate-500">📍 {item.location}</span>}
                        {item.teamsLink && (
                          <a href={item.teamsLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline">
                            Join Teams
                          </a>
                        )}
                      </div>
                    )}

                    {/* Outreach extras */}
                    {item.type === "outreach" && item.toAddress && (
                      <p className="text-[10px] text-slate-400 mt-0.5">To: {item.toAddress}</p>
                    )}
                  </div>

                  {/* Delete (notes only) */}
                  {item.type === "note" && (
                    <button
                      onClick={() => handleDeleteNote(item.id)}
                      className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      Delete
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
