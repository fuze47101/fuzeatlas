"use client";

/**
 * /operating-calendar — Andrew's planning board, live.
 *
 * Owner-gated at three layers: middleware (INTERNAL_ONLY_PATHS), the API
 * (isOwner check on every method), and this page (renders a refusal if the
 * API says 403). Deliberately NOT under /calendar/, which is in
 * PUBLIC_PATHS for ICS feeds and needs no session.
 */

import { useCallback, useEffect, useState } from "react";

interface Ev {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  lane: string;
  account: string | null;
  status: string;
  isPrivate: boolean;
  isShow: boolean;
  holds: boolean;
  detail: string | null;
}
interface Win {
  start: string;
  end: string;
  calendarDays: number;
  businessDays: number;
  asiaClearDays: number;
  verdict: string;
}

const LANES = ["fuze", "travel", "show", "personal", "critical"];

const VIEW_TABS: { key: "all" | "fuze" | "ledge"; label: string; note: string }[] = [
  { key: "all", label: "Combined", note: "Everything named. Yours only — do not hand this out." },
  { key: "fuze", label: "FUZE", note: "FUZE work named. Ledge/Pulse and personal both masked." },
  {
    key: "ledge",
    label: "Ledge / Pulse",
    note: "Ledge/Pulse work named. FUZE and personal both masked.",
  },
];
const BLANK = {
  title: "",
  startDate: "",
  endDate: "",
  lane: "fuze",
  account: "fuze",
  status: "tentative",
  isPrivate: false,
  isShow: false,
  holds: true,
  detail: "",
};

const fmt = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

const laneColor: Record<string, string> = {
  show: "bg-amber-700",
  fuze: "bg-sky-800",
  travel: "bg-sky-600",
  personal: "bg-emerald-700",
  critical: "bg-red-800",
  mask: "bg-slate-300",
};

export default function OperatingCalendarPage() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [runway, setRunway] = useState<Win[]>([]);
  const [conflicts, setConflicts] = useState<{ a: string; b: string }[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [form, setForm] = useState<any>(BLANK);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [view, setView] = useState<"all" | "fuze" | "ledge">("all");
  const [canWrite, setCanWrite] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/operating-calendar?view=${view}`);
    if (res.status === 403) return setState("denied");
    if (!res.ok) return setState("error");
    const d = await res.json();
    setEvents(d.events);
    setRunway(d.runway);
    setConflicts(d.conflicts);
    setCanWrite(!!d.canWrite);
    setState("ok");
  }, [view]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/operating-calendar", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { ...form, id: editing } : form),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.ok) return setMsg(d.error || "Save failed");
    setForm(BLANK);
    setEditing(null);
    setMsg(editing ? "Updated — runway recomputed." : "Added — runway recomputed.");
    load();
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/operating-calendar?id=${id}`, { method: "DELETE" });
    setBusy(false);
    setMsg("Removed — runway recomputed.");
    load();
  }

  if (state === "loading") return <div className="p-8 text-sm text-slate-500">Loading…</div>;
  if (state === "denied")
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-lg font-semibold text-slate-900">Not available</h1>
        <p className="mt-2 text-sm text-slate-600">
          This board is restricted to its owner. Your account does not have access.
        </p>
      </div>
    );
  if (state === "error")
    return <div className="p-8 text-sm text-red-700">Could not load the board.</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="border-b-2 border-slate-900 pb-3 mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Operating Calendar</h1>
        <p className="text-sm text-slate-500 mt-1">
          Aug 2026 – Jan 2027 · fixed commitments, remaining capacity, and where Asia travel can
          land. Private to you.
        </p>
      </header>

      {!canWrite && (
        <div className="mb-4 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          Read-only. You are viewing Andrew&apos;s calendar and cannot change it.
        </div>
      )}

      <div className="mb-5">
        <div className="inline-flex rounded border border-slate-300 overflow-hidden">
          {VIEW_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={
                "px-4 py-1.5 text-sm border-r border-slate-300 last:border-r-0 " +
                (view === t.key
                  ? "bg-slate-900 text-white font-medium"
                  : "bg-white text-slate-600 hover:bg-slate-50")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          {VIEW_TABS.find((t) => t.key === view)?.note}
        </p>
        {view !== "all" && (
          <p className="mt-1 text-xs text-slate-400">
            Masked items are withheld by the server — the hidden names are never sent to this page.
            Dates and durations still show, so the time reads as blocked.
          </p>
        )}
      </div>

      {conflicts.length > 0 && (
        <div className="mb-5 rounded border border-red-300 bg-red-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-red-800">
            {conflicts.length} overlap{conflicts.length > 1 ? "s" : ""}
          </p>
          <ul className="mt-1 text-sm text-red-900">
            {conflicts.map((c, i) => (
              <li key={i}>
                {c.a} ↔ {c.b}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b pb-1 mb-2">
          Remaining capacity
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b">
              <th className="text-left py-1">Open window</th>
              <th className="text-right">Cal</th>
              <th className="text-right">Biz</th>
              <th className="text-right">Asia-clear</th>
              <th className="text-left pl-4">Assessment</th>
            </tr>
          </thead>
          <tbody>
            {runway.map((w, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-1.5 whitespace-nowrap">
                  {fmt(w.start)} – {fmt(w.end)}
                </td>
                <td className="text-right tabular-nums">{w.calendarDays}</td>
                <td className="text-right tabular-nums">{w.businessDays}</td>
                <td className="text-right tabular-nums font-bold">{w.asiaClearDays}</td>
                <td className="pl-4">
                  <span
                    className={
                      "text-[11px] px-2 py-0.5 rounded-full font-semibold " +
                      (w.verdict === "Asia-capable"
                        ? "bg-emerald-100 text-emerald-800"
                        : w.verdict === "Partial Asia"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600")
                    }
                  >
                    {w.verdict}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">
          Asia-clear counts business days simultaneously open in all five target countries, computed
          against hard public-holiday closures.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b pb-1 mb-2">
          Schedule · {events.length} items
        </h2>
        <ul className="divide-y divide-slate-100">
          {events.map((ev) => (
            <li key={ev.id} className="py-2 flex items-start gap-3">
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm ${laneColor[ev.lane] || "bg-slate-400"}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {ev.title}
                  {ev.isShow && (
                    <span className="ml-2 text-[10px] bg-amber-700 text-white px-1.5 py-0.5 rounded">
                      SHOW
                    </span>
                  )}
                  {ev.isPrivate && (
                    <span className="ml-2 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                      PRIVATE
                    </span>
                  )}
                  {!ev.holds && (
                    <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                      INFO ONLY
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 tabular-nums">
                  {fmt(ev.startDate)} – {fmt(ev.endDate)} · {ev.status}
                  {ev.account ? ` · ${ev.account}` : ""}
                </p>
                {ev.detail && <p className="text-xs text-slate-500 mt-0.5">{ev.detail}</p>}
              </div>
              {view === "all" && canWrite && (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setEditing(ev.id);
                      setForm({ ...ev, detail: ev.detail || "" });
                      window.scrollTo(0, document.body.scrollHeight);
                    }}
                    className="text-xs text-sky-700 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(ev.id)}
                    disabled={busy}
                    className="text-xs text-red-700 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {view === "all" && canWrite && (
        <section className="rounded border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            {editing ? "Edit item" : "Add to the board"}
          </h2>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2 text-xs text-slate-600">
              Title
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Start
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              End
              <input
                required
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Lane
              <select
                value={form.lane}
                onChange={(e) => setForm({ ...form, lane: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              >
                {LANES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Status
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="tentative">tentative</option>
                <option value="locked">locked</option>
              </select>
            </label>
            <label className="sm:col-span-2 text-xs text-slate-600">
              Detail
              <textarea
                rows={2}
                value={form.detail}
                onChange={(e) => setForm({ ...form, detail: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.holds}
                  onChange={(e) => setForm({ ...form, holds: e.target.checked })}
                />
                Holds time (counts against runway)
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.isPrivate}
                  onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })}
                />
                Private
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.isShow}
                  onChange={(e) => setForm({ ...form, isShow: e.target.checked })}
                />
                Show floor
              </label>
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : editing ? "Save changes" : "Add"}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setForm(BLANK);
                  }}
                  className="text-sm text-slate-500 hover:underline"
                >
                  Cancel
                </button>
              )}
              {msg && <span className="text-xs text-emerald-700">{msg}</span>}
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
