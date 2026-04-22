"use client";
// @ts-nocheck
/**
 * Brand Portal — Searchable Test Results Library (ticket #34).
 *
 * Hard rules from Andrew's brief:
 *   - Show only tests submitted FOR this brand (factories, Atlas, brand
 *     itself). Already enforced by /api/tests?brandId=... + brandVisible.
 *   - Sort "fantastic first" — strongest PASS margin floats to the top.
 *   - Never expose raw FAIL to brand users. Fails relabel as "Development
 *     & Application Validation Result" with muted styling and a tooltip
 *     explainer. Admins keep raw PASS/FAIL. (Server enforces both the
 *     relabel and the data scrub via protectFails=true.)
 *
 * UI:
 *   - Search box (report#, fabric#, lab, method)
 *   - Type chips (ICP / ANTIBACTERIAL / FUNGAL / ODOR / UV / MICROFIBER)
 *   - Wash count slider (min/max)
 *   - "Similar fabrics" filter — pick a fabric, get tests on the same
 *     fabricCategory family
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const TYPE_COLORS: Record<string, string> = {
  ICP: "bg-violet-100 text-violet-700",
  ANTIBACTERIAL: "bg-blue-100 text-blue-700",
  FUNGAL: "bg-emerald-100 text-emerald-700",
  ODOR: "bg-amber-100 text-amber-700",
  UV: "bg-pink-100 text-pink-700",
  MICROFIBER: "bg-indigo-100 text-indigo-700",
};

const ALL_TYPES = ["ICP", "ANTIBACTERIAL", "FUNGAL", "ODOR", "UV", "MICROFIBER"];

interface Run {
  id: string;
  testType: string;
  testReportNumber: string | null;
  testDate: string | null;
  testMethodStd: string | null;
  washCount: number | null;
  lab: string | null;
  fuzeNumber: number | null;
  fabricId: string | null;
  fabricCategory: string | null;
  fantasticScore: number | null;
  rawStatus: "PASS" | "FAIL" | "MEASUREMENT" | "UNKNOWN";
  view: {
    badge: "PASS" | "FAIL" | "DAVR" | "MEASUREMENT" | "PENDING";
    badgeLabel: string;
    badgeClass: string;
    resultLabel: string | null;
    hint: string | null;
  };
}

export default function BrandPortalTestsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = !!user && ["ADMIN", "SUPER_ADMIN"].includes(user.role);

  const [tests, setTests] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [brand, setBrand] = useState<any>(null);

  // Filters
  const [type, setType] = useState<string>("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [washMin, setWashMin] = useState<string>("");
  const [washMax, setWashMax] = useState<string>("");
  const [similarTo, setSimilarTo] = useState<string>("");
  const [sort, setSort] = useState<"fantastic" | "recent">("fantastic");

  // Available fabrics for "similar to" picker — populated from current
  // result set so we never offer fabrics the brand can't see.
  const fabricOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string }>();
    tests.forEach((t) => {
      if (t.fabricId && !seen.has(t.fabricId)) {
        seen.set(t.fabricId, {
          id: t.fabricId,
          label: t.fuzeNumber
            ? `FUZE ${t.fuzeNumber}${t.fabricCategory ? ` — ${t.fabricCategory}` : ""}`
            : t.fabricCategory || t.fabricId,
        });
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [tests]);

  // Debounce search to keep the network quiet while reps type.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(id);
  }, [q]);

  // Initial brand load — needed for the brandId param on the tests fetch.
  useEffect(() => {
    fetch("/api/brand-portal")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setBrand(j.brand);
        else throw new Error(j.error || "Failed to load brand");
      })
      .catch((e) => setError(e.message));
  }, []);

  // Tests fetch — re-runs whenever the filter set changes.
  useEffect(() => {
    if (!brand?.id) return;
    setLoading(true);
    const params = new URLSearchParams({
      brandId: brand.id,
      brandVisible: "true",
      sort,
      withResults: "true",
      protectFails: isAdmin ? "false" : "true",
    });
    if (type !== "all") params.set("type", type);
    if (debouncedQ) params.set("q", debouncedQ);
    if (washMin) params.set("washMin", washMin);
    if (washMax) params.set("washMax", washMax);
    if (similarTo) params.set("similarTo", similarTo);

    fetch(`/api/tests?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setTests(j.runs || []);
        else setError(j.error || "Failed to load tests");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [brand?.id, type, debouncedQ, washMin, washMax, similarTo, sort, isAdmin]);

  // Type counts (from current result set — recomputes as filters narrow).
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    tests.forEach((t) => {
      m[t.testType] = (m[t.testType] || 0) + 1;
    });
    return m;
  }, [tests]);

  // Quick stats — only count items the brand can claim as wins.
  const passCount = tests.filter(
    (t) => t.view.badge === "PASS" || t.view.badge === "MEASUREMENT",
  ).length;
  const davrCount = tests.filter((t) => t.view.badge === "DAVR").length;

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Test Results</h1>
        <p className="text-sm text-slate-500 mt-1">
          {brand?.name || "Your brand"} — {tests.length} test result
          {tests.length !== 1 ? "s" : ""}
          {passCount > 0 && (
            <span className="text-emerald-600 font-semibold">
              {" "}
              · {passCount} qualifying
            </span>
          )}
          {davrCount > 0 && !isAdmin && (
            <span className="text-slate-400">
              {" "}
              · {davrCount} development & validation
            </span>
          )}
        </p>
      </div>

      {/* Filter row 1 — search + sort */}
      <div className="flex flex-wrap gap-3 mb-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search report #, fabric, lab, method…"
          className="flex-1 min-w-[260px] px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "fantastic" | "recent")}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
        >
          <option value="fantastic">Sort: strongest first</option>
          <option value="recent">Sort: most recent</option>
        </select>
      </div>

      {/* Filter row 2 — type chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => setType("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${type === "all" ? "bg-slate-900 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"}`}
        >
          All ({tests.length})
        </button>
        {ALL_TYPES.map((tp) => {
          const c = typeCounts[tp] || 0;
          if (c === 0 && type !== tp) return null;
          return (
            <button
              key={tp}
              onClick={() => setType(tp)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${type === tp ? "bg-slate-900 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"}`}
            >
              {tp} ({c})
            </button>
          );
        })}
      </div>

      {/* Filter row 3 — wash counts + similar fabrics */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-semibold">Washes</label>
          <input
            type="number"
            min={0}
            value={washMin}
            onChange={(e) => setWashMin(e.target.value)}
            placeholder="min"
            className="w-20 px-2 py-1.5 rounded-md border border-slate-300 text-sm"
          />
          <span className="text-slate-300">–</span>
          <input
            type="number"
            min={0}
            value={washMax}
            onChange={(e) => setWashMax(e.target.value)}
            placeholder="max"
            className="w-20 px-2 py-1.5 rounded-md border border-slate-300 text-sm"
          />
        </div>
        {fabricOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-semibold">Similar to</label>
            <select
              value={similarTo}
              onChange={(e) => setSimilarTo(e.target.value)}
              className="px-2 py-1.5 rounded-md border border-slate-300 text-sm bg-white max-w-[260px]"
            >
              <option value="">— any fabric —</option>
              {fabricOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {(q || washMin || washMax || similarTo || type !== "all") && (
          <button
            onClick={() => {
              setQ("");
              setWashMin("");
              setWashMax("");
              setSimilarTo("");
              setType("all");
            }}
            className="text-xs text-slate-500 hover:text-slate-900 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32 text-slate-400">
          Loading test results…
        </div>
      )}

      {!loading && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Report #</th>
                <th className="px-4 py-3">Fabric</th>
                <th className="px-4 py-3">Lab</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Washes</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => {
                const isDavr = t.view.badge === "DAVR";
                return (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/tests/${t.id}`)}
                    className={`border-t border-slate-100 cursor-pointer transition-colors ${isDavr ? "bg-slate-50/40 hover:bg-slate-100 text-slate-500" : "hover:bg-blue-50"}`}
                    title={t.view.hint || undefined}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TYPE_COLORS[t.testType] || "bg-slate-100 text-slate-600"}`}
                      >
                        {t.testType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {t.testReportNumber || "—"}
                    </td>
                    <td className={`px-4 py-3 font-bold ${isDavr ? "text-slate-400" : "text-[#00b4c3]"}`}>
                      {t.fuzeNumber ? `FUZE ${t.fuzeNumber}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">{t.lab || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {t.testMethodStd || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {t.washCount ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.view.badgeClass}`}
                      >
                        {t.view.badgeLabel}
                      </span>
                      {t.view.resultLabel && !isDavr && (
                        <span className="ml-2 text-[10px] text-slate-500 font-mono">
                          {t.view.resultLabel}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {t.testDate
                        ? new Date(t.testDate).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {tests.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              {q || washMin || washMax || similarTo || type !== "all"
                ? "No results match these filters. Try clearing them."
                : "No test results yet for your brand."}
            </div>
          )}
        </div>
      )}

      {/* DAVR explainer footer — only when fails are present in the result
          set so we don't surface the concept gratuitously. */}
      {!isAdmin && davrCount > 0 && (
        <div className="mt-4 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
          <span className="font-semibold text-slate-700">Development &amp; Validation results</span>{" "}
          are iterative R&amp;D data captured during the FUZE program. They reflect early
          recipe and fabric variants tracked for engineering, not finalized
          production claims.
        </div>
      )}
    </div>
  );
}
