"use client";

import React, { useState } from "react";

export default function IngestCsvPage() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceTable, setSourceTable] = useState("knack_export");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    setOut(null);
    if (!file) return;

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("sourceTable", sourceTable);
      fd.append("sourceSystem", "CSV");

      const r = await fetch("/api/ingest/csv", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setOut(j);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Ingest CSV</h1>
      <div style={{ color: "#555", marginBottom: 16 }}>
        Upload a CSV export. We’ll create/update Fabrics, create Submissions when FUZE # exists,
        and store every row in SourceRecord for traceability.
      </div>

      <div style={{ display: "grid", gap: 12, padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 800 }}>Source table label</div>
          <input
            value={sourceTable}
            onChange={(e) => setSourceTable(e.target.value)}
            placeholder="knack_fabrics / knack_tests_icp / etc"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 800 }}>CSV file</div>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        <button
          onClick={run}
          disabled={!file || busy}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: busy ? "#f6f6f6" : "white",
            fontWeight: 900,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Ingesting…" : "Ingest"}
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid #f2c7c7", background: "#fff6f6" }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Error</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{err}</div>
        </div>
      )}

      {out && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Result</div>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, margin: 0 }}>{JSON.stringify(out, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}