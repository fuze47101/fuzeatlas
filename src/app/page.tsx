"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FabricContent = { material: string; percent: number | null };
type FabricSubmission = {
  fuzeFabricNumber: number | null;
  customerFabricCode: string | null;
  factoryFabricCode: string | null;
  applicationMethod: string | null;
  treatmentLocation: string | null;
  applicationDate: string | null;
};

type Row = {
  id: string;
  construction: string | null;
  color: string | null;
  widthInches: number | null;
  weightGsm: number | null;
  contents?: FabricContent[];
  submission?: FabricSubmission | null;
};

type ApiResponse = {
  ok: boolean;
  page: number;
  pageSize: number;
  total: number;
  items: Row[];
  error?: string;
};

function fmtNum(n: number | null | undefined) {
  if (n === null || n === undefined) return "";
  if (Number.isNaN(n)) return "";
  return new Intl.NumberFormat().format(n);
}

function fmtPct(n: number | null | undefined) {
  if (n === null || n === undefined) return "";
  if (Number.isNaN(n)) return "";
  const v = Math.round(n * 10) / 10;
  return `${v}%`;
}

export default function Page() {
  const [q, setQ] = useState("");
  const [construction, setConstruction] = useState("");
  const [color, setColor] = useState("");
  const [content, setContent] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));

    const tq = q.trim();
    const tc = construction.trim();
    const tcol = color.trim();
    const tcont = content.trim();

    if (tq) p.set("q", tq);
    if (tc) p.set("construction", tc);
    if (tcol) p.set("color", tcol);
    if (tcont) p.set("content", tcont);

    return p.toString();
  }, [q, construction, color, content, page, pageSize]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);

    fetch(`/api/fabrics?${qs}`)
      .then(async (r) => {
        const j = (await r.json()) as ApiResponse;
        if (!alive) return;
        if (!j.ok) throw new Error(j.error || "api_error");
        setData(j);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e?.message || String(e));
        setData(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [qs]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>FUZE Atlas</h1>
        <div style={{ opacity: 0.75, fontSize: 13 }}>
          Fabrics database (search + open detail). Content normalization should handle “nylon / polyamide”, “spandex / elastane / lycra”, etc.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
          gap: 10,
          alignItems: "end",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, opacity: 0.75 }}>General search</div>
          <input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="FUZE #, customer code, factory code, notes…"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              outline: "none",
            }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, opacity: 0.75 }}>Construction</div>
          <input
            value={construction}
            onChange={(e) => {
              setPage(1);
              setConstruction(e.target.value);
            }}
            placeholder='e.g. "Knit", "Woven"'
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              outline: "none",
            }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, opacity: 0.75 }}>Color</div>
          <input
            value={color}
            onChange={(e) => {
              setPage(1);
              setColor(e.target.value);
            }}
            placeholder='e.g. "White", "Black"'
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              outline: "none",
            }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, opacity: 0.75 }}>Contains</div>
          <input
            value={content}
            onChange={(e) => {
              setPage(1);
              setContent(e.target.value);
            }}
            placeholder='e.g. "polyamide", "elastane"'
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              outline: "none",
            }}
          />
        </div>

        <button
          onClick={() => {
            setQ("");
            setConstruction("");
            setColor("");
            setContent("");
            setPage(1);
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 700,
            cursor: "pointer",
            opacity: page <= 1 || loading ? 0.5 : 1,
          }}
        >
          Prev
        </button>

        <button
          onClick={() => setPage((p) => Math.min(pages, p + 1))}
          disabled={page >= pages || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 700,
            cursor: "pointer",
            opacity: page >= pages || loading ? 0.5 : 1,
          }}
        >
          Next
        </button>

        <div style={{ opacity: 0.75 }}>
          {loading ? "Loading…" : err ? `Error: ${err}` : data ? `Total ${data.total} • Page ${page}/${pages}` : ""}
        </div>
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 0.9fr 0.9fr 0.6fr 2.2fr 1.6fr 0.5fr",
            background: "#fafafa",
            borderBottom: "1px solid #e5e5e5",
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          {["FUZE # / Codes", "Construction", "Color", "GSM", "Contents", "Process", ""].map((h) => (
            <div key={h} style={{ padding: 12 }}>
              {h}
            </div>
          ))}
        </div>

        {data?.items?.length ? (
          data.items.map((r) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.3fr 0.9fr 0.9fr 0.6fr 2.2fr 1.6fr 0.5fr",
                borderBottom: "1px solid #f0f0f0",
                fontSize: 13,
              }}
            >
              <div style={{ padding: 12 }}>
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

              <div style={{ padding: 12 }}>{r.construction || "—"}</div>
              <div style={{ padding: 12 }}>{r.color || "—"}</div>
              <div style={{ padding: 12 }}>{fmtNum(r.weightGsm) || "—"}</div>

              <div style={{ padding: 12 }}>
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

              <div style={{ padding: 12 }}>
                <div style={{ fontWeight: 700 }}>{r.submission?.applicationMethod || "—"}</div>
                <div style={{ opacity: 0.8 }}>
                  {r.submission?.treatmentLocation || ""}
                  {r.submission?.treatmentLocation && r.submission?.applicationDate ? " • " : ""}
                  {r.submission?.applicationDate ? new Date(r.submission.applicationDate).toLocaleDateString() : ""}
                </div>
              </div>

              <div style={{ padding: 12 }}>
                <Link
                  href={`/fabrics/${r.id}`}
                  style={{
                    display: "inline-block",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "white",
                    fontWeight: 800,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  Open
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: 14, opacity: 0.7 }}>{loading ? "Loading…" : "No results."}</div>
        )}
      </div>
    </div>
  );
}
