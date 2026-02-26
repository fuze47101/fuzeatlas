// claw sanity test
// claw sanity test
// claw sanity test
// test claw write
// test claw write
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FabricContent = { material: string; percent: number | null };
type FabricSubmission = 
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
  createdAt?: string;
  updatedAt?: string;
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
  if (n === null || n === undefined) return "—";
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat().format(n);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString();
}

function pctLabel(p: number | null | undefined) {
  if (p === null || p === undefined) return "";
  if (Number.isNaN(p)) return "";
  // If your import stored 100 as 100, show 100%. If stored as 1.0, show 100%.
  const v = p <= 1 ? Math.round(p * 100) : Math.round(p);
  return `${v}%`;
}

function contentChip(c: FabricContent) {
  const p = pctLabel(c.percent ?? null);
  return `${c.material}${p ? " " + p : ""}`;
}

export default function HomePage() {
  const [q, setQ] = useState("");
  const [construction, setConstruction] = useState("");
  const [color, setColor] = useState("");
  const [contains, setContains] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // We support both classic paging and "Load more"
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  // Reset list when search/pageSize changes
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [q, construction, color, contains, pageSize]);

  const mergedQuery = useMemo(() => {
    // Keep the UI fields, but use server paging. Server currently only supports `q`,
    // so we pass a merged string + do exact filtering client-side for "contains".
    return [q, construction, color, contains].map((s) => (s || "").trim()).filter(Boolean).join(" ");
  }, [q, construction, color, contains]);

  async function fetchPage(p: number, mode: "replace" | "append") {
    setLoading(true);
    setErr(null);
    try {
      const url = new URL("/api/fabrics", window.location.origin);
      url.searchParams.set("page", String(p));
      url.searchParams.set("pageSize", String(pageSize));
      if (mergedQuery) url.searchParams.set("q", mergedQuery);

      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = (await res.json()) as ApiResponse;

      if (!json.ok) throw new Error(json.error || "api_error");
      setTotal(json.total);

      if (mode === "replace") setItems(json.items || []);
      else setItems((prev) => [...prev, ...(json.items || [])]);
    } catch (e: any) {
      setErr(e?.message || String(e));
      if (mode === "replace") setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // When page changes, load that page (replace)
    fetchPage(page, "replace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, mergedQuery]);

  const filteredItems = useMemo(() => {
    // Keep the server paging, but apply tighter client filters for contains/construction/color
    const c = construction.trim().toLowerCase();
    const col = color.trim().toLowerCase();
    const con = contains.trim().toLowerCase();

    return items.filter((it) => {
      if (c && !(it.construction || "").toLowerCase().includes(c)) return false;
      if (col && !(it.color || "").toLowerCase().includes(col)) return false;

      if (con) {
        const hay = [
          ...(it.contents || []).map((x) => `${x.material} ${pctLabel(x.percent ?? null)}`.toLowerCase()),
        ].join(" | ");
        if (!hay.includes(con)) return false;
      }

      // General q is already in mergedQuery; no extra filter needed.
      return true;
    });
  }, [items, construction, color, contains]);

  const canPrev = page > 1 && !loading;
  const canNext = page < pages && !loading;

  const canLoadMore = !loading && page < pages;

  function clearAll() {
    setQ("");
    setConstruction("");
    setColor("");
    setContains("");
    setPage(1);
    setItems([]);
  }

  async function loadMore() {
    if (!canLoadMore) return;
    const next = page + 1;
    setLoading(true);
    setErr(null);
    try {
      const url = new URL("/api/fabrics", window.location.origin);
      url.searchParams.set("page", String(next));
      url.searchParams.set("pageSize", String(pageSize));
      if (mergedQuery) url.searchParams.set("q", mergedQuery);

      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = (await res.json()) as ApiResponse;

      if (!json.ok) throw new Error(json.error || "api_error");
      setTotal(json.total);
      setItems((prev) => [...prev, ...(json.items || [])]);
      setPage(next);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -0.5 }}>FUZE Atlas</div>
        <div style={{ opacity: 0.7, marginTop: 6 }}>
          Fabrics database (search + open detail).
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 6 }}>General search</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="FUZE #, customer code, factory code, notes…"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 6 }}>Construction</div>
          <input
            value={construction}
            onChange={(e) => setConstruction(e.target.value)}
            placeholder='e.g. "Knit", "Woven"'
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 6 }}>Color</div>
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder='e.g. "White", "Black"'
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 6 }}>Contains</div>
          <input
            value={contains}
            onChange={(e) => setContains(e.target.value)}
            placeholder='e.g. "polyamide", "elastane"'
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>

        <button
          onClick={clearAll}
          style={{
            height: 42,
            padding: "0 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        <button
          disabled={!canPrev}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: canPrev ? "white" : "#f6f6f6",
            fontWeight: 800,
            cursor: canPrev ? "pointer" : "not-allowed",
          }}
        >
          Prev
        </button>

        <button
          disabled={!canNext}
          onClick={() => setPage((p) => Math.min(pages, p + 1))}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: canNext ? "white" : "#f6f6f6",
            fontWeight: 800,
            cursor: canNext ? "pointer" : "not-allowed",
          }}
        >
          Next
        </button>

        <div style={{ fontWeight: 800 }}>
          Total {(total ?? 0).toLocaleString()} • Page {page}/{pages}
        </div>

        <div style={{ marginLeft: 6, display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>Page size</div>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", background: "white", fontWeight: 700 }}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div style={{ marginLeft: 6, display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>Jump to</div>
          <input
            defaultValue={String(page)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const v = (e.currentTarget.value || "").trim();
              const n = parseInt(v, 10);
              if (!Number.isFinite(n)) return;
              setPage(Math.min(pages, Math.max(1, n)));
            }}
            style={{ width: 90, padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
          />
          <div style={{ fontSize: 12, opacity: 0.6 }}>(press Enter)</div>
        </div>
      </div>

      {err ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: "1px solid #f2c1c1", background: "#fff6f6", fontWeight: 700 }}>
          Error: {err}
        </div>
      ) : null}

      <div style={{ marginTop: 14, border: "1px solid #e8e8e8", borderRadius: 14, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 0.9fr 0.8fr 0.6fr 1.4fr 1fr 92px",
            gap: 0,
            padding: "12px 14px",
            background: "#fafafa",
            borderBottom: "1px solid #eee",
            fontWeight: 900,
            fontSize: 13,
          }}
        >
          <div>FUZE # / Codes</div>
          <div>Construction</div>
          <div>Color</div>
          <div>GSM</div>
          <div>Contents</div>
          <div>Process</div>
          <div></div>
        </div>

        {loading && items.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.7 }}>Loading…</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.7 }}>{loading ? "Loading…" : "No results."}</div>
        ) : (
          filteredItems.map((r) => {
            const sub = r.submission || null;
            const fuze = sub?.fuzeFabricNumber ? `FUZE ${sub.fuzeFabricNumber}` : "—";
            const cust = sub?.customerFabricCode ? `Cust: ${sub.customerFabricCode}` : null;
            const fact = sub?.factoryFabricCode ? `Factory: ${sub.factoryFabricCode}` : null;

            const method = sub?.applicationMethod || "—";
            const date = fmtDate(sub?.applicationDate || null);
            const processLine = date ? `${method}\n${date}` : method;

            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 0.9fr 0.8fr 0.6fr 1.4fr 1fr 92px",
                  padding: "12px 14px",
                  borderBottom: "1px solid #f2f2f2",
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900 }}>{fuze}</div>
                  <div style={{ opacity: 0.75, lineHeight: 1.25, whiteSpace: "pre-wrap" }}>
                    {cust}
                    {cust && fact ? " • " : ""}
                    {fact}
                  </div>
                </div>

                <div style={{ opacity: 0.85 }}>{r.construction || "—"}</div>
                <div style={{ opacity: 0.85 }}>{r.color || "—"}</div>
                <div style={{ opacity: 0.85 }}>{fmtNum(r.weightGsm || null)}</div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(r.contents || []).slice(0, 6).map((c, idx) => (
                    <span
                      key={`${r.id}-c-${idx}`}
                      style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #e6e6e6", background: "white", fontWeight: 700 }}
                    >
                      {contentChip(c)}
                    </span>
                  ))}
                  {(r.contents || []).length > 6 ? (
                    <span style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #e6e6e6", background: "white", opacity: 0.7, fontWeight: 800 }}>
                      +{(r.contents || []).length - 6}
                    </span>
                  ) : null}
                </div>

                <div style={{ whiteSpace: "pre-line", fontWeight: 800 }}>{processLine}</div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Link
                    href={`/fabrics/${r.id}`}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      border: "1px solid #ddd",
                      background: "white",
                      fontWeight: 900,
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    Open
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
        <button
          disabled={!canLoadMore}
          onClick={loadMore}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: canLoadMore ? "white" : "#f6f6f6",
            fontWeight: 900,
            cursor: canLoadMore ? "pointer" : "not-allowed",
          }}
        >
          {loading ? "Loading…" : canLoadMore ? "Load more" : "End"}
        </button>
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}
