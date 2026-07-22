"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/AuthContext";
import AddCompanyModal from "@/components/AddCompanyModal";
import { CAPABILITY_GROUPS, parseCapabilities } from "@/lib/factory-capabilities";

export default function FactoriesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  // Item 11 — brand viewers get a slim, non-competitive column set (no
  // Brands / Fabrics / Submissions counts, which expose other customers'
  // activity). Internal roles keep the full table.
  const isBrandViewer = user?.role === "BRAND_USER";
  const [factories, setFactories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [byCountry, setByCountry] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  // Capability facets — a factory must have ALL selected capabilities.
  const [capFilters, setCapFilters] = useState<string[]>([]);
  const [showFacets, setShowFacets] = useState(false);
  const toggleCap = (id: string) =>
    setCapFilters((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  useEffect(() => {
    fetch("/api/factories")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setFactories(j.factories);
          setTotal(j.total);
          setByCountry(j.byCountry || {});
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        {t.factories.loadingFactories}
      </div>
    );

  const q = search.toLowerCase();
  const filtered = factories.filter((f) => {
    const matchesText =
      !q ||
      f.name.toLowerCase().includes(q) ||
      (f.country && f.country.toLowerCase().includes(q)) ||
      (f.specialty && f.specialty.toLowerCase().includes(q));
    if (!matchesText) return false;
    if (capFilters.length === 0) return true;
    const caps = parseCapabilities(f.capabilities);
    return capFilters.every((id) => caps.includes(id));
  });
  const topCountries = Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{t.factories.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{`${total.toLocaleString()} ${t.factories.factoriesAcrossCountries.replace("{count}", String(Object.keys(byCountry).length))}`}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder={t.factories.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => router.push("/factory-search")}
            className="px-4 py-2 border border-[#00b4c3] text-[#00b4c3] rounded-lg text-sm font-bold hover:bg-[#00b4c3] hover:text-white whitespace-nowrap transition-colors"
          >
            Discovery View
          </button>
          <button
            onClick={() => setAddCompanyOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 whitespace-nowrap"
            title="Add brand, factory, lab, or distributor"
          >
            + Add Company
          </button>
          <button
            onClick={() => router.push("/factories/new")}
            className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 whitespace-nowrap"
          >
            {t.factories.addNew}
          </button>
        </div>
      </div>

      <AddCompanyModal
        open={addCompanyOpen}
        onClose={() => setAddCompanyOpen(false)}
        initialType="FACTORY"
      />

      {/* Country distribution — click to filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {topCountries.map(([country, count]) => {
          const isActive = search.toLowerCase() === country.toLowerCase();
          return (
            <button
              key={country}
              onClick={() => setSearch(isActive ? "" : country)}
              className={`rounded-lg px-3 py-2 shadow-sm border text-center min-w-[100px] transition-all cursor-pointer ${
                isActive
                  ? "bg-[#00b4c3] border-[#00b4c3] ring-2 ring-[#00b4c3]/30"
                  : "bg-white hover:border-[#00b4c3] hover:shadow-md"
              }`}
            >
              <div className={`text-lg font-black ${isActive ? "text-white" : "text-slate-900"}`}>
                {count}
              </div>
              <div
                className={`text-[11px] truncate ${isActive ? "text-white/80" : "text-slate-500"}`}
              >
                {country}
              </div>
            </button>
          );
        })}
      </div>

      {/* Capability facets */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => setShowFacets((v) => !v)}
            className="text-sm font-semibold text-slate-700 hover:text-[#00b4c3] flex items-center gap-1.5"
          >
            <span>{showFacets ? "▾" : "▸"}</span>
            {t.factories.filterByCapability}
            {capFilters.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-[#00b4c3] text-white text-xs font-bold">
                {capFilters.length}
              </span>
            )}
          </button>
          {capFilters.length > 0 && (
            <button onClick={() => setCapFilters([])} className="text-xs text-slate-500 hover:text-red-500">
              {t.factories.clearFilters}
            </button>
          )}
        </div>
        {showFacets && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CAPABILITY_GROUPS.map((g) => (
              <div key={g.key}>
                <div className="text-xs font-bold text-slate-700 mb-2">{g.icon} {g.label}</div>
                <div className="space-y-1">
                  {g.options.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={capFilters.includes(o.id)}
                        onChange={() => toggleCap(o.id)}
                        className="rounded text-[#00b4c3] focus:ring-[#00b4c3]"
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            {isBrandViewer ? (
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">{t.factories.factoryName}</th>
                <th className="px-4 py-3">{t.factories.country}</th>
                <th className="px-4 py-3">{t.factories.specialty}</th>
                <th className="px-4 py-3">{t.factories.millType}</th>
              </tr>
            ) : (
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">{t.factories.factoryName}</th>
                <th className="px-4 py-3">{t.factories.millType}</th>
                <th className="px-4 py-3">{t.factories.specialty}</th>
                <th className="px-4 py-3">{t.factories.country}</th>
                <th className="px-4 py-3 text-center">{t.factories.brands}</th>
                <th className="px-4 py-3 text-center">{t.factories.fabrics}</th>
                <th className="px-4 py-3 text-center">{t.dashboard.submissions}</th>
              </tr>
            )}
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr
                key={f.id}
                onClick={() => router.push(`/factories/${f.id}`)}
                className="border-t border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-900">{f.name}</div>
                  {f.chineseName && <div className="text-xs text-slate-400">{f.chineseName}</div>}
                </td>
                {isBrandViewer ? (
                  <>
                    <td className="px-4 py-3 text-slate-600">{f.country || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{f.specialty || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{f.millType || "—"}</td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-slate-600">{f.millType || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{f.specialty || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{f.country || "—"}</td>
                    <td className="px-4 py-3 text-center font-bold">{f.brandCount || 0}</td>
                    <td className="px-4 py-3 text-center font-bold">{f.fabricCount || 0}</td>
                    <td className="px-4 py-3 text-center font-bold">{f.submissionCount || 0}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">{t.factories.noFactories}</div>
        )}
      </div>
    </div>
  );
}
