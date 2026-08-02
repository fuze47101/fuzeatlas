"use client";

import { useEffect, useMemo, useState, Fragment, type ReactNode, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { HydrationFrame, useMountLog } from "@/components/HydrationFrame";
import { RedRoverBoard } from "@/components/RedRoverBoard";

/* ── Types ─────────────────────────────────────────────── */
interface Contact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  side: string;
  role: string;
}
interface TargetRow {
  id: string;
  name: string;
  rank: number | null;
  tier: string;
  companyClass: string | null;
  geo: string | null;
  stage: string;
  ownerId: string | null;
  ownerName: string | null;
  nextStep: string | null;
  primaryContact: Contact | null;
  contactCount: number;
  negotiationCount: number;
  gatekeeperCount: number;
  activityCount: number;
  lastActivityAt: string | null;
  daysSinceActivity: number | null;
}
interface Owner {
  id: string;
  name: string;
}
interface Summary {
  total: number;
  stageFunnel: Record<string, number>;
  tier1Count: number;
  stalledCount: number;
  noActivity14d: number;
  ownedByJosh: number;
}
interface ApiResp {
  ok: boolean;
  targets: TargetRow[];
  owners: Owner[];
  summary: Summary;
  brief: { projectId: string; name: string; goalMd: string | null };
}

/* ── Stage / tier styling ──────────────────────────────── */
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
const TIER_COLORS: Record<string, string> = {
  TIER1: "bg-rose-600 text-white",
  TIER2: "bg-amber-500 text-white",
  PARKED: "bg-slate-400 text-white",
};

/* ── Tiny markdown renderer for the Engagement Brief ───── */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={`${keyBase}-${i}`} className="font-semibold text-slate-900">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={`${keyBase}-${i}`}>{p}</Fragment>
    ),
  );
}
function renderMarkdown(md: string): ReactNode {
  const lines = md.split("\n");
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="my-2 ml-5 list-disc space-y-1 text-sm text-slate-700">
          {list}
        </ul>,
      );
      list = [];
    }
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) {
      flush();
      out.push(
        <h4 key={idx} className="mt-4 mb-1 text-sm font-semibold text-slate-800">
          {renderInline(line.replace(/^###\s+/, ""), `h4-${idx}`)}
        </h4>,
      );
    } else if (/^##\s+/.test(line)) {
      flush();
      out.push(
        <h3 key={idx} className="mt-5 mb-1 text-base font-bold text-slate-900">
          {renderInline(line.replace(/^##\s+/, ""), `h3-${idx}`)}
        </h3>,
      );
    } else if (/^#\s+/.test(line)) {
      flush();
      out.push(
        <h2 key={idx} className="mt-2 mb-2 text-lg font-bold text-slate-900">
          {renderInline(line.replace(/^#\s+/, ""), `h2-${idx}`)}
        </h2>,
      );
    } else if (/^[-*]\s+/.test(line)) {
      list.push(
        <li key={idx}>{renderInline(line.replace(/^[-*]\s+/, ""), `li-${idx}`)}</li>,
      );
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      out.push(
        <p key={idx} className="my-1 text-sm text-slate-700">
          {renderInline(line, `p-${idx}`)}
        </p>,
      );
    }
  });
  flush();
  return out;
}

/* ── Staleness cell ────────────────────────────────────── */
function lastActivityLabel(t: TargetRow): { text: string; cls: string } {
  if (t.daysSinceActivity == null) return { text: "No activity", cls: "text-rose-600 font-semibold" };
  const d = t.daysSinceActivity;
  const text = d === 0 ? "Today" : d === 1 ? "1 day ago" : `${d} days ago`;
  if (d > 14) return { text, cls: "text-rose-600 font-semibold" };
  if (d > 7) return { text, cls: "text-amber-600 font-medium" };
  return { text, cls: "text-slate-600" };
}

/* ── Page ──────────────────────────────────────────────── */
export default function RedRoverDashboardOuter() {
  return (
    <HydrationFrame name="/admin/red-rover">
      <RedRoverDashboard />
    </HydrationFrame>
  );
}

function RedRoverDashboard() {
  useMountLog("red-rover-dashboard");
  const { user, loading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<ApiResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  const [tierFilter, setTierFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [briefOpen, setBriefOpen] = useState(false);
  const [view, setView] = useState<"table" | "board">("table");

  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    tier: "TIER2",
    stage: "IDENTIFIED",
    rank: "",
    companyClass: "",
    geo: "",
    ownerId: "",
  });

  const isAdmin =
    !!user && ["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role);

  async function load() {
    setFetching(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/red-rover", { cache: "no-store" });
      if (!res.ok) {
        setErr(`API ${res.status}`);
        setData(null);
      } else {
        setData(await res.json());
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) {
      router.replace("/home");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAdmin]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.targets.filter(
      (t) =>
        (tierFilter === "ALL" || t.tier === tierFilter) &&
        (stageFilter === "ALL" || t.stage === stageFilter) &&
        (ownerFilter === "ALL" || t.ownerId === ownerFilter),
    );
  }, [data, tierFilter, stageFilter, ownerFilter]);

  async function submitAdd(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setAddBusy(true);
    try {
      const res = await fetch("/api/admin/red-rover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          tier: form.tier,
          stage: form.stage,
          rank: form.rank ? Number(form.rank) : undefined,
          companyClass: form.companyClass.trim() || undefined,
          geo: form.geo.trim() || undefined,
          ownerId: form.ownerId || undefined,
        }),
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        setAddOpen(false);
        setForm({ name: "", tier: "TIER2", stage: "IDENTIFIED", rank: "", companyClass: "", geo: "", ownerId: "" });
        router.push(`/admin/red-rover/${j.target.id}`);
      } else {
        alert(j.error || "Create failed");
      }
    } catch (e: any) {
      alert(e?.message || "Create failed");
    } finally {
      setAddBusy(false);
    }
  }

  if (loading || (fetching && !data)) {
    return <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-slate-500">Loading Red Rover…</div>;
  }
  if (!isAdmin) return null;

  const s = data?.summary;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🚀 Red Rover</h1>
          <p className="text-sm text-slate-500">
            Industry outreach & negotiation tracker — live status on every target, owner accountability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
            <button
              onClick={() => setView("table")}
              className={`px-3 py-2 text-sm font-medium ${view === "table" ? "bg-rose-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Table
            </button>
            <button
              onClick={() => setView("board")}
              className={`px-3 py-2 text-sm font-medium ${view === "board" ? "bg-rose-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Board
            </button>
          </div>
          <a
            href="/api/admin/red-rover/export"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ⬇ Export CSV
          </a>
          <button
            onClick={() => setAddOpen((v) => !v)}
            className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            + Add target
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Failed to load Red Rover: {err}
        </div>
      )}

      {/* Add-target form */}
      {addOpen && (
        <form
          onSubmit={submitAdd}
          className="mb-5 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3"
        >
          <input
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Target name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Class (e.g. Textile-chemical major)"
            value={form.companyClass}
            onChange={(e) => setForm({ ...form, companyClass: e.target.value })}
          />
          <input
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Geo"
            value={form.geo}
            onChange={(e) => setForm({ ...form, geo: e.target.value })}
          />
          <select
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={form.tier}
            onChange={(e) => setForm({ ...form, tier: e.target.value })}
          >
            <option value="TIER1">TIER1</option>
            <option value="TIER2">TIER2</option>
            <option value="PARKED">PARKED</option>
          </select>
          <select
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={form.stage}
            onChange={(e) => setForm({ ...form, stage: e.target.value })}
          >
            {STAGE_ORDER.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Rank (optional)"
            type="number"
            value={form.rank}
            onChange={(e) => setForm({ ...form, rank: e.target.value })}
          />
          <select
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={form.ownerId}
            onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
          >
            <option value="">Owner: Josh Lujan (default)</option>
            {data?.owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={addBusy}
              className="rounded bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {addBusy ? "Creating…" : "Create target"}
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Summary cards */}
      {s && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Card label="Targets" value={s.total} sub={`${s.tier1Count} Tier 1`} />
          <Card label="Owned by Josh" value={s.ownedByJosh} sub="accountable owner" />
          <Card
            label="Stalled"
            value={s.stalledCount}
            sub="stage = STALLED"
            tone={s.stalledCount > 0 ? "amber" : "ok"}
          />
          <Card
            label="No activity >14d"
            value={s.noActivity14d}
            sub="accountability signal"
            tone={s.noActivity14d > 0 ? "rose" : "ok"}
          />
          <StageFunnelCard funnel={s.stageFunnel} />
        </div>
      )}

      {/* Engagement Brief */}
      {data?.brief && (
        <div className="mb-5 rounded-lg border border-slate-200 bg-white">
          <button
            onClick={() => setBriefOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-slate-800">
              📋 Engagement Brief — {data.brief.name}
            </span>
            <span className="text-slate-400">{briefOpen ? "▲" : "▼"}</span>
          </button>
          {briefOpen && (
            <div className="border-t border-slate-100 px-5 py-4">
              {data.brief.goalMd ? (
                <div className="max-w-none">{renderMarkdown(data.brief.goalMd)}</div>
              ) : (
                <p className="text-sm text-slate-500">
                  No brief text found on the Red Rover project (goalMd empty).
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterSelect label="Tier" value={tierFilter} onChange={setTierFilter} options={["ALL", "TIER1", "TIER2", "PARKED"]} />
        <FilterSelect label="Stage" value={stageFilter} onChange={setStageFilter} options={["ALL", ...STAGE_ORDER]} />
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
        >
          <option value="ALL">Owner: All</option>
          {data?.owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-slate-500">
          {filtered.length} of {data?.targets.length ?? 0} targets
        </span>
      </div>

      {/* Board view */}
      {view === "board" ? (
        <RedRoverBoard targets={filtered} onReload={load} />
      ) : (
      /* Table view */
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Key contact</th>
              <th className="px-3 py-2">Last activity</th>
              <th className="px-3 py-2">Next step</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.map((t) => {
              const la = lastActivityLabel(t);
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 align-top">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${TIER_COLORS[t.tier] || "bg-slate-300"}`}>
                      {t.rank ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Link href={`/admin/red-rover/${t.id}`} className="font-semibold text-rose-700 hover:underline">
                      {t.name}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {t.companyClass}
                      {t.companyClass && t.geo ? " · " : ""}
                      {t.geo}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[t.stage] || "bg-slate-100"}`}>
                      {t.stage}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-slate-700">{t.ownerName || "—"}</td>
                  <td className="px-3 py-2 align-top">
                    {t.primaryContact ? (
                      <div>
                        <div className="text-slate-800">{t.primaryContact.name}</div>
                        <div className="text-xs text-slate-500">
                          {t.primaryContact.title || t.primaryContact.side}
                          {t.gatekeeperCount > 0 && (
                            <span className="ml-1 text-violet-600">· +{t.gatekeeperCount} tech</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className={la.cls}>{la.text}</span>
                    <div className="text-xs text-slate-400">{t.activityCount} logged</div>
                  </td>
                  <td className="px-3 py-2 align-top text-slate-600">
                    <div className="max-w-xs truncate" title={t.nextStep || ""}>
                      {t.nextStep || "—"}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                  No targets match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

/* ── Small components ──────────────────────────────────── */
function Card({
  label,
  value,
  sub,
  tone = "ok",
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "ok" | "amber" | "rose";
}) {
  const toneCls =
    tone === "rose"
      ? "text-rose-600"
      : tone === "amber"
        ? "text-amber-600"
        : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function StageFunnelCard({ funnel }: { funnel: Record<string, number> }) {
  return (
    <div className="col-span-2 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:col-span-1">
      <div className="text-xs uppercase tracking-wide text-slate-500">Stage funnel</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {STAGE_ORDER.filter((st) => funnel[st]).map((st) => (
          <span key={st} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STAGE_COLORS[st]}`}>
            {st.slice(0, 4)} {funnel[st]}
          </span>
        ))}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      className="rounded border border-slate-300 px-2 py-1.5 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o === "ALL" ? `${label}: All` : o}
        </option>
      ))}
    </select>
  );
}
