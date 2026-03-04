"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import {
  ALL_TAG_CATEGORIES,
  PRODUCT_TYPES,
  CAPABILITIES,
  CERTIFICATIONS,
  FABRIC_TYPES,
  FUZE_APPLICATIONS,
  parseTags,
  getTagLabel,
  filterFactories,
  calcProfileCompleteness,
  type FactorySearchFilters,
} from "@/lib/factoryDiscovery";

// ── Tag Pill ──
function TagPill({ label, color = "blue" }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${colors[color] || colors.blue}`}>
      {label}
    </span>
  );
}

// ── Filter Section ──
function FilterSection({
  category,
  selected,
  onToggle,
  color = "blue",
}: {
  category: typeof PRODUCT_TYPES;
  selected: string[];
  onToggle: (val: string) => void;
  color?: string;
}) {
  const [expanded, setExpanded] = useState(selected.length > 0);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>{category.icon}</span>
          <span className="text-sm font-semibold text-slate-700">{category.label}</span>
          {selected.length > 0 && (
            <span className="bg-[#00b4c3] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {selected.length}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {category.tags.map((tag) => {
            const active = selected.includes(tag.value);
            return (
              <button
                key={tag.value}
                onClick={() => onToggle(tag.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  active
                    ? "bg-[#00b4c3] text-white border-[#00b4c3] shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-[#00b4c3] hover:text-[#00b4c3]"
                }`}
              >
                {active && "✓ "}{tag.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Factory Card ──
function FactoryCard({ factory, onClick }: { factory: any; onClick: () => void }) {
  const products = parseTags(factory.productTypes);
  const caps = parseTags(factory.capabilities);
  const certs = parseTags(factory.certifications);
  const fabrics = parseTags(factory.fabricTypes);
  const fuze = parseTags(factory.fuzeApplications);
  const completeness = calcProfileCompleteness(factory);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 hover:border-[#00b4c3] hover:shadow-lg transition-all cursor-pointer overflow-hidden group"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-900 group-hover:text-[#00b4c3] transition-colors truncate">
              {factory.name}
            </h3>
            {factory.chineseName && (
              <p className="text-xs text-slate-400 truncate">{factory.chineseName}</p>
            )}
          </div>
          {factory.fuzeEnabled && (
            <span className="ml-2 px-2 py-0.5 bg-[#00b4c3] text-white text-[10px] font-bold rounded-full whitespace-nowrap">
              FUZE Ready
            </span>
          )}
        </div>

        {/* Location & Mill Type */}
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
          {factory.country && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {factory.city ? `${factory.city}, ${factory.country}` : factory.country}
            </span>
          )}
          {factory.millType && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              {factory.millType}
            </span>
          )}
        </div>

        {/* Description */}
        {factory.description && (
          <p className="text-xs text-slate-500 mt-2 line-clamp-2">{factory.description}</p>
        )}
      </div>

      {/* Tags */}
      <div className="px-5 pb-3 space-y-1.5">
        {products.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {products.slice(0, 4).map((p) => (
              <TagPill key={p} label={getTagLabel("productTypes", p)} color="blue" />
            ))}
            {products.length > 4 && (
              <span className="text-[10px] text-slate-400 self-center">+{products.length - 4} more</span>
            )}
          </div>
        )}
        {fabrics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {fabrics.slice(0, 4).map((f) => (
              <TagPill key={f} label={getTagLabel("fabricTypes", f)} color="purple" />
            ))}
            {fabrics.length > 4 && (
              <span className="text-[10px] text-slate-400 self-center">+{fabrics.length - 4} more</span>
            )}
          </div>
        )}
        {certs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {certs.slice(0, 3).map((c) => (
              <TagPill key={c} label={getTagLabel("certifications", c)} color="green" />
            ))}
            {certs.length > 3 && (
              <span className="text-[10px] text-slate-400 self-center">+{certs.length - 3} more</span>
            )}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="bg-slate-50 px-5 py-3 flex items-center justify-between text-xs border-t border-slate-100">
        <div className="flex items-center gap-4 text-slate-500">
          {factory.moqMeters && <span>MOQ: {factory.moqMeters.toLocaleString()}m</span>}
          {factory.leadTimeDays && <span>Lead: {factory.leadTimeDays}d</span>}
          {factory.brandCount > 0 && <span>{factory.brandCount} brand{factory.brandCount !== 1 ? "s" : ""}</span>}
          {factory.fabricCount > 0 && <span>{factory.fabricCount} fabric{factory.fabricCount !== 1 ? "s" : ""}</span>}
        </div>
        {fuze.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#00b4c3] font-medium">FUZE:</span>
            {fuze.slice(0, 2).map((f) => (
              <TagPill key={f} label={getTagLabel("fuzeApplications", f)} color="cyan" />
            ))}
          </div>
        )}
      </div>

      {/* Profile completeness bar */}
      {completeness < 100 && (
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-[#00b4c3] transition-all"
            style={{ width: `${completeness}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════
export default function FactorySearchPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [factories, setFactories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(true);

  // Filters
  const [filters, setFilters] = useState<FactorySearchFilters>({
    query: "",
    productTypes: [],
    capabilities: [],
    certifications: [],
    fabricTypes: [],
    fuzeApplications: [],
  });

  useEffect(() => {
    fetch("/api/factories")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setFactories(j.factories);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleTag = (category: string, value: string) => {
    setFilters((prev) => {
      const key = category as keyof FactorySearchFilters;
      const current = (prev[key] as string[]) || [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const clearFilters = () => {
    setFilters({
      query: "",
      productTypes: [],
      capabilities: [],
      certifications: [],
      fabricTypes: [],
      fuzeApplications: [],
    });
  };

  const activeFilterCount = [
    ...(filters.productTypes || []),
    ...(filters.capabilities || []),
    ...(filters.certifications || []),
    ...(filters.fabricTypes || []),
    ...(filters.fuzeApplications || []),
  ].length + (filters.country ? 1 : 0) + (filters.millType ? 1 : 0) + (filters.fuzeEnabled ? 1 : 0);

  const filtered = useMemo(() => filterFactories(factories, filters), [factories, filters]);

  // Get unique countries and mill types for dropdown filters
  const countries = useMemo(() => {
    const set = new Set(factories.map((f) => f.country).filter(Boolean));
    return Array.from(set).sort();
  }, [factories]);

  const millTypes = useMemo(() => {
    const set = new Set(factories.map((f) => f.millType).filter(Boolean));
    return Array.from(set).sort();
  }, [factories]);

  // Stats
  const fuzeReadyCount = factories.filter((f) => f.fuzeEnabled).length;
  const profiledCount = factories.filter((f) => calcProfileCompleteness(f) >= 50).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Loading factory directory...
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Hero Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Factory Discovery</h1>
            <p className="text-sm text-slate-500 mt-1">
              Search {factories.length} factories by product type, capability, certification, and more
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("grid")}
              className={`p-2 rounded-lg transition-colors ${view === "grid" ? "bg-slate-200 text-slate-900" : "text-slate-400 hover:bg-slate-100"}`}
              title="Grid view"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-2 rounded-lg transition-colors ${view === "list" ? "bg-slate-200 text-slate-900" : "text-slate-400 hover:bg-slate-100"}`}
              title="List view"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-3 mt-4">
          <div className="bg-white rounded-lg px-4 py-2.5 shadow-sm border text-center">
            <div className="text-lg font-black text-slate-900">{factories.length}</div>
            <div className="text-[11px] text-slate-500">Total Factories</div>
          </div>
          <div className="bg-white rounded-lg px-4 py-2.5 shadow-sm border text-center">
            <div className="text-lg font-black text-slate-900">{countries.length}</div>
            <div className="text-[11px] text-slate-500">Countries</div>
          </div>
          <div className="bg-white rounded-lg px-4 py-2.5 shadow-sm border text-center">
            <div className="text-lg font-black text-[#00b4c3]">{fuzeReadyCount}</div>
            <div className="text-[11px] text-slate-500">FUZE Ready</div>
          </div>
          <div className="bg-white rounded-lg px-4 py-2.5 shadow-sm border text-center">
            <div className="text-lg font-black text-slate-900">{profiledCount}</div>
            <div className="text-[11px] text-slate-500">Profiled</div>
          </div>
          <div className="bg-white rounded-lg px-4 py-2.5 shadow-sm border text-center">
            <div className="text-lg font-black text-emerald-600">{filtered.length}</div>
            <div className="text-[11px] text-slate-500">Matching</div>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* ── LEFT SIDEBAR: Filters ── */}
        {showFilters && (
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border sticky top-4">
              {/* Search */}
              <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                <div className="relative">
                  <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search factories..."
                    value={filters.query || ""}
                    onChange={(e) => setFilters((p) => ({ ...p, query: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Country & Mill Type Dropdowns */}
              <div className="px-4 py-3 border-b border-slate-100 space-y-2">
                <select
                  value={filters.country || ""}
                  onChange={(e) => setFilters((p) => ({ ...p, country: e.target.value || undefined }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                >
                  <option value="">All Countries</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={filters.millType || ""}
                  onChange={(e) => setFilters((p) => ({ ...p, millType: e.target.value || undefined }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                >
                  <option value="">All Mill Types</option>
                  {millTypes.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 px-1 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.fuzeEnabled || false}
                    onChange={(e) => setFilters((p) => ({ ...p, fuzeEnabled: e.target.checked || undefined }))}
                    className="rounded border-slate-300 text-[#00b4c3] focus:ring-[#00b4c3]"
                  />
                  <span className="text-sm text-slate-700">FUZE Ready Only</span>
                </label>
              </div>

              {/* Tag Filters */}
              <FilterSection
                category={PRODUCT_TYPES}
                selected={filters.productTypes || []}
                onToggle={(v) => toggleTag("productTypes", v)}
                color="blue"
              />
              <FilterSection
                category={FABRIC_TYPES}
                selected={filters.fabricTypes || []}
                onToggle={(v) => toggleTag("fabricTypes", v)}
                color="purple"
              />
              <FilterSection
                category={CAPABILITIES}
                selected={filters.capabilities || []}
                onToggle={(v) => toggleTag("capabilities", v)}
                color="amber"
              />
              <FilterSection
                category={CERTIFICATIONS}
                selected={filters.certifications || []}
                onToggle={(v) => toggleTag("certifications", v)}
                color="green"
              />
              <FilterSection
                category={FUZE_APPLICATIONS}
                selected={filters.fuzeApplications || []}
                onToggle={(v) => toggleTag("fuzeApplications", v)}
                color="cyan"
              />

              {/* Clear */}
              {activeFilterCount > 0 && (
                <div className="px-4 py-3 border-t border-slate-100">
                  <button
                    onClick={clearFilters}
                    className="w-full text-center text-sm text-red-500 hover:text-red-700 font-medium"
                  >
                    Clear All Filters ({activeFilterCount})
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 min-w-0">
          {/* Toggle filter sidebar on mobile */}
          <div className="lg:hidden mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
            </button>
          </div>

          {/* Active filter pills */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {filters.country && (
                <button
                  onClick={() => setFilters((p) => ({ ...p, country: undefined }))}
                  className="flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  {filters.country} <span className="text-slate-400">×</span>
                </button>
              )}
              {filters.millType && (
                <button
                  onClick={() => setFilters((p) => ({ ...p, millType: undefined }))}
                  className="flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  {filters.millType} <span className="text-slate-400">×</span>
                </button>
              )}
              {ALL_TAG_CATEGORIES.map((cat) => {
                const selected = (filters[cat.key as keyof FactorySearchFilters] as string[]) || [];
                return selected.map((val) => (
                  <button
                    key={`${cat.key}-${val}`}
                    onClick={() => toggleTag(cat.key, val)}
                    className="flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    {getTagLabel(cat.key, val)} <span className="text-slate-400">×</span>
                  </button>
                ));
              })}
            </div>
          )}

          {/* Results */}
          {view === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((f) => (
                <FactoryCard
                  key={f.id}
                  factory={f}
                  onClick={() => router.push(`/factories/${f.id}`)}
                />
              ))}
            </div>
          ) : (
            /* List view */
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Factory</th>
                    <th className="px-4 py-3">Type / Specialty</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Products</th>
                    <th className="px-4 py-3">Certifications</th>
                    <th className="px-4 py-3 text-center">MOQ</th>
                    <th className="px-4 py-3 text-center">Lead Time</th>
                    <th className="px-4 py-3 text-center">FUZE</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => {
                    const products = parseTags(f.productTypes);
                    const certs = parseTags(f.certifications);
                    return (
                      <tr
                        key={f.id}
                        onClick={() => router.push(`/factories/${f.id}`)}
                        className="border-t border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{f.name}</div>
                          {f.chineseName && <div className="text-[11px] text-slate-400">{f.chineseName}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-700">{f.millType || "—"}</div>
                          {f.specialty && <div className="text-[11px] text-slate-400">{f.specialty}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {f.city ? `${f.city}, ${f.country}` : f.country || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {products.slice(0, 3).map((p) => (
                              <TagPill key={p} label={getTagLabel("productTypes", p)} color="blue" />
                            ))}
                            {products.length > 3 && <span className="text-[10px] text-slate-400 self-center">+{products.length - 3}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {certs.slice(0, 2).map((c) => (
                              <TagPill key={c} label={getTagLabel("certifications", c)} color="green" />
                            ))}
                            {certs.length > 2 && <span className="text-[10px] text-slate-400 self-center">+{certs.length - 2}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {f.moqMeters ? `${f.moqMeters.toLocaleString()}m` : "—"}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {f.leadTimeDays ? `${f.leadTimeDays}d` : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {f.fuzeEnabled ? (
                            <span className="text-[#00b4c3] font-bold">✓</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  No factories match your filters
                </div>
              )}
            </div>
          )}

          {/* No results */}
          {filtered.length === 0 && view === "grid" && (
            <div className="text-center py-20">
              <div className="text-5xl mb-3">🏭</div>
              <h3 className="text-lg font-bold text-slate-700">No factories match your filters</h3>
              <p className="text-sm text-slate-500 mt-1">
                Try removing some filters or broadening your search
              </p>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009aa8] transition-colors"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
