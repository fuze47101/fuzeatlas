"use client";
import { useEffect, useState } from "react";

interface Meeting {
  id: string;
  title: string;
  description?: string;
  meetingType: string;
  startTime: string;
  endTime: string;
  timezone: string;
  location?: string;
  teamsLink?: string;
  brand?: string;
  brandId?: string;
  project?: string;
  projectId?: string;
  pipelineStage?: string;
  autoScheduled: boolean;
  organizer?: string;
  attendees?: { name: string; email: string; role?: string }[];
  status: string;
  notes?: string;
  outcome?: string;
}

interface Template {
  pipelineStage: string;
  meetingType: string;
  title: string;
  description: string;
  durationMinutes: number;
  suggestedAttendees: string[];
  agenda: string[];
}

interface Stats {
  upcoming: number;
  thisWeek: number;
  completed: number;
  total: number;
}

const TYPE_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  INTERNAL: { bg: "bg-slate-100", text: "text-slate-700", icon: "🏢" },
  BRAND_PRESENTATION: { bg: "bg-blue-50", text: "text-blue-700", icon: "🎯" },
  TESTING_REVIEW: { bg: "bg-purple-50", text: "text-purple-700", icon: "🧪" },
  FACTORY_KICKOFF: { bg: "bg-amber-50", text: "text-amber-700", icon: "🏭" },
  PRODUCTION_REVIEW: { bg: "bg-emerald-50", text: "text-emerald-700", icon: "⚙️" },
  SOW_REVIEW: { bg: "bg-rose-50", text: "text-rose-700", icon: "📋" },
  CUSTOM: { bg: "bg-indigo-50", text: "text-indigo-700", icon: "📌" },
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
  RESCHEDULED: "bg-amber-100 text-amber-700",
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [stats, setStats] = useState<Stats>({ upcoming: 0, thisWeek: 0, completed: 0, total: 0 });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("upcoming");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // Create form
  const [form, setForm] = useState({
    title: "",
    description: "",
    meetingType: "INTERNAL",
    startDate: "",
    startTime: "10:00",
    duration: 60,
    location: "Microsoft Teams",
    brandId: "",
    projectId: "",
    attendees: [] as { name: string; email: string }[],
    newAttendeeName: "",
    newAttendeeEmail: "",
  });
  const [creating, setCreating] = useState(false);

  const loadMeetings = () => {
    const params = new URLSearchParams();
    if (filter === "upcoming") params.set("upcoming", "true");
    else if (filter !== "all") params.set("status", filter);

    fetch(`/api/meetings?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setMeetings(d.meetings);
          setStats(d.stats);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMeetings();
    fetch("/api/meetings/templates")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setTemplates(d.templates);
      });
    fetch("/api/brands?limit=100")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.brands) setBrands(d.brands);
      })
      .catch(() => {});
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.projects) setProjects(d.projects);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    loadMeetings();
  }, [filter]);

  const applyTemplate = (t: Template) => {
    setSelectedTemplate(t);
    setForm({
      ...form,
      title: t.title,
      description: t.description + "\n\nAgenda:\n" + t.agenda.map((a, i) => `${i + 1}. ${a}`).join("\n"),
      meetingType: t.meetingType,
      duration: t.durationMinutes,
      location: "Microsoft Teams",
    });
    setShowCreate(true);
  };

  const addAttendee = () => {
    if (!form.newAttendeeName || !form.newAttendeeEmail) return;
    setForm({
      ...form,
      attendees: [...form.attendees, { name: form.newAttendeeName, email: form.newAttendeeEmail }],
      newAttendeeName: "",
      newAttendeeEmail: "",
    });
  };

  const removeAttendee = (idx: number) => {
    setForm({ ...form, attendees: form.attendees.filter((_, i) => i !== idx) });
  };

  const createMeeting = async () => {
    if (!form.title || !form.startDate || !form.startTime) return;
    setCreating(true);
    try {
      const startDt = new Date(`${form.startDate}T${form.startTime}:00`);
      const endDt = new Date(startDt.getTime() + form.duration * 60000);

      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          meetingType: form.meetingType,
          startTime: startDt.toISOString(),
          endTime: endDt.toISOString(),
          location: form.location,
          brandId: form.brandId || null,
          projectId: form.projectId || null,
          pipelineStage: selectedTemplate?.pipelineStage || null,
          attendees: form.attendees.length > 0 ? form.attendees : null,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setShowCreate(false);
        setForm({
          title: "", description: "", meetingType: "INTERNAL", startDate: "", startTime: "10:00",
          duration: 60, location: "Microsoft Teams", brandId: "", projectId: "",
          attendees: [], newAttendeeName: "", newAttendeeEmail: "",
        });
        setSelectedTemplate(null);
        loadMeetings();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (id: string, action: string, extra?: Record<string, any>) => {
    await fetch(`/api/meetings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    loadMeetings();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const isToday = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  };

  if (loading && meetings.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meetings & Calendar</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Schedule meetings, track pipeline milestones, sync with Teams & Calendar
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setSelectedTemplate(null); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00b4c3] text-white rounded-lg hover:bg-[#009aaa] font-medium text-sm"
        >
          + New Meeting
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "This Week", value: stats.thisWeek, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Upcoming", value: stats.upcoming, color: "text-[#00b4c3]", bg: "bg-[#00b4c3]/10" },
          { label: "Completed", value: stats.completed, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Total", value: stats.total, color: "text-slate-600", bg: "bg-slate-50" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-slate-100`}>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color} mt-1`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pipeline Templates */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
          Quick Schedule from Pipeline Template
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {templates.map((t) => {
            const style = TYPE_STYLES[t.meetingType] || TYPE_STYLES.CUSTOM;
            return (
              <button
                key={t.pipelineStage}
                onClick={() => applyTemplate(t)}
                className={`${style.bg} border border-slate-200 rounded-xl p-3 text-left hover:shadow-md transition-all group`}
              >
                <span className="text-lg">{style.icon}</span>
                <p className={`text-xs font-semibold ${style.text} mt-1 leading-tight`}>{t.title}</p>
                <p className="text-[10px] text-slate-400 mt-1">{t.durationMinutes}min • {t.pipelineStage.replace(/_/g, " ")}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {[
          { key: "upcoming", label: "Upcoming" },
          { key: "SCHEDULED", label: "Scheduled" },
          { key: "COMPLETED", label: "Completed" },
          { key: "CANCELLED", label: "Cancelled" },
          { key: "all", label: "All" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              filter === f.key
                ? "bg-[#00b4c3] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Meetings List */}
      <div className="space-y-3">
        {meetings.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">📅</p>
            <p>No meetings found. Schedule one above!</p>
          </div>
        )}
        {meetings.map((m) => {
          const style = TYPE_STYLES[m.meetingType] || TYPE_STYLES.CUSTOM;
          const expanded = expandedId === m.id;

          return (
            <div
              key={m.id}
              className={`bg-white border rounded-xl overflow-hidden transition-all ${
                isToday(m.startTime) ? "border-[#00b4c3] ring-1 ring-[#00b4c3]/20" : "border-slate-200"
              }`}
            >
              {/* Main row */}
              <div
                className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpandedId(expanded ? null : m.id)}
              >
                {/* Time block */}
                <div className="text-center min-w-[70px]">
                  <p className={`text-xs font-medium ${isToday(m.startTime) ? "text-[#00b4c3]" : "text-slate-400"}`}>
                    {formatDate(m.startTime)}
                  </p>
                  <p className="text-sm font-bold text-slate-900">{formatTime(m.startTime)}</p>
                  <p className="text-[10px] text-slate-400">{formatTime(m.endTime)}</p>
                </div>

                {/* Divider */}
                <div className={`w-1 h-12 rounded-full ${isToday(m.startTime) ? "bg-[#00b4c3]" : "bg-slate-200"}`} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">{m.title}</h3>
                    {m.autoScheduled && (
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded">
                        AUTO
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                    {m.brand && <span>🏷️ {m.brand}</span>}
                    {m.project && <span>📁 {m.project}</span>}
                    {m.location && <span>📍 {m.location}</span>}
                  </div>
                </div>

                {/* Type badge */}
                <span className={`px-2 py-1 rounded-full text-xs font-medium hidden sm:inline-block ${style.bg} ${style.text}`}>
                  {style.icon} {m.meetingType.replace(/_/g, " ")}
                </span>

                {/* Status */}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[m.status] || "bg-slate-100 text-slate-600"}`}>
                  {m.status}
                </span>

                {/* Expand arrow */}
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Expanded detail */}
              {expanded && (
                <div className="px-4 py-4 border-t border-slate-100 bg-slate-50/50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Description */}
                    {m.description && (
                      <div className="sm:col-span-2">
                        <p className="text-xs font-medium text-slate-500 mb-1">Description & Agenda</p>
                        <p className="text-sm text-slate-700 whitespace-pre-line">{m.description}</p>
                      </div>
                    )}

                    {/* Attendees */}
                    {m.attendees && Array.isArray(m.attendees) && m.attendees.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Attendees</p>
                        <div className="space-y-1">
                          {(m.attendees as any[]).map((a, i) => (
                            <div key={i} className="text-sm text-slate-700">
                              {a.name} <span className="text-slate-400">({a.email})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Meeting notes */}
                    {m.notes && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Notes</p>
                        <p className="text-sm text-slate-700">{m.notes}</p>
                      </div>
                    )}

                    {m.outcome && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Outcome</p>
                        <p className="text-sm text-slate-700">{m.outcome}</p>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-200">
                    {m.teamsLink && (
                      <a
                        href={m.teamsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-semibold bg-[#5B5FC7] text-white rounded-lg hover:bg-[#4B4FB7] transition-colors"
                      >
                        Open in Teams
                      </a>
                    )}
                    <a
                      href={`/api/meetings/${m.id}/ics`}
                      className="px-3 py-1.5 text-xs font-semibold bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      📅 Add to Calendar (.ics)
                    </a>
                    {m.status === "SCHEDULED" && (
                      <>
                        <button
                          onClick={() => {
                            const notes = prompt("Meeting notes (optional):");
                            const outcome = prompt("Meeting outcome (optional):");
                            updateStatus(m.id, "complete", { notes, outcome });
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          ✓ Mark Complete
                        </button>
                        <button
                          onClick={() => updateStatus(m.id, "cancel")}
                          className="px-3 py-1.5 text-xs font-semibold bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Meeting Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-slate-900">
                {selectedTemplate ? `Schedule: ${selectedTemplate.title}` : "New Meeting"}
              </h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Meeting title"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duration (min)</label>
                  <select
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={form.meetingType}
                    onChange={(e) => setForm({ ...form, meetingType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="INTERNAL">Internal</option>
                    <option value="BRAND_PRESENTATION">Brand Presentation</option>
                    <option value="TESTING_REVIEW">Testing Review</option>
                    <option value="FACTORY_KICKOFF">Factory Kickoff</option>
                    <option value="PRODUCTION_REVIEW">Production Review</option>
                    <option value="SOW_REVIEW">SOW Review</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Microsoft Teams, Zoom, Office, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
                  <select
                    value={form.brandId}
                    onChange={(e) => setForm({ ...form, brandId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">— None —</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                  <select
                    value={form.projectId}
                    onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">— None —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description / Agenda</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  rows={4}
                  placeholder="Meeting description and agenda items..."
                />
              </div>

              {/* Attendees */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Attendees</label>
                {form.attendees.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {form.attendees.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-3 py-1.5">
                        <span className="flex-1">{a.name} — {a.email}</span>
                        <button onClick={() => removeAttendee(i)} className="text-red-400 hover:text-red-600">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.newAttendeeName}
                    onChange={(e) => setForm({ ...form, newAttendeeName: e.target.value })}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Name"
                  />
                  <input
                    type="email"
                    value={form.newAttendeeEmail}
                    onChange={(e) => setForm({ ...form, newAttendeeEmail: e.target.value })}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Email"
                    onKeyDown={(e) => e.key === "Enter" && addAttendee()}
                  />
                  <button
                    onClick={addAttendee}
                    className="px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end sticky bottom-0 bg-white">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={createMeeting}
                disabled={creating || !form.title || !form.startDate}
                className="px-5 py-2 text-sm font-semibold bg-[#00b4c3] text-white rounded-lg hover:bg-[#009aaa] disabled:opacity-50"
              >
                {creating ? "Scheduling..." : "Schedule Meeting"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
