"use client";

/**
 * /brand-portal/supply-chain/map — MB-2 geographic map.
 *
 * Equirectangular SVG projection (no leaflet, no new deps — keeps
 * bundle weight off the brand portal). Factories pinned at lat/lng,
 * radius scaled by lifetime FUZE consumption (sqrt scale so a 1L
 * factory and a 10kL factory are both visible). Hover for name +
 * city + liters. Click → factory detail.
 *
 * Brand-side users only see their own brand's chain because the API
 * does the SupplyChainLink scope server-side.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ErrorPanel from "@/components/ErrorPanel";

interface Pin {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
  lifetimeLiters: number;
}

interface Ungeocoded {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  lifetimeLiters: number;
}

const W = 1000;
const H = 500;
const PAD = 16;

// Equirectangular projection.
function project(lat: number, lng: number) {
  const x = PAD + ((lng + 180) / 360) * (W - 2 * PAD);
  const y = PAD + ((90 - lat) / 180) * (H - 2 * PAD);
  return { x, y };
}

const CONTINENT_LABELS: Array<{ name: string; lat: number; lng: number }> = [
  { name: "NORTH AMERICA", lat: 45, lng: -100 },
  { name: "SOUTH AMERICA", lat: -15, lng: -60 },
  { name: "EUROPE", lat: 50, lng: 15 },
  { name: "AFRICA", lat: 5, lng: 20 },
  { name: "ASIA", lat: 35, lng: 95 },
  { name: "OCEANIA", lat: -25, lng: 135 },
];

function pinRadius(liters: number, maxLiters: number): number {
  if (maxLiters <= 0) return 5;
  // sqrt scale, capped at 18 to keep dense clusters readable
  const ratio = Math.sqrt(Math.max(0, liters) / maxLiters);
  return 5 + Math.min(13, ratio * 13);
}

function fmtLiters(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k L`;
  if (n >= 1) return `${Math.round(n).toLocaleString()} L`;
  return n > 0 ? `${n.toFixed(2)} L` : "—";
}

export default function BrandSupplyChainMapPage() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [ungeocoded, setUngeocoded] = useState<Ungeocoded[]>([]);
  const [totalLifetimeLiters, setTotalLifetimeLiters] = useState(0);
  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch("/api/brand-portal/supply-chain/map");
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setLoadError(j?.error || `Couldn't load supply chain map (HTTP ${r.status}).`);
        return;
      }
      setPins(j.pins || []);
      setUngeocoded(j.ungeocoded || []);
      setTotalLifetimeLiters(j.totalLifetimeLiters || 0);
      setBrand(j.brand || null);
    } catch (e: any) {
      setLoadError(e?.message || "Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const maxLiters = useMemo(
    () => pins.reduce((m, p) => Math.max(m, p.lifetimeLiters), 0),
    [pins],
  );
  const hovered = pins.find((p) => p.id === hoverId);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/brand-portal" className="hover:text-[#00b4c3]">
            Brand Portal
          </Link>
          <span>›</span>
          <Link href="/brand-portal/supply-chain" className="hover:text-[#00b4c3]">
            Supply chain
          </Link>
          <span>›</span>
          <span>Map</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">
          {brand?.name ? `${brand.name} — supply chain map` : "Supply chain map"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Every factory linked to your brand, pinned by location. Pin size scales with
          lifetime FUZE consumption at that factory. Click a pin to drill into the
          factory.
        </p>
      </div>

      {loadError && (
        <div className="mb-4">
          <ErrorPanel context="Load supply chain map" error={loadError} onRetry={load} />
        </div>
      )}

      {loading ? (
        <div className="h-96 flex items-center justify-center text-slate-400">
          Loading map…
        </div>
      ) : pins.length === 0 && ungeocoded.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm text-slate-700 font-semibold mb-1">
            No factories linked yet
          </p>
          <p className="text-xs text-slate-500">
            Once a factory joins your supply chain its pin will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 shadow-sm overflow-hidden">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto"
              role="img"
              aria-label="World map of factories in your supply chain"
            >
              {/* Ocean background */}
              <rect x="0" y="0" width={W} height={H} fill="#dbeafe" />

              {/* Latitude / longitude reference grid */}
              {[-60, -30, 0, 30, 60].map((lat) => {
                const { y } = project(lat, 0);
                return (
                  <g key={`lat-${lat}`}>
                    <line
                      x1={PAD}
                      x2={W - PAD}
                      y1={y}
                      y2={y}
                      stroke="#bfdbfe"
                      strokeWidth={lat === 0 ? 1 : 0.5}
                      strokeDasharray={lat === 0 ? undefined : "3 5"}
                    />
                    <text x={PAD + 4} y={y - 3} fontSize={9} fill="#64748b">
                      {lat === 0 ? "Equator" : `${Math.abs(lat)}°${lat > 0 ? "N" : "S"}`}
                    </text>
                  </g>
                );
              })}
              {[-120, -60, 0, 60, 120].map((lng) => {
                const { x } = project(0, lng);
                return (
                  <g key={`lng-${lng}`}>
                    <line
                      x1={x}
                      x2={x}
                      y1={PAD}
                      y2={H - PAD}
                      stroke="#bfdbfe"
                      strokeWidth={0.5}
                      strokeDasharray="3 5"
                    />
                    <text x={x + 3} y={H - PAD - 4} fontSize={9} fill="#64748b">
                      {lng === 0 ? "0°" : `${Math.abs(lng)}°${lng > 0 ? "E" : "W"}`}
                    </text>
                  </g>
                );
              })}

              {/* Continent reference labels (helps orient the dots) */}
              {CONTINENT_LABELS.map((c) => {
                const { x, y } = project(c.lat, c.lng);
                return (
                  <text
                    key={c.name}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={700}
                    fill="#94a3b8"
                    style={{ letterSpacing: 1.5, opacity: 0.55 }}
                  >
                    {c.name}
                  </text>
                );
              })}

              {/* Brand HQ pin (if geocoded) */}
              {brand?.lat != null && brand?.lng != null && (
                (() => {
                  const { x, y } = project(brand.lat, brand.lng);
                  return (
                    <g>
                      <circle cx={x} cy={y} r={8} fill="#0f172a" stroke="white" strokeWidth={2} />
                      <text x={x + 12} y={y + 4} fontSize={11} fontWeight={700} fill="#0f172a">
                        {brand.name}
                      </text>
                    </g>
                  );
                })()
              )}

              {/* Factory pins */}
              {pins.map((p) => {
                const { x, y } = project(p.lat, p.lng);
                const r = pinRadius(p.lifetimeLiters, maxLiters);
                const isHover = hoverId === p.id;
                return (
                  <g key={p.id}>
                    <Link href={`/factories/${p.id}`} legacyBehavior>
                      <a>
                        <circle
                          cx={x}
                          cy={y}
                          r={r}
                          fill="#00b4c3"
                          fillOpacity={isHover ? 0.95 : 0.65}
                          stroke="white"
                          strokeWidth={1.5}
                          style={{ cursor: "pointer", transition: "fill-opacity 0.12s" }}
                          onMouseEnter={() => setHoverId(p.id)}
                          onMouseLeave={() =>
                            setHoverId((h) => (h === p.id ? null : h))
                          }
                        />
                      </a>
                    </Link>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Hover detail strip below the map (never overflows the SVG) */}
          {hovered && (
            <div className="mt-3 rounded-xl border border-[#00b4c3] bg-[#00b4c3]/5 p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-bold text-slate-900">{hovered.name}</p>
                  <p className="text-xs text-slate-500">
                    {[hovered.city, hovered.country].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {fmtLiters(hovered.lifetimeLiters)}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                    lifetime FUZE
                  </p>
                </div>
                <Link
                  href={`/factories/${hovered.id}`}
                  className="text-xs font-bold text-[#00b4c3] hover:underline"
                >
                  Open factory →
                </Link>
              </div>
            </div>
          )}

          {/* Summary strip */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Factories on the map
              </p>
              <p className="text-2xl font-black text-slate-900">{pins.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Awaiting geocode
              </p>
              <p className="text-2xl font-black text-amber-600">{ungeocoded.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Lifetime FUZE
              </p>
              <p className="text-2xl font-black text-emerald-700">
                {fmtLiters(totalLifetimeLiters)}
              </p>
            </div>
          </div>

          {/* Ungeocoded list */}
          {ungeocoded.length > 0 && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-900 mb-2">
                {ungeocoded.length} factor{ungeocoded.length === 1 ? "y" : "ies"} without
                lat/lng — won't render on the map until geocoded
              </p>
              <ul className="space-y-1 text-xs">
                {ungeocoded.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/factories/${u.id}`}
                      className="text-amber-900 hover:underline font-semibold"
                    >
                      {u.name}
                    </Link>
                    <span className="text-amber-700">
                      {[u.city, u.country].filter(Boolean).join(", ") || "—"} ·{" "}
                      {fmtLiters(u.lifetimeLiters)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-amber-700">
                Admin can geocode via <code>npm run seed:geocode</code> against
                Nominatim — see scripts/geocode-entities.ts.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
