// @ts-nocheck
"use client";

/**
 * /admin/weekly-review/[id] — the actual Monday exec review dashboard.
 *
 * Everything on this page is driven by the JSON snapshot stored on
 * WeeklyExecReport.snapshot, so the historical view of any past week
 * stays pinned to what was true at the time of review. Live actions
 * (adding notes, scheduling meetings, sharing) write to the real
 * underlying tables and show up inline without re-rendering the
 * snapshot — only the "Refresh" button rebuilds the snapshot.
 *
 * Access is checked server-side by the API. The client trusts the
 * 403/404 behaviour of its fetches.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Tone = "good" | "warn" | "bad" | "neutral";

interface Kpi {
  label: string;
  value: number | string;
  unit?: string;
  deltaPct?: number;
  caption?: string;
  tone?: Tone;
}

interface ReportShape {
  id: string;
  weekOf: string;
  lookbackDays: number;
  status: string;
  generatedAt: string;
  execNote?: string | null;
  snapshot: any;
  ownedBy: { id: string; name: string };
}

interface NoteRow {
  id: string;
  content: string;
  createdAt: string;
  noteType: string | null;
  brand?: { id: string; name: string } | null;
  user?: { id: string; name: string } | null;
}

interface ShareRow {
  id: string;
  scope: string;
  grantedAt: string;
  user: { id: string; name: string; email: string; role: string };
}

const TONE_CLASS: Record<Tone, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  bad: "border-rose-200 bg-rose-50 text-rose-900",
  neutral: "border-slate-200 bg-white text-slate-900",
};

const DELTA_CLASS = (pct?: number) => {
  if (pct === undefined) return "text-slate-400";
  if (pct > 0) return "text-emerald-600";
  if (pct < 0) return "text-rose-600";
  return "text-slate-500";
};

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString();
}

function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", opts || { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

export default function WeeklyReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<ReportShape | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [present, setPresent] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [execNoteDraft, setExecNoteDraft] = useState("");
  const [savingExec, setSavingExec] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/weekly-review/${id}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `${r.status}`);
      }
      const j = await r.json();
      setReport(j.report);
      setNotes(j.notes || []);
      setShares(j.shares || []);
      setExecNoteDraft(j.report.execNote || "");
    } catch (e: any) {
      setError(e.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async () => {
    if (!report) return;
    setRefreshing(true);
    try {
      const r = await fetch(`/api/admin/weekly-review/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh: true }),
      });
      if (!r.ok) throw new Error("refresh failed");
      await load();
    } catch (e: any) {
      alert(e.message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [id, report, load]);

  const saveExecNote = useCallback(async () => {
    setSavingExec(true);
    try {
      await fetch(`/api/admin/weekly-review/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ execNote: execNoteDraft }),
      });
    } finally {
      setSavingExec(false);
    }
  }, [id, execNoteDraft]);

  if (loading) {
    return <div className="p-10 text-slate-500 text-sm">Loading weekly review…</div>;
  }
  if (error || !report) {
    return (
      <div className="p-10 max-w-xl mx-auto">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800 text-sm">
          {error || "Report not found"}
        </div>
        <Link href="/home" className="mt-4 inline-block text-sm text-slate-600 hover:text-slate-900">← Back home</Link>
      </div>
    );
  }

  const snap = report.snapshot;
  const kpis: Kpi[] = snap?.kpis || [];
  const period = snap?.period;

  return (
    <div className={`${present ? "bg-slate-900 text-slate-100 min-h-screen" : "bg-slate-50 min-h-screen"}`}>
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* ─── Header ──────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div className={`text-xs uppercase tracking-wide ${present ? "text-slate-400" : "text-slate-500"}`}>
              Weekly Exec Review
            </div>
            <h1 className={`text-2xl font-bold ${present ? "text-white" : "text-slate-900"}`}>
              Week of {fmtDate(report.weekOf, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </h1>
            {period && (
              <div className={`text-sm mt-0.5 ${present ? "text-slate-400" : "text-slate-500"}`}>
                Covering {fmtDate(period.start)} → {fmtDate(period.end)}
                {period.days !== 7 && ` · ${period.days}-day window`}
                {" · "}Owner: {report.ownedBy.name}
                {" · "}Generated {fmtDateTime(report.generatedAt)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPresent((x) => !x)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {present ? "Exit Present" : "Present"}
            </button>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh snapshot"}
            </button>
            <ShareMenu reportId={id as string} shares={shares} onChange={load} />
          </div>
        </div>

        {/* ─── KPI Tiles ───────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {kpis.map((k) => (
            <div
              key={k.label}
              className={`rounded-xl border ${present ? "bg-slate-800 border-slate-700 text-slate-100" : TONE_CLASS[k.tone || "neutral"]} p-4`}
            >
              <div className={`text-[11px] uppercase tracking-wide ${present ? "text-slate-400" : "text-slate-500"}`}>
                {k.label}
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <div className="text-2xl font-semibold">
                  {k.unit === "$" ? fmtMoney(Number(k.value)) : fmtNumber(Number(k.value) || 0)}
                </div>
                {k.unit && k.unit !== "$" && <div className="text-sm opacity-60">{k.unit}</div>}
              </div>
              {k.deltaPct !== undefined && (
                <div className={`mt-1 text-xs font-medium ${DELTA_CLASS(k.deltaPct)}`}>
                  {k.deltaPct > 0 ? "+" : ""}{k.deltaPct}% vs prior
                </div>
              )}
              {k.caption && <div className={`mt-1 text-xs ${present ? "text-slate-400" : "text-slate-600"}`}>{k.caption}</div>}
            </div>
          ))}
        </div>

        {/* ─── Exec Summary (owner-editable) ───────── */}
        <Section title="Exec summary" present={present}>
          <textarea
            className={`w-full min-h-24 rounded-md border p-3 text-sm ${present ? "bg-slate-800 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"}`}
            placeholder="Top-line takeaway for the board. Saved on blur."
            value={execNoteDraft}
            onChange={(e) => setExecNoteDraft(e.target.value)}
            onBlur={saveExecNote}
          />
          {savingExec && <div className="text-xs text-slate-400 mt-1">Saving…</div>}
        </Section>

        {/* ─── Sales & Distribution ────────────────── */}
        <Section title="Sales & distribution" present={present}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Booked $" value={fmtMoney(snap.sales.bookedDollars)} sub={`${snap.sales.newOrders} orders`} present={present} />
            <MiniStat label="Shipped $" value={fmtMoney(snap.sales.shippedDollars)} sub={`${snap.sales.shippedOrders} shipments`} present={present} />
            <MiniStat label="Booked L" value={fmtNumber(snap.sales.bookedLiters)} sub={`${fmtNumber(snap.sales.bookedKg)} kg`} present={present} />
            <MiniStat label="Shipped L" value={fmtNumber(snap.sales.shippedLiters)} sub={`${fmtNumber(snap.sales.shippedKg)} kg shipped`} present={present} />
          </div>
          {Object.keys(snap.sales.byOrderType || {}).length > 0 && (
            <div className="mt-4">
              <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${present ? "text-slate-400" : "text-slate-500"}`}>By order type</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(snap.sales.byOrderType).map(([k, v]: any) => (
                  <span key={k} className={`rounded-full border px-3 py-1 text-xs ${present ? "border-slate-700 bg-slate-800 text-slate-200" : "border-slate-200 bg-white text-slate-700"}`}>
                    {k} · {v.count} · {fmtMoney(v.dollars)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ─── SOW Progress ────────────────────────── */}
        <Section title="SOW progress" present={present}
          right={
            <span className={`text-xs ${present ? "text-slate-400" : "text-slate-500"}`}>
              {snap.sows.counts.draft} draft · {snap.sows.counts.sent} sent · {snap.sows.counts.signed} signed · {snap.sows.counts.active} active · {snap.sows.counts.complete} complete
            </span>
          }
        >
          <div className="grid lg:grid-cols-2 gap-4">
            <SowList title="Signed this window" rows={snap.sows.signed} present={present} emptyLabel="No new signatures this window." />
            <SowList title="Newly opened" rows={snap.sows.new} present={present} emptyLabel="No SOWs opened this window." />
            <SowList title="Active" rows={snap.sows.active} present={present} emptyLabel="No active SOWs." />
            <SowList title="Stale (>30d no movement)" rows={snap.sows.stale} present={present} tone="warn" emptyLabel="Nothing stuck." />
          </div>
        </Section>

        {/* ─── BD Pipeline ─────────────────────────── */}
        <Section title="BD & pipeline" present={present}>
          <div className="grid lg:grid-cols-2 gap-4">
            <div>
              <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${present ? "text-slate-400" : "text-slate-500"}`}>Stage distribution</div>
              <div className="space-y-1">
                {snap.bd.stageWaterfall.map((s: any) => (
                  <StageBar key={s.stage} stage={s.stage} count={s.count} max={Math.max(...snap.bd.stageWaterfall.map((x: any) => x.count))} present={present} />
                ))}
              </div>
            </div>
            <div>
              <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${present ? "text-slate-400" : "text-slate-500"}`}>BD leaderboard</div>
              <div className={`rounded-md border ${present ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"} overflow-hidden`}>
                {snap.bd.leaderboard.length === 0 && (
                  <div className="p-3 text-sm text-slate-500">No BD activity recorded this window.</div>
                )}
                {snap.bd.leaderboard.map((r: any, i: number) => (
                  <div key={r.userId} className={`flex items-center justify-between px-3 py-2 text-sm ${i > 0 ? (present ? "border-t border-slate-700" : "border-t border-slate-100") : ""}`}>
                    <div>
                      <div className={`font-medium ${present ? "text-slate-100" : "text-slate-900"}`}>{r.userName}</div>
                      <div className={`text-xs ${present ? "text-slate-400" : "text-slate-500"}`}>{r.role}</div>
                    </div>
                    <div className={`text-xs ${present ? "text-slate-300" : "text-slate-600"}`}>
                      {r.noteCount} notes · {r.brandsTouched} brands · {r.meetingsHeld} mtgs
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid lg:grid-cols-2 gap-4">
            <BrandList title="New brands this window" rows={snap.bd.newBrands} present={present} />
            <HandoffList rows={snap.bd.handoffQueue} present={present} />
          </div>
        </Section>

        {/* ─── Testing ─────────────────────────────── */}
        <Section title="Testing & quality" present={present}
          right={<span className={`text-xs ${present ? "text-slate-400" : "text-slate-500"}`}>
            {snap.testing.completed} completed · {snap.testing.passed} pass · {snap.testing.failed} fail
          </span>}
        >
          {Object.keys(snap.testing.byType || {}).length === 0 ? (
            <div className="text-sm text-slate-500">No tests completed this window.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(snap.testing.byType).map(([type, v]: any) => (
                <div key={type} className={`rounded-md border p-3 ${present ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
                  <div className={`text-xs uppercase tracking-wide ${present ? "text-slate-400" : "text-slate-500"}`}>{type}</div>
                  <div className={`text-lg font-semibold ${present ? "text-slate-100" : "text-slate-900"}`}>{v.total}</div>
                  <div className="text-xs text-emerald-600">{v.passed} passed</div>
                  {v.failed > 0 && <div className="text-xs text-rose-600">{v.failed} failed</div>}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ─── Product & Build ─────────────────────── */}
        <Section title="Product & build" present={present}
          right={<span className={`text-xs ${present ? "text-slate-400" : "text-slate-500"}`}>
            {snap.build.feedbackOpen} open · {snap.build.feedbackResolved} resolved this window
          </span>}
        >
          {snap.build.buildNotes?.length > 0 && (
            <ul className={`mb-3 space-y-1 text-sm ${present ? "text-slate-200" : "text-slate-700"}`}>
              {snap.build.buildNotes.map((b: string, i: number) => (
                <li key={i}>• {b}</li>
              ))}
            </ul>
          )}
          {snap.build.featuresShipped?.length > 0 ? (
            <div className="space-y-2">
              {snap.build.featuresShipped.map((f: any) => (
                <div key={f.id} className={`rounded-md border p-3 ${present ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
                  <div className={`text-sm font-medium ${present ? "text-slate-100" : "text-slate-900"}`}>{f.title}</div>
                  {f.resolution && <div className={`text-xs mt-1 ${present ? "text-slate-300" : "text-slate-600"}`}>{f.resolution}</div>}
                  <div className={`text-[11px] mt-1 ${present ? "text-slate-400" : "text-slate-400"}`}>Shipped {fmtDateTime(f.resolvedAt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">No features shipped to closure this window.</div>
          )}
        </Section>

        {/* ─── Customers at Risk ───────────────────── */}
        <Section title="Customers at risk" present={present}
          right={<span className={`text-xs ${present ? "text-slate-400" : "text-slate-500"}`}>≥45 days no activity in a live pipeline stage</span>}
        >
          {snap.customersAtRisk?.length === 0 ? (
            <div className="text-sm text-emerald-700">Clear. Everyone live in pipeline is within 45 days of activity.</div>
          ) : (
            <div className={`rounded-md border overflow-hidden ${present ? "border-slate-700" : "border-slate-200"}`}>
              <table className="w-full text-sm">
                <thead className={present ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"}>
                  <tr className="text-left text-xs uppercase tracking-wide">
                    <th className="px-3 py-2">Brand</th>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">Days silent</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {snap.customersAtRisk.map((b: any) => (
                    <tr key={b.id} className={present ? "border-t border-slate-700 text-slate-200" : "border-t border-slate-200 text-slate-800"}>
                      <td className="px-3 py-2 font-medium">{b.name}</td>
                      <td className="px-3 py-2 text-xs">{b.pipelineStage}</td>
                      <td className="px-3 py-2 text-xs">
                        {b.daysSinceActivity === null ? <span className="text-rose-600">never</span> : `${b.daysSinceActivity}d`}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/brands/${b.id}`} className="text-xs text-blue-600 hover:underline">Open →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ─── This Week's Agenda ──────────────────── */}
        <Section title="This week's agenda" present={present}>
          <InlineMeetingComposer reportId={id as string} onSaved={load} present={present} />
          {snap.thisWeek?.length === 0 ? (
            <div className="text-sm text-slate-500 mt-3">No meetings or tasks scheduled for this week yet.</div>
          ) : (
            <div className="mt-3 space-y-1">
              {snap.thisWeek.map((item: any) => (
                <div key={`${item.kind}-${item.id}`} className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${present ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
                  <div>
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide mr-2 ${item.kind === "meeting" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>
                      {item.kind}
                    </span>
                    <span className={present ? "text-slate-100" : "text-slate-900"}>{item.title}</span>
                    {item.brandName && <span className={`ml-2 text-xs ${present ? "text-slate-400" : "text-slate-500"}`}>· {item.brandName}</span>}
                  </div>
                  <div className={`text-xs ${present ? "text-slate-400" : "text-slate-500"}`}>{item.when && fmtDateTime(item.when)}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ─── Review Notes ────────────────────────── */}
        <Section title="Review notes" present={present}
          right={<span className={`text-xs ${present ? "text-slate-400" : "text-slate-500"}`}>Notes written here flow back to the CRM</span>}
        >
          <InlineNoteComposer reportId={id as string} onSaved={load} present={present} />
          {notes.length === 0 ? (
            <div className="text-sm text-slate-500 mt-3">No review notes yet. Capture one above and it'll land on the brand timeline too.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {notes.map((n) => (
                <div key={n.id} className={`rounded-md border p-3 text-sm ${present ? "border-slate-700 bg-slate-800 text-slate-100" : "border-slate-200 bg-white text-slate-800"}`}>
                  <div className="flex items-center justify-between">
                    <div className={`text-xs ${present ? "text-slate-400" : "text-slate-500"}`}>
                      {n.brand ? <Link href={`/brands/${n.brand.id}`} className="hover:underline">{n.brand.name}</Link> : "—"}
                      {" · "}{n.user?.name || "system"} · {fmtDateTime(n.createdAt)}
                    </div>
                    <span className={`text-[10px] uppercase tracking-wide ${present ? "text-slate-500" : "text-slate-400"}`}>{n.noteType || "NOTE"}</span>
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{n.content}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className={`mt-8 text-xs ${present ? "text-slate-500" : "text-slate-400"}`}>
          Snapshot v{snap.version}. Regenerate with the Refresh button to re-query source data.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Helpers / sub-components
// ─────────────────────────────────────────────

function Section({ title, children, right, present }: any) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className={`text-base font-semibold ${present ? "text-slate-100" : "text-slate-900"}`}>{title}</h2>
        {right}
      </div>
      <div className={`rounded-lg border p-4 ${present ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
        {children}
      </div>
    </section>
  );
}

function MiniStat({ label, value, sub, present }: any) {
  return (
    <div className={`rounded-md border p-3 ${present ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"}`}>
      <div className={`text-[11px] uppercase tracking-wide ${present ? "text-slate-400" : "text-slate-500"}`}>{label}</div>
      <div className={`text-xl font-semibold ${present ? "text-slate-100" : "text-slate-900"}`}>{value}</div>
      {sub && <div className={`text-xs ${present ? "text-slate-400" : "text-slate-500"}`}>{sub}</div>}
    </div>
  );
}

function SowList({ title, rows, present, emptyLabel, tone }: any) {
  const titleTone = tone === "warn" ? (present ? "text-amber-400" : "text-amber-700") : (present ? "text-slate-400" : "text-slate-600");
  return (
    <div>
      <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${titleTone}`}>{title}</div>
      {rows?.length === 0 ? (
        <div className="text-xs text-slate-500">{emptyLabel}</div>
      ) : (
        <div className="space-y-1">
          {rows.map((r: any) => (
            <Link key={r.id} href={`/sow/${r.id}`} className={`flex items-center justify-between rounded border px-3 py-1.5 text-sm hover:border-slate-400 ${present ? "border-slate-700 bg-slate-800 text-slate-200" : "border-slate-200 bg-white text-slate-800"}`}>
              <span className="truncate">
                <span className="font-medium">{r.brandName}</span>
                {r.title && <span className={`ml-2 text-xs ${present ? "text-slate-400" : "text-slate-500"}`}>{r.title}</span>}
              </span>
              <span className={`ml-2 shrink-0 text-xs ${present ? "text-slate-400" : "text-slate-500"}`}>{r.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StageBar({ stage, count, max, present }: any) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className={`w-36 text-xs ${present ? "text-slate-300" : "text-slate-700"}`}>{stage}</div>
      <div className={`h-4 flex-1 rounded ${present ? "bg-slate-800" : "bg-slate-100"} relative overflow-hidden`}>
        <div className="absolute inset-y-0 left-0 bg-blue-500" style={{ width: `${pct}%` }} />
      </div>
      <div className={`w-8 text-right text-xs ${present ? "text-slate-400" : "text-slate-600"}`}>{count}</div>
    </div>
  );
}

function BrandList({ title, rows, present }: any) {
  return (
    <div>
      <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${present ? "text-slate-400" : "text-slate-600"}`}>{title}</div>
      {rows?.length === 0 ? (
        <div className="text-xs text-slate-500">None this window.</div>
      ) : (
        <div className="space-y-1">
          {rows.map((b: any) => (
            <Link key={b.id} href={`/brands/${b.id}`} className={`flex items-center justify-between rounded border px-3 py-1.5 text-sm hover:border-slate-400 ${present ? "border-slate-700 bg-slate-800 text-slate-200" : "border-slate-200 bg-white text-slate-800"}`}>
              <span className="font-medium">{b.name}</span>
              <span className={`text-xs ${present ? "text-slate-400" : "text-slate-500"}`}>{b.pipelineStage}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function HandoffList({ rows, present }: any) {
  return (
    <div>
      <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${present ? "text-amber-400" : "text-amber-700"}`}>Handoff queue</div>
      {rows?.length === 0 ? (
        <div className="text-xs text-slate-500">Nothing waiting for handoff.</div>
      ) : (
        <div className="space-y-1">
          {rows.map((b: any) => (
            <Link key={b.brandId} href={`/brands/${b.brandId}`} className={`flex items-center justify-between rounded border px-3 py-1.5 text-sm hover:border-slate-400 ${present ? "border-slate-700 bg-slate-800 text-slate-200" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <span className="font-medium">{b.brandName}</span>
              <span className="text-xs">{b.pipelineStage}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ShareMenu({ reportId, shares, onChange }: any) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || users.length) return;
    fetch("/api/settings/users?role=INTERNAL&limit=200")
      .then((r) => r.json())
      .then((j) => setUsers(j?.users || []))
      .catch(() => setUsers([]));
  }, [open, users.length]);

  const grant = async (userId: string) => {
    setBusy(true);
    try {
      await fetch(`/api/admin/weekly-review/${reportId}/share`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, scope: "FULL" }),
      });
      await onChange();
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (userId: string) => {
    setBusy(true);
    try {
      await fetch(`/api/admin/weekly-review/${reportId}/share?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((x) => !x)}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Share {shares.length > 0 && <span className="ml-1 rounded-full bg-slate-900 text-white px-1.5 py-0.5 text-[10px]">{shares.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-80 rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="max-h-64 overflow-auto p-2">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Shared with</div>
            {shares.length === 0 && <div className="mb-2 px-2 text-xs text-slate-500">Just you.</div>}
            {shares.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between rounded px-2 py-1 text-sm">
                <div>
                  <div className="font-medium text-slate-800">{s.user.name}</div>
                  <div className="text-xs text-slate-500">{s.user.email}</div>
                </div>
                <button onClick={() => revoke(s.user.id)} disabled={busy} className="text-xs text-rose-600 hover:underline">Revoke</button>
              </div>
            ))}
            <div className="my-2 border-t border-slate-100" />
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Grant access</div>
            {users
              .filter((u: any) => !shares.some((s: any) => s.user.id === u.id))
              .filter((u: any) => ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "TESTING_MANAGER", "BD_REP"].includes(u.role))
              .slice(0, 40)
              .map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => grant(u.id)}
                  disabled={busy}
                  className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-50"
                >
                  <div className="font-medium text-slate-800">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email} · {u.role}</div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InlineNoteComposer({ reportId, onSaved, present }: any) {
  const [content, setContent] = useState("");
  const [brandId, setBrandId] = useState("");
  const [brandQuery, setBrandQuery] = useState("");
  const [matches, setMatches] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  // Fetch-once + client-side filter. /api/brands returns the full flat list —
  // there's no search endpoint, and the brand set is small enough that
  // filtering locally keeps the typeahead responsive.
  const [allBrands, setAllBrands] = useState<any[]>([]);
  useEffect(() => {
    if (allBrands.length) return;
    fetch("/api/brands")
      .then((r) => r.json())
      .then((j) => setAllBrands(Array.isArray(j?.brands) ? j.brands : []))
      .catch(() => setAllBrands([]));
  }, [allBrands.length]);
  useEffect(() => {
    const q = brandQuery.trim().toLowerCase();
    if (q.length < 2) { setMatches([]); return; }
    setMatches(
      allBrands
        .filter((b: any) => (b.name || "").toLowerCase().includes(q))
        .slice(0, 8),
    );
  }, [brandQuery, allBrands]);

  const submit = async () => {
    if (!content.trim() || !brandId) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/weekly-review/${reportId}/note`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandId, content, noteType: "WEEKLY_REVIEW" }),
      });
      if (!r.ok) throw new Error("save failed");
      setContent(""); setBrandId(""); setBrandQuery(""); setMatches([]);
      await onSaved();
    } catch (e: any) {
      alert(e.message || "Failed to save note");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-md border p-3 ${present ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex flex-col gap-2 md:flex-row">
        <div className="relative md:w-64">
          <input
            value={brandQuery}
            onChange={(e) => { setBrandQuery(e.target.value); setBrandId(""); }}
            placeholder="Brand (e.g. Carhartt, Nike)…"
            className={`w-full rounded border px-2 py-1.5 text-sm ${present ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
          />
          {matches.length > 0 && !brandId && (
            <div className="absolute z-10 mt-1 w-full rounded border border-slate-200 bg-white shadow">
              {matches.map((m: any) => (
                <button
                  key={m.id}
                  onClick={() => { setBrandId(m.id); setBrandQuery(m.name); setMatches([]); }}
                  className="block w-full px-2 py-1 text-left text-sm hover:bg-slate-50"
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
          {brandId && <div className="mt-1 text-[10px] text-emerald-600">✓ linked</div>}
        </div>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Note (e.g. Carhartt waiting for training — schedule w/k of 5/11)"
          className={`flex-1 rounded border px-2 py-1.5 text-sm ${present ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
        />
        <button
          onClick={submit}
          disabled={busy || !brandId || !content.trim()}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add note"}
        </button>
      </div>
    </div>
  );
}

function InlineMeetingComposer({ reportId, onSaved, present }: any) {
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [brandQuery, setBrandQuery] = useState("");
  const [brandId, setBrandId] = useState("");
  const [matches, setMatches] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  // Fetch-once + client-side filter. /api/brands returns the full flat list —
  // there's no search endpoint, and the brand set is small enough that
  // filtering locally keeps the typeahead responsive.
  const [allBrands, setAllBrands] = useState<any[]>([]);
  useEffect(() => {
    if (allBrands.length) return;
    fetch("/api/brands")
      .then((r) => r.json())
      .then((j) => setAllBrands(Array.isArray(j?.brands) ? j.brands : []))
      .catch(() => setAllBrands([]));
  }, [allBrands.length]);
  useEffect(() => {
    const q = brandQuery.trim().toLowerCase();
    if (q.length < 2) { setMatches([]); return; }
    setMatches(
      allBrands
        .filter((b: any) => (b.name || "").toLowerCase().includes(q))
        .slice(0, 8),
    );
  }, [brandQuery, allBrands]);

  const submit = async () => {
    if (!title.trim() || !when) return;
    setBusy(true);
    try {
      const startTime = new Date(when).toISOString();
      const r = await fetch(`/api/admin/weekly-review/${reportId}/meeting`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, startTime, brandId: brandId || undefined, meetingType: "INTERNAL" }),
      });
      if (!r.ok) throw new Error("save failed");
      setTitle(""); setWhen(""); setBrandId(""); setBrandQuery("");
      await onSaved();
    } catch (e: any) {
      alert(e.message || "Failed to schedule meeting");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-md border p-3 ${present ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex flex-col gap-2 md:flex-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting title (e.g. Nike report review)"
          className={`flex-1 rounded border px-2 py-1.5 text-sm ${present ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
        />
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className={`md:w-56 rounded border px-2 py-1.5 text-sm ${present ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
        />
        <div className="relative md:w-52">
          <input
            value={brandQuery}
            onChange={(e) => { setBrandQuery(e.target.value); setBrandId(""); }}
            placeholder="Brand (optional)"
            className={`w-full rounded border px-2 py-1.5 text-sm ${present ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
          />
          {matches.length > 0 && !brandId && (
            <div className="absolute z-10 mt-1 w-full rounded border border-slate-200 bg-white shadow">
              {matches.map((m: any) => (
                <button
                  key={m.id}
                  onClick={() => { setBrandId(m.id); setBrandQuery(m.name); setMatches([]); }}
                  className="block w-full px-2 py-1 text-left text-sm hover:bg-slate-50"
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={submit}
          disabled={busy || !title.trim() || !when}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? "Scheduling…" : "Schedule"}
        </button>
      </div>
    </div>
  );
}
