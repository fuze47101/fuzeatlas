cd ~/fuzeatlas

cat > src/app/page.tsx <<'EOF'
"use client";

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
  // data may be 0-100 already
  const v = n > 1 ? n : n * 100;
  return `${Math.round(v)}%`;
}

export default function HomePage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const params = useMemo(() => {
    const u = new URLSearchParams();
    u.set("page", String(page));
    u.set("pageSize", String(pageSize));
    if (q.trim()) u.set("q", q.trim());
    return u.toString();
  }, [page, pageSize, q]);

  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/fabrics?${params}`, { cache: "no-store" });
        const json = (await res.json()) as ApiResponse;
        if (!alive) return;
        if (!json.ok) throw new Error(json.error || "api_error");
        setData(json);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || String(e));
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [params]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function openFabric(id: string) {
    window.location.href = `/fabrics/${id}`;
  }

  return (
    <div style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>FUZE Atlas</h1>
        <div style={{ opacity: 0.75, fontSize: 13 }}>
          Fabrics database — search by construction, color, or content (nylon/polyamide, spandex/elastane/lycra, etc.)
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search… (e.g., knit, nylon, elastane, 200 gsm)"
          style={{
            width: 420,
            maxWidth: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            outline: "none",
            fontSize: 14,
          }}
        />

        <select
          value={String(pageSize)}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", fontSize: 14 }}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={String(n)}>
              {n}/page
            </option>
          ))}
        </select>

        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={!data || page <= 1 || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 700,
            cursor: "pointer",
            opacity: !data || page <= 1 || loading ? 0.5 : 1,
          }}
        >
          Prev
        </button>

        <button
          onClick={() => setPage((p) => Math.min(pages, p + 1))}
          disabled={!data || page >= pages || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 700,
            cursor: "pointer",
            opacity: !data || page >= pages || loading ? 0.5 : 1,
          }}
        >
          Next
        </button>

        <div style={{ opacity: 0.75 }}>
          {loading ? "Loading…" : err ? `Error: ${err}` : data ? `Total ${data.total} • Page ${page}/${pages}` : ""}
        </div>

        <div style={{ marginLeft: "auto", opacity: 0.65, fontSize: 12 }}>
          Tip: Content normalization is the next step (spandex/elastane/lycra, nylon/polyamide/nylon 6,6, etc.)
        </div>
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.6fr 2.4fr 1.6fr 0.4fr",
            gap: 0,
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
              onClick={() => openFabric(r.id)}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.6fr 2.4fr 1.6fr 0.4fr",
                borderBottom: "1px solid #f0f0f0",
                cursor: "pointer",
              }}
              title="Open fabric"
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
                <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>{r.id}</div>
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
                        onClick={(e) => e.stopPropagation()}
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

              <div style={{ padding: 12, fontSize: 12 }}>
                <a
                  href={`/fabrics/${r.id}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontWeight: 800, textDecoration: "none" }}
                >
                  Open →
                </a>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: 16, fontSize: 13, opacity: 0.8 }}>{loading ? "Loading…" : "No results."}</div>
        )}
      </div>
    </div>
  );
}
EOF