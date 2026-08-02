"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { HydrationFrame, useMountLog } from "@/components/HydrationFrame";
import { STAGE_COLORS, TIER_COLORS, staleness } from "@/lib/red-rover-ui";

interface TripTarget {
  id: string;
  name: string;
  rank: number | null;
  tier: string;
  stage: string;
  geo: string | null;
  companyClass: string | null;
  tripLeg: string;
  ownerName: string | null;
  nextStep: string | null;
  daysSinceActivity: number | null;
}

const LEGS: { key: string; title: string; anchor?: string; accent: string }[] = [
  { key: "EU_MUNICH", title: "EU / Munich", anchor: "Performance Days Munich · Oct 13–14 · Booth B04", accent: "border-indigo-400" },
  { key: "ASIA_SHANGHAI", title: "Asia / Shanghai", accent: "border-rose-400" },
  { key: "JAPAN", title: "Japan", accent: "border-amber-400" },
  { key: "US", title: "United States", accent: "border-sky-400" },
  { key: "OTHER", title: "Other / Unassigned", accent: "border-slate-300" },
];

export default function RedRoverTripsOuter() {
  return (
    <HydrationFrame name="/admin/red-rover/trips">
      <RedRoverTrips />
    </HydrationFrame>
  );
}

function RedRoverTrips() {
  useMountLog("red-rover-trips");
  const { user, loading } = useAuth();
  const router = useRouter();
  const [targets, setTargets] = useState<TripTarget[]>([]);
  const [fetching, setFetching] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const isAdmin = !!user && ["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role);

  const load = useCallback(async () => {
    setFetching(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/red-rover", { cache: "no-store" });
      if (!res.ok) setErr(`API ${res.status}`);
      else setTargets((await res.json()).targets || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) {
      router.replace("/home");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAdmin]);

  const byLeg = useMemo(() => {
    const m: Record<string, TripTarget[]> = {};
    for (const t of targets) (m[t.tripLeg || "OTHER"] = m[t.tripLeg || "OTHER"] || []).push(t);
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
    return m;
  }, [targets]);

  if (loading || (fetching && targets.length === 0)) {
    return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">Loading trips…</div>;
  }
  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🚀 Red Rover — Trips</h1>
          <p className="text-sm text-slate-500">Targets grouped by acquisition trip leg. Munich is the anchor cluster.</p>
        </div>
        <Link href="/admin/red-rover" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          ← Dashboard
        </Link>
      </div>
      {err && <div className="mb-4 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">Failed to load: {err}</div>}

      <div className="space-y-6">
        {LEGS.map((leg) => {
          const list = byLeg[leg.key] || [];
          if (list.length === 0 && leg.key === "OTHER") return null;
          return (
            <section key={leg.key} className={`rounded-lg border-l-4 bg-white ${leg.accent} border border-slate-200 p-4`}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {leg.title} <span className="text-sm font-normal text-slate-400">· {list.length} target{list.length === 1 ? "" : "s"}</span>
                </h2>
                {leg.anchor && (
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">📍 {leg.anchor}</span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((t) => (
                  <TripCard key={t.id} t={t} onLogged={load} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TripCard({ t, onLogged }: { t: TripTarget; onLogged: () => void }) {
  const la = staleness(t.daysSinceActivity);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function schedule(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/admin/red-rover/${t.id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "MEETING", body: `📅 Scheduled meeting: ${note.trim()}` }),
    });
    setBusy(false);
    if (res.ok) {
      setNote("");
      setOpen(false);
      onLogged();
    } else {
      alert("Could not save the meeting note");
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-1">
        <Link href={`/admin/red-rover/${t.id}`} className="text-sm font-semibold text-rose-700 hover:underline">
          {t.name}
        </Link>
        <span className={`rounded px-1 text-[10px] font-bold ${TIER_COLORS[t.tier] || "bg-slate-300"}`}>{t.rank ?? "—"}</span>
      </div>
      <div className="mt-0.5 text-[11px] text-slate-500">{t.geo}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STAGE_COLORS[t.stage] || "bg-slate-100"}`}>{t.stage}</span>
        <span className={`text-[11px] ${la.cls}`}>{la.text}</span>
      </div>
      {t.nextStep && (
        <div className="mt-1 text-[11px] text-slate-600">
          <span className="font-semibold">Next:</span> {t.nextStep}
        </div>
      )}
      {open ? (
        <form onSubmit={schedule} className="mt-2">
          <input
            autoFocus
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            placeholder="e.g. Aug 18 review call w/ Birgit"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="mt-1 flex gap-1">
            <button disabled={busy} className="rounded bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-50">
              {busy ? "…" : "Save"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded bg-slate-200 px-2 py-0.5 text-[11px]">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-2 text-[11px] font-medium text-indigo-600 hover:underline">
          📅 Schedule meeting note
        </button>
      )}
    </div>
  );
}
