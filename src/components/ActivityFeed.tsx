"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──
interface TimelineItem {
  type:
    | "note"
    | "outreach"
    | "meeting"
    // Phase 53/54/54.5/56 entries piped in by buildProjectTimeline.
    | "project_created"
    | "project_weekly_update"
    | "project_completed"
    | "task_assigned"
    | "task_completed"
    | "block_discussion";
  subtype: string;
  id: string;
  date: string;
  content?: string;
  contactName?: string;
  contactId?: string;
  user?: { id: string; name: string | null; email?: string | null } | null;
  subject?: string;
  toAddress?: string;
  status?: string;
  title?: string;
  location?: string;
  teamsLink?: string;
  attendees?: any;
  endTime?: string;
  // Project / task / block fields.
  projectId?: string;
  projectName?: string;
  taskId?: string;
  blockId?: string;
  description?: string;
  priority?: string;
  dueDate?: string | null;
  assignee?: { id: string; name: string | null; email?: string | null } | null;
  meetingTitle?: string;
  link?: string;
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
  // Phase 53/54/54.5/56
  project_created: { icon: "📋", color: "text-cyan-700", bg: "bg-cyan-100", label: "Project Created" },
  project_weekly_update: { icon: "🗒", color: "text-sky-700", bg: "bg-sky-100", label: "Weekly Update" },
  project_completed: { icon: "🏁", color: "text-emerald-800", bg: "bg-emerald-100", label: "Project Completed" },
  task_assigned: { icon: "⚡", color: "text-amber-700", bg: "bg-amber-100", label: "Task Assigned" },
  task_completed: { icon: "✓", color: "text-emerald-700", bg: "bg-emerald-100", label: "Task Done" },
  block_discussion: { icon: "💬", color: "text-violet-700", bg: "bg-violet-100", label: "Discussion" },
};

const TASK_PRIORITY_CHIP: Record<string, string> = {
  URGENT: "bg-rose-600 text-white",
  HIGH: "bg-amber-500 text-white",
  NORMAL: "bg-slate-200 text-slate-700",
  LOW: "bg-slate-100 text-slate-500",
};

const NOTE_TYPES = [
  { value: "NOTE", label: "Note", icon: "📝" },
  { value: "CALL", label: "Call", icon: "📞" },
  { value: "EMAIL", label: "Email", icon: "✉️" },
  { value: "MEETING", label: "Meeting", icon: "🤝" },
  { value: "TASK", label: "Task", icon: "✅" },
  { value: "FOLLOW_UP", label: "Follow-up", icon: "🔄" },
];

function getConfig(item: TimelineItem) {
  if (item.type === "outreach") return TYPE_CONFIG[`outreach_${item.subtype}`] || TYPE_CONFIG.EMAIL;
  if (item.type === "meeting") return TYPE_CONFIG.meeting_event;
  // Phase 53/54/54.5/56 — look up by type itself.
  if (TYPE_CONFIG[item.type]) return TYPE_CONFIG[item.type];
  return TYPE_CONFIG[item.subtype] || TYPE_CONFIG.NOTE;
}

// ── Main Component ──
export default function ActivityFeed({ entityType, entityId }: { entityType: "brand" | "factory"; entityId: string }) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState<number>(50);
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

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Delete this note?")) return;
    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) loadActivity();
    } catch {}
  };

  const filtered = filter === "all" ? timeline : timeline.filter((item) => {
    if (filter === "notes") return item.type === "note";
    if (filter === "outreach") return item.type === "outreach";
    if (filter === "meetings") return item.type === "meeting";
    if (filter === "calls") return item.type === "note" && item.subtype === "CALL";
    if (filter === "projects") {
      return (
        item.type === "project_created" ||
        item.type === "project_weekly_update" ||
        item.type === "project_completed" ||
        item.type === "block_discussion"
      );
    }
    if (filter === "tasks") {
      return item.type === "task_assigned" || item.type === "task_completed";
    }
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
    <div className="space-y-6">
      {/* ══════════════════════════════════════════════════ */}
      {/* LOG ACTIVITY — always visible, big and prominent  */}
      {/* ══════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-black text-blue-900 mb-4">Log Activity</h3>

        {/* Type selector — big buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {NOTE_TYPES.map((nt) => (
            <button
              key={nt.value}
              onClick={() => setForm({ ...form, noteType: nt.value })}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
                form.noteType === nt.value
                  ? "bg-blue-600 text-white shadow-md scale-105"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              <span>{nt.icon}</span>
              {nt.label}
            </button>
          ))}
        </div>

        {/* Contact + Content */}
        <div className="space-y-3">
          <input
            type="text"
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Who was this with? (contact name)"
          />
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={4}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="What happened? Meeting notes, call summary, action items..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && form.content.trim()) {
                handleAddNote();
              }
            }}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Cmd+Enter to save</span>
            <button
              onClick={handleAddNote}
              disabled={saving || !form.content.trim()}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
            >
              {saving ? "Saving..." : "Save Activity"}
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* SUMMARY CARDS — big, colorful                     */}
      {/* ══════════════════════════════════════════════════ */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 text-center">
            <p className="text-3xl font-black text-slate-800">{summary.totalContacts}</p>
            <p className="text-xs font-bold text-slate-500 uppercase mt-1">Contacts</p>
          </div>
          <div className="bg-white border-2 border-blue-200 rounded-2xl px-5 py-4 text-center">
            <p className="text-3xl font-black text-blue-700">{summary.totalNotes}</p>
            <p className="text-xs font-bold text-blue-500 uppercase mt-1">Notes & Calls</p>
          </div>
          <div className="bg-white border-2 border-indigo-200 rounded-2xl px-5 py-4 text-center">
            <p className="text-3xl font-black text-indigo-700">{summary.totalOutreach}</p>
            <p className="text-xs font-bold text-indigo-500 uppercase mt-1">Outreach</p>
          </div>
          <div className="bg-white border-2 border-emerald-200 rounded-2xl px-5 py-4 text-center">
            <p className="text-3xl font-black text-emerald-700">{summary.totalMeetings}</p>
            <p className="text-xs font-bold text-emerald-500 uppercase mt-1">Meetings</p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* KEY CONTACTS — prominent cards                    */}
      {/* ══════════════════════════════════════════════════ */}
      {contacts.length > 0 && (
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-5">
          <h4 className="text-sm font-black text-slate-700 uppercase mb-4">Key Contacts</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 hover:shadow-sm transition">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-black text-sm shrink-0">
                  {(c.name || "?")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-slate-800 truncate">{c.name}</span>
                    {c.decisionMaker && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">DM</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate mb-2">{c.jobTitle || "No title"}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="text-[11px] text-blue-600 hover:underline truncate max-w-[180px]">{c.email}</a>
                    )}
                    {c.linkedinUrl && (
                      <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-white bg-blue-600 rounded hover:bg-blue-700">
                        LinkedIn
                      </a>
                    )}
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="text-[11px] text-slate-600 hover:text-blue-600">{c.phone}</a>
                    )}
                  </div>
                </div>
                {c.outreachStatus && c.outreachStatus !== "not_contacted" && (
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 ${
                    c.outreachStatus === "contacted" ? "bg-blue-100 text-blue-700" :
                    c.outreachStatus === "responded" ? "bg-green-100 text-green-700" :
                    c.outreachStatus === "meeting_booked" ? "bg-emerald-100 text-emerald-700" :
                    "bg-slate-100 text-slate-500"
                  }`}>
                    {c.outreachStatus.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ACTIVITY TIMELINE — filter + entries              */}
      {/* ══════════════════════════════════════════════════ */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-black text-slate-700 uppercase">Activity Timeline</h4>
          <span className="text-xs text-slate-400 font-semibold">{filtered.length} entries</span>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 pb-3 border-b border-slate-100 flex-wrap">
          {[
            { key: "all", label: "All", count: timeline.length },
            { key: "notes", label: "Notes", count: timeline.filter(i => i.type === "note" && i.subtype !== "CALL").length },
            { key: "calls", label: "Calls", count: timeline.filter(i => i.type === "note" && i.subtype === "CALL").length },
            { key: "outreach", label: "Outreach", count: timeline.filter(i => i.type === "outreach").length },
            { key: "meetings", label: "Meetings", count: timeline.filter(i => i.type === "meeting").length },
            { key: "projects", label: "Projects", count: timeline.filter(i => i.type === "project_created" || i.type === "project_weekly_update" || i.type === "project_completed" || i.type === "block_discussion").length },
            { key: "tasks", label: "Tasks", count: timeline.filter(i => i.type === "task_assigned" || i.type === "task_completed").length },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
                filter === f.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* Timeline */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-slate-400 font-semibold">No activity yet</p>
            <p className="text-slate-300 text-sm mt-1">Log a call, meeting, or note above to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.slice(0, visibleCount).map((item) => {
              const cfg = getConfig(item);
              const dateStr = item.date ? new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
              const timeStr = item.date ? new Date(item.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

              return (
                <div key={`${item.type}-${item.id}`} className="group flex gap-4 p-4 rounded-xl border border-transparent hover:bg-slate-50 hover:border-slate-200 transition">
                  {/* Icon */}
                  <div className={`w-10 h-10 ${cfg.bg} rounded-xl flex items-center justify-center shrink-0`}>
                    <span className="text-lg">{cfg.icon}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {item.contactName && (
                        <span className="text-xs text-slate-700 font-bold">{item.contactName}</span>
                      )}
                      {item.user?.name && (
                        <span className="text-[11px] text-slate-400">by {item.user.name}</span>
                      )}
                      {item.status && (
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${
                          item.status === "sent" ? "bg-green-100 text-green-700" :
                          item.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                          "bg-slate-100 text-slate-500"
                        }`}>
                          {item.status}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 ml-auto shrink-0">{dateStr} · {timeStr}</span>
                    </div>

                    {item.type === "meeting" && item.title && (
                      <p className="text-sm font-bold text-slate-800 mb-1">{item.title}</p>
                    )}

                    {item.type === "outreach" && item.subject && (
                      <p className="text-sm font-bold text-slate-800 mb-1">{item.subject}</p>
                    )}

                    {/* Phase 53/54/54.5/56 renderers */}
                    {(item.type === "project_created" ||
                      item.type === "project_weekly_update" ||
                      item.type === "project_completed") && item.projectName && (
                      <p className="text-sm font-bold text-slate-800 mb-1">
                        {item.link ? (
                          <a href={item.link} className="hover:underline">{item.projectName}</a>
                        ) : item.projectName}
                      </p>
                    )}

                    {(item.type === "task_assigned" || item.type === "task_completed") && (
                      <p className="text-sm text-slate-800 mb-1">
                        {item.description}
                        {item.assignee?.name && item.type === "task_assigned" && (
                          <span className="ml-2 text-xs text-slate-500">→ {item.assignee.name}</span>
                        )}
                        {item.priority && item.type === "task_assigned" && (
                          <span className={`ml-2 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${TASK_PRIORITY_CHIP[item.priority] || ""}`}>
                            {item.priority}
                          </span>
                        )}
                        {item.dueDate && item.type === "task_assigned" && (
                          <span className="ml-2 text-[11px] text-slate-500">due {new Date(item.dueDate).toLocaleDateString()}</span>
                        )}
                      </p>
                    )}

                    {item.type === "block_discussion" && item.meetingTitle && (
                      <p className="text-xs font-semibold text-slate-700 mb-1">
                        {item.link ? (
                          <a href={item.link} className="hover:underline">{item.meetingTitle}</a>
                        ) : item.meetingTitle}
                      </p>
                    )}

                    {item.content && (
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                    )}

                    {item.type === "meeting" && (
                      <div className="flex gap-3 mt-2">
                        {item.location && <span className="text-xs text-slate-500">📍 {item.location}</span>}
                        {item.teamsLink && (
                          <a href={item.teamsLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                            Join Teams
                          </a>
                        )}
                      </div>
                    )}

                    {item.type === "outreach" && item.toAddress && (
                      <p className="text-xs text-slate-400 mt-1">To: {item.toAddress}</p>
                    )}
                  </div>

                  {/* Delete (notes only) */}
                  {item.type === "note" && (
                    <button
                      onClick={() => handleDeleteNote(item.id)}
                      className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-start mt-1"
                    >
                      Delete
                    </button>
                  )}
                </div>
              );
            })}
            {filtered.length > visibleCount && (
              <div className="pt-3 text-center">
                <button
                  onClick={() => setVisibleCount((c) => c + 50)}
                  className="px-4 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg"
                >
                  Load older entries ({filtered.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
