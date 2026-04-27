// @ts-nocheck
"use client";

/**
 * /recipe-search
 *
 * Network-wide FUZE recipe library, searchable by every Atlas user.
 * Out-of-scope rows are anonymized but the underlying recipe (pickup,
 * padder settings, ICP outcome, tier) stays visible — that's the
 * value Andrew called out: "factories that they can quickly match
 * something that they are working on, even if it is not their fabric
 * or current fabric."
 *
 * Filters: keyword, fabric category, fiber, GSM range, tier, factory.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

interface Result {
  inScope: boolean;
  fabricId: string | null;
  fuzeNumber: number | null;
  customerReference: string | null;
  customerCode: string | null;
  factoryCode: string | null;
  fabricCategory: string | null;
  weightGsm: number | null;
  color: string | null;
  fiberSummary: string | null;
  brand: { id: string; name: string } | null;
  factory: { id: string; name: string } | null;
  recipe: {
    testNumber: string | null;
    testDate: string | null;
    applicationMethod: string;
    squeezePressure: number | null;
    vfdFrequencyHz: number | null;
    lineSpeedMPerMin: number | null;
    stockMgPerL: number;
    pickupDryToWetPct: number | null;
    testedAtTier: string | null;
    f1BathMgPerL: number | null;
    f2BathMgPerL: number | null;
    f3BathMgPerL: number | null;
    f4BathMgPerL: number | null;
    icpExpectedPpm: number | null;
    icpMeasuredPpm: number | null;
    affinityPct: number | null;
    qcPassed: boolean;
  } | null;
}

const FUZE_CYAN = "#00b4c3";

export default function RecipeSearchPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<any>(null);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [fiber, setFiber] = useState("");
  const [gsmMin, setGsmMin] = useState("");
  const [gsmMax, setGsmMax] = useState("");
  const [tier, setTier] = useState("");
  const [onlyValidated, setOnlyValidated] = useState(true);

  async function search() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      if (fiber) params.set("fiber", fiber);
      if (gsmMin) params.set("gsmMin", gsmMin);
      if (gsmMax) params.set("gsmMax", gsmMax);
      if (tier) params.set("tier", tier);
      if (onlyValidated) params.set("onlyValidated", "1");
      const res = await fetch(`/api/recipe-search?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setResults(json.results);
        setScope(json.scope);
      }
    } finally {
      setLoading(false);
    }
  }

  // Run an empty search on first load so the page isn't blank.
  useEffect(() => {
    if (user) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900">Recipe Search</h1>
        <p className="text-slate-600 mt-1">
          Network-wide FUZE recipe library. Search across every validated
          fabric in Atlas — match what you're working on to a proven
          recipe, even when the fabric isn't yours. Out-of-scope rows
          are anonymized but the recipe physics are visible.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Keyword (cotton, jersey, twill...)"
          className="lg:col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="">Any category</option>
          <option value="knit">Knit</option>
          <option value="woven">Woven</option>
          <option value="nonwoven">Nonwoven</option>
        </select>
        <input
          type="text"
          value={fiber}
          onChange={(e) => setFiber(e.target.value)}
          placeholder="Fiber (cotton, poly...)"
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={gsmMin}
            onChange={(e) => setGsmMin(e.target.value)}
            placeholder="GSM min"
            className="w-1/2 px-2 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <input
            type="number"
            value={gsmMax}
            onChange={(e) => setGsmMax(e.target.value)}
            placeholder="GSM max"
            className="w-1/2 px-2 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="">Any tier</option>
          <option value="F1">F1 (1.0 mg/kg)</option>
          <option value="F2">F2 (0.75)</option>
          <option value="F3">F3 (0.5)</option>
          <option value="F4">F4 (0.25)</option>
        </select>

        <label className="flex items-center gap-2 text-xs text-slate-600 lg:col-span-3">
          <input
            type="checkbox"
            checked={onlyValidated}
            onChange={(e) => setOnlyValidated(e.target.checked)}
          />
          Only show fabrics with measured pickup (validated bench test)
        </label>

        <button
          onClick={search}
          className="lg:col-span-3 px-4 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009ba8]"
          disabled={loading}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {scope && (
        <p className="text-xs text-slate-500 mb-3">
          Showing <strong>{results.length}</strong> result
          {results.length === 1 ? "" : "s"}.{" "}
          {scope.canSeeAll
            ? "Full attribution (internal user)."
            : `${results.filter((r) => r.inScope).length} attributed to you, ${
                results.filter((r) => !r.inScope).length
              } anonymized network match${
                results.filter((r) => !r.inScope).length === 1 ? "" : "es"
              }.`}
        </p>
      )}

      {results.length === 0 && !loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <span className="text-4xl mb-3 block">🔍</span>
          <p className="text-slate-600 font-semibold mb-1">
            No matching recipes yet.
          </p>
          <p className="text-slate-500 text-sm">
            Try widening the filters — or remove the "validated bench
            test" filter if you want to see fabrics that are still
            mid-development.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((r, i) => (
            <RecipeCard key={i} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeCard({ r }: { r: Result }) {
  const recipe = r.recipe;
  if (!recipe) return null;
  const pickupStr =
    recipe.pickupDryToWetPct != null
      ? `${recipe.pickupDryToWetPct.toFixed(1)}%`
      : "—";
  const f1Str = recipe.f1BathMgPerL
    ? `${recipe.f1BathMgPerL.toFixed(2)} ppm`
    : "—";

  return (
    <div
      className={`bg-white border rounded-xl p-4 ${
        r.inScope
          ? "border-[#00b4c3]/30"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-2 flex-wrap">
            {r.inScope ? (
              <Link
                href={`/fabrics/${r.fabricId}`}
                className="text-base font-black text-slate-900 hover:underline"
              >
                {r.customerReference ||
                  r.customerCode ||
                  `FUZE-${r.fuzeNumber}`}
              </Link>
            ) : (
              <span className="text-base font-bold text-slate-700">
                Anonymous match
              </span>
            )}
            {r.inScope && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">
                Yours
              </span>
            )}
            {!r.inScope && (
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                Network match
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {r.fabricCategory && (
              <span className="capitalize">{r.fabricCategory}</span>
            )}
            {r.fiberSummary && <> · {r.fiberSummary}</>}
            {r.weightGsm && <> · {r.weightGsm} g/m²</>}
            {r.inScope && r.brand?.name && (
              <>
                {" "}
                ·{" "}
                <span className="font-semibold text-slate-700">
                  {r.brand.name}
                </span>
              </>
            )}
            {r.inScope && r.factory?.name && (
              <> · {r.factory.name}</>
            )}
          </p>
        </div>
        <div className="text-right text-xs">
          <p
            className="font-bold text-base"
            style={{ color: FUZE_CYAN }}
          >
            {recipe.testedAtTier || "F1"}
          </p>
          <p className="text-slate-500">pickup {pickupStr}</p>
          {recipe.icpMeasuredPpm != null && (
            <p className="text-slate-500">
              ICP {recipe.icpMeasuredPpm.toFixed(2)} ppm
              {recipe.affinityPct != null && (
                <> · {recipe.affinityPct.toFixed(0)}% affinity</>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
        <div>
          <p className="text-slate-500 uppercase font-bold text-[10px]">
            Method
          </p>
          <p className="font-semibold">{recipe.applicationMethod || "—"}</p>
        </div>
        <div>
          <p className="text-slate-500 uppercase font-bold text-[10px]">
            Squeeze
          </p>
          <p className="font-semibold">
            {recipe.squeezePressure != null
              ? `${recipe.squeezePressure} bar`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-slate-500 uppercase font-bold text-[10px]">
            VFD
          </p>
          <p className="font-semibold">
            {recipe.vfdFrequencyHz != null
              ? `${recipe.vfdFrequencyHz} Hz`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-slate-500 uppercase font-bold text-[10px]">
            Line speed
          </p>
          <p className="font-semibold">
            {recipe.lineSpeedMPerMin != null
              ? `${recipe.lineSpeedMPerMin} m/min`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-slate-500 uppercase font-bold text-[10px]">
            F1 bath
          </p>
          <p className="font-semibold">{f1Str}</p>
        </div>
      </div>

      {!r.inScope && (
        <p className="text-[10px] text-slate-400 mt-2 italic">
          Customer name and item numbers are hidden because this fabric
          isn't in your scope. The recipe physics above are valid as a
          starting point for your own bench test.
        </p>
      )}
    </div>
  );
}
