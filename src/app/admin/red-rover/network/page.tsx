"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { HydrationFrame, useMountLog } from "@/components/HydrationFrame";

interface GNode {
  id: string;
  label: string;
  kind: "target" | "person";
  tier?: string;
  stage?: string;
  isFuze?: boolean;
  connector?: boolean;
  title?: string | null;
  degree: number;
}
interface GEdge {
  source: string;
  target: string;
  role: string;
}

const W = 960;
const H = 680;

/** Deterministic Fruchterman-Reingold force layout (no random seeding). */
function layout(nodes: GNode[], edges: GEdge[], iters = 320): Map<string, { x: number; y: number }> {
  const N = Math.max(nodes.length, 1);
  const k = Math.sqrt((W * H) / N) * 0.72;
  const pos = new Map<string, { x: number; y: number }>();
  nodes.forEach((n, i) => {
    const ang = (2 * Math.PI * i) / N;
    // Targets start nearer the center; people on the outer ring.
    const r = n.kind === "target" ? 0.18 : 0.34;
    pos.set(n.id, { x: W / 2 + Math.cos(ang) * W * r, y: H / 2 + Math.sin(ang) * H * r });
  });
  let temp = W * 0.09;
  for (let it = 0; it < iters; it++) {
    const disp = new Map<string, { x: number; y: number }>();
    nodes.forEach((n) => disp.set(n.id, { x: 0, y: 0 }));
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const pa = pos.get(nodes[i].id)!;
        const pb = pos.get(nodes[j].id)!;
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const f = (k * k) / d;
        const da = disp.get(nodes[i].id)!;
        const db = disp.get(nodes[j].id)!;
        da.x += (dx / d) * f;
        da.y += (dy / d) * f;
        db.x -= (dx / d) * f;
        db.y -= (dy / d) * f;
      }
    }
    for (const e of edges) {
      const pa = pos.get(e.source);
      const pb = pos.get(e.target);
      if (!pa || !pb) continue;
      const dx = pa.x - pb.x;
      const dy = pa.y - pb.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (d * d) / k;
      const da = disp.get(e.source)!;
      const db = disp.get(e.target)!;
      da.x -= (dx / d) * f;
      da.y -= (dy / d) * f;
      db.x += (dx / d) * f;
      db.y += (dy / d) * f;
    }
    for (const n of nodes) {
      const dp = disp.get(n.id)!;
      const dl = Math.hypot(dp.x, dp.y) || 0.01;
      const p = pos.get(n.id)!;
      p.x += (dp.x / dl) * Math.min(dl, temp);
      p.y += (dp.y / dl) * Math.min(dl, temp);
      p.x += (W / 2 - p.x) * 0.006;
      p.y += (H / 2 - p.y) * 0.006;
      p.x = Math.max(24, Math.min(W - 24, p.x));
      p.y = Math.max(24, Math.min(H - 24, p.y));
    }
    temp *= 0.975;
  }
  return pos;
}

export default function RedRoverNetworkOuter() {
  return (
    <HydrationFrame name="/admin/red-rover/network">
      <RedRoverNetwork />
    </HydrationFrame>
  );
}

function RedRoverNetwork() {
  useMountLog("red-rover-network");
  const { user, loading } = useAuth();
  const router = useRouter();
  const [nodes, setNodes] = useState<GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [fetching, setFetching] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const isAdmin = !!user && ["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role);

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) {
      router.replace("/home");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/admin/red-rover/network", { cache: "no-store" });
        if (!res.ok) setErr(`API ${res.status}`);
        else {
          const j = await res.json();
          setNodes(j.nodes || []);
          setEdges(j.edges || []);
        }
      } catch (e: any) {
        setErr(e?.message || "Failed to load");
      } finally {
        setFetching(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAdmin]);

  const pos = useMemo(() => layout(nodes, edges), [nodes, edges]);

  if (loading || (fetching && nodes.length === 0)) {
    return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">Loading network…</div>;
  }
  if (!isAdmin) return null;

  const targetId = (id: string) => id.replace(/^t:/, "");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🚀 Red Rover — Relationship Network</h1>
          <p className="text-sm text-slate-500">Targets, their people, and FUZE owners/connectors. People linked to more than one target are connectors.</p>
        </div>
        <Link href="/admin/red-rover" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">← Dashboard</Link>
      </div>

      {err && <div className="mb-4 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">Failed to load: {err}</div>}

      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600">
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-rose-600 align-middle" />Target</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-blue-600 align-middle" />FUZE owner / connector</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-slate-400 align-middle" />Target-side person</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full ring-2 ring-amber-500 align-middle" />Connector (≥2 targets)</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" style={{ minWidth: 640 }}>
          {/* Edges */}
          {edges.map((e, i) => {
            const a = pos.get(e.source);
            const b = pos.get(e.target);
            if (!a || !b) return null;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#cbd5e1" strokeWidth={1} />;
          })}
          {/* Nodes */}
          {nodes.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            const isTarget = n.kind === "target";
            const r = isTarget ? 9 + Math.min(n.degree, 6) : n.connector ? 6 : 4;
            const fill = isTarget
              ? n.tier === "TIER1"
                ? "#e11d48"
                : n.tier === "TIER2"
                  ? "#f59e0b"
                  : "#94a3b8"
              : n.isFuze
                ? "#2563eb"
                : "#94a3b8";
            const showLabel = isTarget || n.connector || n.isFuze;
            const inner = (
              <g>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={fill}
                  stroke={n.connector ? "#f59e0b" : "#fff"}
                  strokeWidth={n.connector ? 2.5 : 1}
                />
                {showLabel && (
                  <text x={p.x + r + 2} y={p.y + 3} fontSize={isTarget ? 11 : 9} fill={isTarget ? "#0f172a" : "#475569"} fontWeight={isTarget ? 600 : 400}>
                    {n.label}
                  </text>
                )}
              </g>
            );
            return isTarget ? (
              <Link key={n.id} href={`/admin/red-rover/${targetId(n.id)}`}>
                {inner}
              </Link>
            ) : (
              <g key={n.id}>
                <title>{`${n.label}${n.title ? " — " + n.title : ""}${n.connector ? " (connector)" : ""}`}</title>
                {inner}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 text-xs text-slate-400">{nodes.filter((n) => n.kind === "target").length} targets · {nodes.filter((n) => n.kind === "person").length} people · {edges.length} links · click a target node to open its dossier.</p>
    </div>
  );
}
