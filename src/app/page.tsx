"use client";

import React, { useEffect, useMemo, useState } from "react";

type FabricRow = {
  id: string;
  construction: string | null;
  color: string | null;
  widthInches: number | null;
  weightGsm: number | null;
  updatedAt: string;
  contents: { material: string; percent: number | null; rawText: string | null }[];
  submission: null | {
    fuzeFabricNumber: number | null;
    customerFabricCode: string | null;
    factoryFabricCode: string | null;
    applicationMethod: string | null;
    treatmentLocation: string | null;
    applicationDate: string | null;
  };
};

type ApiResp = {
  ok: boolean;
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  rows: FabricRow[];
  error?: string;
};

function fmtPct(n: number | null) {
  if (n === null || n === undefined) return "";
  // treat "80" as 80%, "0.8" as 0.8%
  return `${Number(n).toString()}%`;
}

function fmtNum(n: number | null) {
  if (n === null || n === undefined) return "";
  return Number(n).toString();
}

export default function HomePage() {
  const [q, setQ] = useState("");
  const [construction, setConstruction] = useState("");
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [minPct, setMinPct] = useState("");
  const [maxPct, setMaxPct] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (construction.trim()) sp.set("construction", construction.trim());
    if (color.trim()) sp.set("color", color.trim());
    if (material.trim()) sp.set("material", material.trim());
    if (minPct.trim()) sp.set("minPct", minPct.trim());
    if (maxPct.trim()) sp.set("maxPct", maxPct.trim());
    sp.set("page", String(page));
    sp.set("pageSize", String(pageSize));
    return sp.toString();
  }, [q, construction, color, material, minPct, maxPct, page, pageSize]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/fabrics?${queryString}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResp;
      if (!json.ok) throw new Error(json.error || "API error");
      setData(json);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload on query change (but not on every keystroke chaos: we keep it simple with a button)
  function onSearch() {
    setPage(1);
    // load with page=1 next tick
    setTimeout(() => load(), 0);
  }

  function onClear() {
    setQ("");
    setConstruction("");
    setColor("");
    setMaterial("");
    setMinPct("");
    setMaxPct("");
    setPage(1);
    setTimeout(() => load(), 0);
  }

  function goPrev() {
    if (!data) return;
    if (data.page <= 1) return;
    setPage((p) => p - 1);
    setTimeout(() => load(), 0);
  }

  function goNext() {
    if (!data) return;
    if (data.page >= data.pages) return;
    setPage((p) => p + 1);
    setTimeout(() => load(), 0);
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>FUZE Atlas</h1>
      <div style={{ opacity: 0.75, marginBottom: 18 }}>
        Search fabrics by construction, color, materials, and submission codes.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr 0.7fr 0.7fr",
          gap: 10,
          padding: 14,
          border: "1px solid #e5e5e5",
          borderRadius: 14,
          marginBottom: 14,
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search anything: construction, color, polyester, code…"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <input
          value={construction}
          onChange={(e) => setConstruction(e.target.value)}
          placeholder="Construction"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <input
          value={color}
          onChange={(e) => setColor(e.target.value)}
          placeholder="Color"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <input
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          placeholder="Material (e.g. Polyester)"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <input
          value={minPct}
          onChange={(e) => setMinPct(e.target.value)}
          placeholder="Min %"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <input
          value={maxPct}
          onChange={(e) => setMaxPct(e.target.value)}
          placeholder="Max %"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10 }}>
          <button
            onClick={onSearch}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Search
          </button>
          <button
            onClick={onClear}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Clear
          </button>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ fontSize: 13, opacity: 0.8 }}>Page size</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <button
              onClick={() => {
                setPage(1);
                setTimeout(() => load(), 0);
              }}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={goPrev}
          disabled={!data || data.page <= 1 || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 700,
            cursor: "pointer",
            opacity: !data || data.page <= 1 || loading ? 0.5 : 1,
          }}
        >
          Prev
        </button>
        <button
          onClick={goNext}
          disabled={!data || (data && data.page >= data.pages) || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 700,
            cursor: "pointer",
            opacity: !data || (data && data.page >= data.pages) || loading ? 0.5 : 1,
          }}
        >
          Next
        </button>

        <div style={{ opacity: 0.75 }}>
          {loading ? "Loading…" : err ? `Error: ${err}` : data ? `Total ${data.total} • Page ${data.page}/${data.pages}` : ""}
        </div>

        <div style={{ marginLeft: "auto", opacity: 0.65, fontSize: 12 }}>
          Tip: Use “polyamide” or “nylon” — content normalization should catch both.
        </div>
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.6fr 2.4fr 1.6fr",
            gap: 0,
            background: "#fafafa",
            borderBottom: "1px solid #e5e5e5",
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          {["FUZE # / Codes", "Construction", "Color", "GSM", "Contents", "Process"].map((h) => (
            <div key={h} style={{ padding: 12 }}>
              {h}
            </div>
          ))}
        </div>

        {data?.rows?.length ? (
          data.rows.map((r) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.6fr 2.4fr 1.6fr",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              <div style={{ padding: 12, fontSize: 13 }}>
                <div style={{ fontWeight: 800 }}>
                  {r.submission?.fuzeFabricNumber !== null && r.submission?.fuzeFabricNumber !== undefined
                    ? `FUZE ${r.submission.fuzeFabricNumber}`
                    : "—"}
                </div>
                <div style={{ opacity: 0.8 }}>
                  {r.submission?.customerFabricCode ? `Cust: ${r.submission.customerFabricCode}` : ""}
                  {r.submission?.customerFabricCode && r.submission?.factoryFabricCode ? " • " : ""}
                  {r.submission?.factoryFabricCode ? `Factory: ${r.submission.factoryFabricCode}` : ""}
                </div>
              </div>

              <div style={{ padding: 12, fontSize: 13 }}>{r.construction || "—"}</div>
              <div style={{ padding: 12, fontSize: 13 }}>{r.color || "—"}</div>
              <div style={{ padding: 12, fontSize: 13 }}>{fmtNum(r.weightGsm) || "—"}</div>

              <div style={{ padding: 12, fontSize: 13 }}>
                {r.contents?.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {r.contents.slice(0, 6).map((c, idx) => (
                      <span
                        key={idx}
                        style={{
                          border: "1px solid #ddd",
                          borderRadius: 999,
                          padding: "6px 10px",
                          fontSize: 12,
                          background: "white",
                        }}
                      >
                        {c.material}
                        {c.percent !== null && c.percent !== undefined ? ` ${fmtPct(c.percent)}` : ""}
                      </span>
                    ))}
                    {r.contents.length > 6 ? <span style={{ opacity: 0.7 }}>…</span> : null}
                  </div>
                ) : (
                  "—"
                )}
              </div>

              <div style={{ padding: 12, fontSize: 13 }}>
                <div style={{ fontWeight: 700 }}>{r.submission?.applicationMethod || "—"}</div>
                <div style={{ opacity: 0.8 }}>
                  {r.submission?.treatmentLocation || ""}
                  {r.submission?.treatmentLocation && r.submission?.applicationDate ? " • " : ""}
                  {r.submission?.applicationDate ? new Date(r.submission.applicationDate).toLocaleDateString() : ""}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: 16, opacity: 0.7 }}>
            {loading ? "Loading…" : "No results. Try clearing filters or searching ‘polyester’."}
          </div>
        )}
      </div>
    </div>
  );
}