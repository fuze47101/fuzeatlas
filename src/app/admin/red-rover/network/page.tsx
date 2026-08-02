"use client";

import { useEffect, useMemo, useRef, useState, type WheelEvent as ReactWheelEvent, type MouseEvent as ReactMouseEvent } from "react";
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
  rank?: number | null;
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

const W = 1600;
const H = 1000;
const CX = 800;
const CY = 500;
const R = 360;

const TIER_FILL: Record<string, string> = { TIER1: "#e11d48", TIER2: "#f59e0b", PARKED: "#94a3b8" };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Pt {
  x: number;
  y: number;
}
interface TargetLay extends GNode {
  x: number;
  y: number;
  angle: number;
  r: number;
}
interface SatLay extends GNode {
  x: number;
  y: number;
  targetId: string;
}
interface ConnLay extends GNode {
  x: number;
  y: number;
  targetIds: string[];
}
interface EdgeLay {
  a: Pt;
  b: Pt;
  conn: boolean;
  personId: string;
  targetId: string;
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
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [nodes, setNodes] = useState<GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [fetching, setFetching] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; tx: number; ty: number; moved: boolean } | null>(null);

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

  const layout = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const targets = nodes
      .filter((n) => n.kind === "target")
      .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || a.label.localeCompare(b.label));
    const N = Math.max(targets.length, 1);

    // person → connected target ids; target → person ids
    const personTargets = new Map<string, string[]>();
    const targetPeople = new Map<string, string[]>();
    for (const e of edges) {
      (personTargets.get(e.source) ?? personTargets.set(e.source, []).get(e.source)!).push(e.target);
      (targetPeople.get(e.target) ?? targetPeople.set(e.target, []).get(e.target)!).push(e.source);
    }

    const tpos = new Map<string, TargetLay>();
    targets.forEach((t, i) => {
      const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
      tpos.set(t.id, {
        ...t,
        angle,
        x: CX + R * Math.cos(angle),
        y: CY + R * Math.sin(angle),
        r: clamp(16 + (t.degree || 0) * 0.9, 16, 22),
      });
    });

    // satellites: non-connector people, ≤5 per target on radial spokes outside ring
    const satellites: SatLay[] = [];
    const satExtra = new Map<string, number>();
    for (const t of targets) {
      const tp = tpos.get(t.id)!;
      const people = (targetPeople.get(t.id) || [])
        .map((id) => byId.get(id))
        .filter((p): p is GNode => !!p && p.kind === "person" && !p.connector);
      const shown = people.slice(0, 5);
      if (people.length > shown.length) satExtra.set(t.id, people.length - shown.length);
      const k = shown.length;
      shown.forEach((p, j) => {
        const a = tp.angle + (j - (k - 1) / 2) * 0.12;
        const rad = R + 80 + (j % 2) * 26;
        satellites.push({ ...p, targetId: t.id, x: CX + rad * Math.cos(a), y: CY + rad * Math.sin(a) });
      });
    }

    // connectors: people on ≥2 targets → inside the ring at the centroid
    const connectors: ConnLay[] = [];
    nodes
      .filter((n) => n.kind === "person" && n.connector)
      .forEach((c, idx) => {
        const tids = (personTargets.get(c.id) || []).filter((id) => tpos.has(id));
        if (!tids.length) return;
        const pts = tids.map((id) => tpos.get(id)!);
        const ax = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const ay = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        connectors.push({
          ...c,
          targetIds: tids,
          x: CX + (ax - CX) * 0.55 + (idx % 2 === 0 ? 1 : -1) * idx * 14,
          y: CY + (ay - CY) * 0.55 + ((idx % 3) - 1) * 16,
        });
      });

    const satPos = new Map(satellites.map((s) => [s.id, s]));
    const connPos = new Map(connectors.map((c) => [c.id, c]));

    const edgesLay: EdgeLay[] = [];
    for (const e of edges) {
      const person = byId.get(e.source);
      const conn = !!person?.connector;
      const p1 = conn ? connPos.get(e.source) : satPos.get(e.source);
      const p2 = tpos.get(e.target);
      if (!p1 || !p2) continue; // people past the +N cap have no node → skip edge
      edgesLay.push({ a: { x: p1.x, y: p1.y }, b: { x: p2.x, y: p2.y }, conn, personId: e.source, targetId: e.target });
    }

    return {
      targets: Array.from(tpos.values()),
      satellites,
      connectors,
      edges: edgesLay,
      satExtra,
      personTargets,
    };
  }, [nodes, edges]);

  // ── incidence for hover highlighting ──
  const incident = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      if (!m.has(a)) m.set(a, new Set());
      m.get(a)!.add(b);
    };
    for (const e of edges) {
      add(e.source, e.target);
      add(e.target, e.source);
    }
    return m;
  }, [edges]);

  function userPoint(clientX: number, clientY: number): Pt {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x, y: loc.y };
  }

  function onWheel(e: ReactWheelEvent) {
    e.preventDefault();
    const p = userPoint(e.clientX, e.clientY);
    setView((v) => {
      const ns = clamp(v.scale * (e.deltaY < 0 ? 1.12 : 0.89), 0.4, 4);
      const wx = (p.x - v.tx) / v.scale;
      const wy = (p.y - v.ty) / v.scale;
      return { scale: ns, tx: p.x - wx * ns, ty: p.y - wy * ns };
    });
  }
  function onBgDown(e: ReactMouseEvent) {
    const p = userPoint(e.clientX, e.clientY);
    dragRef.current = { startX: p.x, startY: p.y, tx: view.tx, ty: view.ty, moved: false };
  }
  function onMove(e: ReactMouseEvent) {
    if (!dragRef.current) return;
    const p = userPoint(e.clientX, e.clientY);
    const dx = p.x - dragRef.current.startX;
    const dy = p.y - dragRef.current.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) {
      dragRef.current.moved = true;
      if (!grabbing) setGrabbing(true);
    }
    setView((v) => ({ ...v, tx: dragRef.current!.tx + dx, ty: dragRef.current!.ty + dy }));
  }
  function onUp() {
    const d = dragRef.current;
    dragRef.current = null;
    setGrabbing(false);
    if (d && !d.moved) setFocusTarget(null); // background click = reset focus
  }

  // ── visibility helpers ──
  function targetVisible(id: string): number {
    if (focusTarget) return id === focusTarget ? 1 : 0.12;
    if (hoverId) return id === hoverId || incident.get(hoverId)?.has(id) ? 1 : 0.15;
    return 1;
  }
  function satVisible(s: SatLay): number {
    if (focusTarget) return s.targetId === focusTarget ? 1 : 0.1;
    if (hoverId) return s.id === hoverId || incident.get(hoverId)?.has(s.id) ? 1 : 0.12;
    return 1;
  }
  function connVisible(c: ConnLay): number {
    if (focusTarget) return c.targetIds.includes(focusTarget) ? 1 : 0.1;
    if (hoverId) return c.id === hoverId || incident.get(hoverId)?.has(c.id) ? 1 : 0.15;
    return 1;
  }
  function edgeVisible(e: EdgeLay): number {
    if (focusTarget) return e.targetId === focusTarget ? (e.conn ? 0.9 : 0.6) : 0.05;
    if (hoverId) return e.personId === hoverId || e.targetId === hoverId ? (e.conn ? 0.95 : 0.7) : 0.06;
    return e.conn ? 0.9 : 0.4;
  }
  function showSatLabel(s: SatLay): boolean {
    return hoverId === s.id || focusTarget === s.targetId || hoverId === s.targetId;
  }

  if (loading || (fetching && nodes.length === 0)) {
    return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">Loading network…</div>;
  }
  if (!isAdmin) return null;

  const targetId = (id: string) => id.replace(/^t:/, "");

  return (
    <div className="mx-auto max-w-[1700px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🚀 Red Rover — Relationship Network</h1>
          <p className="text-sm text-slate-500">
            Targets on the ring, their people as satellites, connectors (≥2 targets) inside with orange cross-links. Scroll to zoom · drag to pan · click a target to focus.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/red-rover" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">← Dashboard</Link>
          <button
            onClick={() => {
              setView({ scale: 1, tx: 0, ty: 0 });
              setFocusTarget(null);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ⟲ Reset view
          </button>
        </div>
      </div>

      {err && <div className="mb-4 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">Failed to load: {err}</div>}

      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600">
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full align-middle" style={{ background: "#e11d48" }} />Target</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-blue-600 align-middle" />FUZE owner / connector</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-slate-400 align-middle" />Target-side person</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full align-middle" style={{ background: "#64748b", boxShadow: "0 0 0 2px #f59e0b" }} />Connector (≥2 targets)</span>
        {focusTarget && <span className="font-medium text-rose-600">Focused — click empty space to reset</span>}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white" style={{ height: 720 }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full touch-none select-none"
          style={{ cursor: grabbing ? "grabbing" : "grab" }}
          onWheel={onWheel}
          onMouseDown={onBgDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
        >
          {/* background capture rect for pan/reset */}
          <rect x={-4000} y={-4000} width={12000} height={12000} fill="transparent" />
          <g transform={`translate(${view.tx},${view.ty}) scale(${view.scale})`}>
            {/* guide ring */}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={2} />

            {/* edges */}
            {layout.edges.map((e, i) => (
              <line
                key={`e${i}`}
                x1={e.a.x}
                y1={e.a.y}
                x2={e.b.x}
                y2={e.b.y}
                stroke={e.conn ? "#f59e0b" : "#cbd5e1"}
                strokeWidth={e.conn ? 2.5 : 1}
                opacity={edgeVisible(e)}
              />
            ))}

            {/* satellite people */}
            {layout.satellites.map((s) => {
              const op = satVisible(s);
              return (
                <g key={s.id} opacity={op} onMouseEnter={() => setHoverId(s.id)} onMouseLeave={() => setHoverId(null)}>
                  <title>{`${s.label}${s.title ? " — " + s.title : ""}`}</title>
                  <circle cx={s.x} cy={s.y} r={hoverId === s.id ? 7 : 5} fill={s.isFuze ? "#2563eb" : "#94a3b8"} stroke="#fff" strokeWidth={1} />
                  {showSatLabel(s) && (
                    <text x={s.x + 8} y={s.y + 3} fontSize={11} fill="#334155" paintOrder="stroke" stroke="#fff" strokeWidth={3}>
                      {s.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* +N chips */}
            {layout.targets.map((t) => {
              const extra = layout.satExtra.get(t.id);
              if (!extra) return null;
              const lx = CX + (R + 60) * Math.cos(t.angle);
              const ly = CY + (R + 60) * Math.sin(t.angle);
              return (
                <text key={`x${t.id}`} x={lx} y={ly} fontSize={11} fill="#94a3b8" textAnchor="middle" opacity={targetVisible(t.id)}>
                  +{extra}
                </text>
              );
            })}

            {/* targets */}
            {layout.targets.map((t) => {
              const op = targetVisible(t.id);
              const right = Math.cos(t.angle) >= 0;
              const lx = CX + (R + t.r + 10) * Math.cos(t.angle);
              const ly = CY + (R + t.r + 10) * Math.sin(t.angle);
              return (
                <g
                  key={t.id}
                  opacity={op}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoverId(t.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setFocusTarget((f) => (f === t.id ? null : t.id));
                  }}
                >
                  <circle
                    cx={t.x}
                    cy={t.y}
                    r={hoverId === t.id ? t.r + 2 : t.r}
                    fill={TIER_FILL[t.tier || ""] || "#94a3b8"}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                  <text
                    x={lx}
                    y={ly + 4}
                    fontSize={14}
                    fontWeight={700}
                    fill="#0f172a"
                    textAnchor={right ? "start" : "end"}
                    paintOrder="stroke"
                    stroke="#fff"
                    strokeWidth={3.5}
                  >
                    {t.label}
                  </text>
                </g>
              );
            })}

            {/* connectors (drawn last = on top; always-labelled) */}
            {layout.connectors.map((c) => {
              const op = connVisible(c);
              return (
                <g key={c.id} opacity={op} onMouseEnter={() => setHoverId(c.id)} onMouseLeave={() => setHoverId(null)}>
                  <title>{`${c.label}${c.title ? " — " + c.title : ""} (connector: ${c.targetIds.length} targets)`}</title>
                  <circle cx={c.x} cy={c.y} r={hoverId === c.id ? 12 : 10} fill={c.isFuze ? "#2563eb" : "#64748b"} stroke="#f59e0b" strokeWidth={3} />
                  <text x={c.x} y={c.y - 14} fontSize={11} fontWeight={600} fill="#b45309" textAnchor="middle" paintOrder="stroke" stroke="#fff" strokeWidth={3}>
                    {c.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {layout.targets.length} targets · {layout.satellites.length + layout.connectors.length} people ({layout.connectors.length} connectors) · click a target node to open its dossier is disabled in focus mode — use the dashboard.{" "}
        {focusTarget && (
          <Link href={`/admin/red-rover/${targetId(focusTarget)}`} className="text-rose-700 hover:underline">
            Open {layout.targets.find((t) => t.id === focusTarget)?.label} dossier →
          </Link>
        )}
      </p>
    </div>
  );
}
