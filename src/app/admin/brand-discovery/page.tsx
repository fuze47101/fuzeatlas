// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import BulkEnrichButton from "@/components/BulkEnrichButton";
import ErrorPanel from "@/components/ErrorPanel";

const CATEGORIES = [
  "Activewear & Athleisure",
  "Outdoor & Performance",
  "Workwear & Uniforms",
  "Military & Defense",
  "Medical Textiles",
  "Hospitality (Hotels/Restaurants)",
  "Home Textiles & Bedding",
  "Intimate Apparel & Socks",
  "Denim & Casualwear",
  "Luxury & Fashion",
  "Childrenswear",
  "Artificial Turf",
  "Automotive Textiles",
  "Industrial & Technical Textiles",
];

const REGIONS = [
  "Global",
  "North America",
  "Europe",
  "Asia Pacific",
  "Latin America",
  "Middle East & Africa",
];

interface DiscoveredBrand {
  id: string;
  name: string;
  website?: string;
  segment?: string;
  priorityTier?: string;
  validationCount: number;
  sources: string[];
}

interface DiscoveryResult {
  summary: {
    category: string;
    region: string;
    aiSourcesUsed: string[];
    totalDiscovered: number;
    afterDedup: number;
    created: number;
    skipped: number;
  };
  brands: DiscoveredBrand[];
}

export default function BrandDiscoveryPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState("Activewear & Athleisure");
  const [region, setRegion] = useState("Global");
  const [count, setCount] = useState(25);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [history, setHistory] = useState<DiscoveryResult[]>([]);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<any>(null);
  // Silent-zero sweep — render an explicit error instead of an
  // empty discovery dashboard when /api/brands/discover 500s.
  const [statsError, setStatsError] = useState<string | null>(null);

  const refreshStats = async () => {
    setStatsError(null);
    try {
      const r = await fetch("/api/brands/discover");
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || j.ok === false) {
        setStatsError(
          (j && (j.error || j.message)) ||
            `Couldn't load discovery stats (HTTP ${r.status}).`,
        );
        return;
      }
      setStats(j);
    } catch (e: any) {
      setStatsError(e?.message || "Network error while loading discovery stats.");
    }
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const runDiscovery = async () => {
    setRunning(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/brands/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, region, count, excludeExisting: true }),
      });
      const json = await res.json();

      if (!json.ok) {
        setError(json.error || "Discovery failed");
        return;
      }

      setResult(json);
      setHistory(prev => [json, ...prev]);

      // Refresh stats
      refreshStats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const runAllCategories = async () => {
    setRunning(true);
    setError("");
    setResult(null);

    for (const cat of CATEGORIES) {
      try {
        setCategory(cat);
        const res = await fetch("/api/brands/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: cat, region, count: 20, excludeExisting: true }),
        });
        const json = await res.json();
        if (json.ok) {
          setHistory(prev => [json, ...prev]);
        }
      } catch {}
    }

    // Refresh stats
    await refreshStats();

    setRunning(false);
  };

  const tierColor: Record<string, string> = {
    A: "bg-emerald-100 text-emerald-700",
    B: "bg-blue-100 text-blue-700",
    C: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/home" className="hover:text-[#00b4c3]">Home</Link>
            <span>/</span>
            <Link href="/admin/bd/wizard" className="hover:text-[#00b4c3]">BD Wizard</Link>
            <span>/</span>
            <span>Brand Discovery</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">🌎 Worldwide Brand Discovery</h1>
          <p className="text-slate-500 mt-1 max-w-2xl">
            Multi-AI engine — finds + validates textile brands across Anthropic, OpenAI, and Grok, then auto-attaches Apollo contacts to every new brand so the BD Wizard can use them immediately.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <div className="text-right">
              <div className="text-3xl font-black text-[#00b4c3]">{stats.stats?.total || 0}</div>
              <div className="text-xs text-slate-500">Total Brands in DB</div>
            </div>
          )}
          <Link
            href="/admin/bd/wizard"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 whitespace-nowrap"
            title="Round-trip back to the wizard once new brands land"
          >
            ← Back to Wizard
          </Link>
        </div>
      </div>

      {statsError && (
        <div className="mb-4">
          <ErrorPanel context="Load discovery stats" error={statsError} onRetry={refreshStats} />
        </div>
      )}

      {/* Auto-enrich callout — this is new behavior since we wired Apollo
          people-search into /api/brands/discover. Worth telling reps so
          they know contacts will land alongside the brand records. */}
      <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
        <span className="text-2xl">📇</span>
        <div className="flex-1 text-sm">
          <p className="font-bold text-emerald-900">
            Auto-enrichment is on
          </p>
          <p className="text-emerald-800 mt-0.5">
            Every new brand created here gets up to 8 senior contacts (founder / C-suite / VP / head / director) attached via Apollo people-search by domain. The BD Wizard's <code className="bg-white px-1 rounded">contacts:&#123;some:&#123;&#125;&#125;</code> filter lets these brands through immediately — no separate enrichment pass needed.
          </p>
        </div>
      </div>

      {/* Bulk-enrich for the existing backlog of empty brands. Auto-fetch
          shows the current "still empty" count; if zero, the button is
          disabled and labelled "All enriched". */}
      <div className="mb-6">
        <BulkEnrichButton variant="banner" />
      </div>

      {/* Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <h2 className="font-bold text-slate-900 mb-4">Discovery Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              disabled={running}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Region</label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              disabled={running}
            >
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Target Count</label>
            <input
              type="number"
              value={count}
              onChange={e => setCount(parseInt(e.target.value) || 20)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              min={5}
              max={50}
              disabled={running}
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={runDiscovery}
              disabled={running}
              className="px-4 py-2 bg-[#00b4c3] text-white rounded-lg font-semibold text-sm hover:bg-[#009aa8] disabled:opacity-50 whitespace-nowrap"
            >
              {running ? "🔍 Discovering..." : "🚀 Run Discovery"}
            </button>
            <button
              onClick={runAllCategories}
              disabled={running}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg font-semibold text-sm hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap"
            >
              {running ? "Running..." : "🌍 All Categories"}
            </button>
          </div>
        </div>

        {running && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            ⏳ Running multi-AI discovery across Anthropic + OpenAI + Grok... This takes 30-60 seconds per category.
          </div>
        )}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            ❌ {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">Discovery Results — {result.summary.category}</h2>
            <div className="flex gap-3 text-sm flex-wrap">
              <span className="px-2 py-1 bg-slate-100 rounded">AI Sources: {result.summary.aiSourcesUsed.join(", ")}</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">Found: {result.summary.totalDiscovered}</span>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">After Dedup: {result.summary.afterDedup}</span>
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Created: {result.summary.created}</span>
              {/* Total auto-enriched contacts across all created brands */}
              <span className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded">
                📇 Contacts attached:{" "}
                {(result.brands || []).reduce(
                  (s: number, b: any) => s + (b.enrichedContactCount || 0),
                  0,
                )}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="pb-2 font-semibold text-slate-600">Brand</th>
                  <th className="pb-2 font-semibold text-slate-600">Segment</th>
                  <th className="pb-2 font-semibold text-slate-600">Priority</th>
                  <th className="pb-2 font-semibold text-slate-600">Validation</th>
                  <th className="pb-2 font-semibold text-slate-600">Contacts</th>
                  <th className="pb-2 font-semibold text-slate-600">AI Sources</th>
                  <th className="pb-2 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.brands.map(brand => (
                  <tr key={brand.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3">
                      <div className="font-semibold text-slate-900">{brand.name}</div>
                      {brand.website && (
                        <a href={brand.website} target="_blank" rel="noopener" className="text-xs text-[#00b4c3] hover:underline">
                          {brand.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </a>
                      )}
                    </td>
                    <td className="py-3 text-slate-600">{brand.segment}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${tierColor[brand.priorityTier || "C"] || tierColor.C}`}>
                        Tier {brand.priorityTier || "C"}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`text-xs font-bold ${brand.validationCount >= 3 ? "text-emerald-600" : brand.validationCount >= 2 ? "text-blue-600" : "text-amber-600"}`}>
                        {brand.validationCount} AI{brand.validationCount > 1 ? "s" : ""} confirmed
                      </span>
                    </td>
                    <td className="py-3 text-xs">
                      {(brand.enrichedContactCount ?? 0) > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 font-bold">
                          📇 {brand.enrichedContactCount}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 text-xs text-slate-500">{brand.sources?.join(", ")}</td>
                    <td className="py-3">
                      <Link
                        href={`/brands/${brand.id}`}
                        className="px-3 py-1 bg-[#00b4c3] text-white rounded text-xs font-semibold hover:bg-[#009aa8]"
                      >
                        View & Research
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-bold text-slate-900 mb-4">Discovery History (This Session)</h2>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                <span className="font-medium">{h.summary.category} — {h.summary.region}</span>
                <div className="flex gap-3">
                  <span>Found: {h.summary.totalDiscovered}</span>
                  <span className="text-emerald-600 font-bold">Created: {h.summary.created}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
