"use client";

import { useEffect, useState } from "react";

type AnyJson = any;

export default function StatusPage() {
  const [health, setHealth] = useState<AnyJson>(null);
  const [stats, setStats] = useState<AnyJson>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const h = await fetch("/api/health", { cache: "no-store" }).then(r => r.json());
        setHealth(h);
      } catch (e: any) {
        setErr(prev => prev + "\nhealth: " + (e?.message ?? String(e)));
      }

      try {
        const s = await fetch("/api/core/stats", { cache: "no-store" }).then(r => r.json());
        setStats(s);
      } catch (e: any) {
        setErr(prev => prev + "\nstats: " + (e?.message ?? String(e)));
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>FUZE Atlas — Live Status</h1>

      {!!err && (
        <div style={{ marginTop: 16, padding: 16, border: "1px solid #f66", borderRadius: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Errors</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{err}</pre>
        </div>
      )}

      <div style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Health</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(health, null, 2)}</pre>
      </div>

      <div style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Core / Staging Counts</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(stats, null, 2)}</pre>
      </div>
    </div>
  );
}
