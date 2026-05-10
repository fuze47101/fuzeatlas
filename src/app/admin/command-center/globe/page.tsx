"use client";

/**
 * /admin/command-center/globe — Phase 11A.
 *
 * Three.js / react-three-fiber globe with:
 *   - Earth sphere (wireframe + atmospheric glow)
 *   - Factory / brand / lab / distributor nodes at lat/lng
 *   - Active factories pulse (recent submissions)
 *   - Shipment arcs from origin → destination
 *   - Click any node for a flyout snapshot panel
 *
 * Empty-state copy points operator at `npm run seed:geocode`
 * when no coords are present.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Sphere } from "@react-three/drei";
import * as THREE from "three";

interface GeoNode {
  id: string;
  name: string;
  country?: string | null;
  city?: string | null;
  lat: number;
  lng: number;
  active?: boolean;
  isFuzeOwned?: boolean;
  pipelineStage?: string | null;
}
interface Shipment {
  id: string;
  orderNumber: string;
  status: string;
  orderType: string;
  from: { lat: number; lng: number; name: string };
  to: { lat: number; lng: number; name: string };
}
interface GlobeData {
  ok: boolean;
  factories: GeoNode[];
  brands: GeoNode[];
  labs: GeoNode[];
  distributors: GeoNode[];
  shipments: Shipment[];
  counts: Record<string, number>;
}

const GLOBE_RADIUS = 2;

function latLngToVec3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

function Earth() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (meshRef.current) meshRef.current.rotation.y += dt * 0.05;
  });
  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <meshStandardMaterial
          color="#0a3a52"
          wireframe
          opacity={0.4}
          transparent
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.02, 32, 32]} />
        <meshBasicMaterial color="#00b4c3" transparent opacity={0.05} />
      </mesh>
    </group>
  );
}

function Pin({
  node,
  color,
  pulse,
  onClick,
}: {
  node: GeoNode;
  color: string;
  pulse?: boolean;
  onClick?: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => latLngToVec3(node.lat, node.lng, GLOBE_RADIUS * 1.01), [node.lat, node.lng]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (pulse) {
      const s = 1 + 0.4 * Math.sin(clock.elapsedTime * 3 + node.lat);
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <mesh
      ref={ref}
      position={pos}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerOver={(e) => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "default")}
    >
      <sphereGeometry args={[0.025, 12, 12]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function Arc({ from, to, color }: { from: THREE.Vector3; to: THREE.Vector3; color: string }) {
  const points = useMemo(() => {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const dist = from.distanceTo(to);
    mid.normalize().multiplyScalar(GLOBE_RADIUS + dist * 0.35);
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    return curve.getPoints(40);
  }, [from, to]);
  return <Line points={points} color={color} lineWidth={1.5} transparent opacity={0.7} />;
}

function Scene({
  data,
  onPick,
}: {
  data: GlobeData;
  onPick: (n: GeoNode, kind: string) => void;
}) {
  const shipmentArcs = useMemo(
    () =>
      data.shipments.map((s) => ({
        id: s.id,
        from: latLngToVec3(s.from.lat, s.from.lng, GLOBE_RADIUS * 1.01),
        to: latLngToVec3(s.to.lat, s.to.lng, GLOBE_RADIUS * 1.01),
        color:
          s.orderType === "PRODUCTION"
            ? "#00b4c3"
            : s.orderType === "SAMPLE"
              ? "#f59e0b"
              : "#a78bfa",
      })),
    [data.shipments],
  );

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <Earth />
      {data.factories.map((f) => (
        <Pin key={`f-${f.id}`} node={f} color="#00b4c3" pulse={!!f.active} onClick={() => onPick(f, "Factory")} />
      ))}
      {data.brands.map((b) => (
        <Pin key={`b-${b.id}`} node={b} color="#f59e0b" onClick={() => onPick(b, "Brand")} />
      ))}
      {data.labs.map((l) => (
        <Pin key={`l-${l.id}`} node={l} color={l.isFuzeOwned ? "#22c55e" : "#a78bfa"} onClick={() => onPick(l, "Lab")} />
      ))}
      {data.distributors.map((d) => (
        <Pin key={`d-${d.id}`} node={d} color="#ec4899" onClick={() => onPick(d, "Distributor")} />
      ))}
      {shipmentArcs.map((a) => (
        <Arc key={`s-${a.id}`} from={a.from} to={a.to} color={a.color} />
      ))}
      <OrbitControls enablePan={false} enableZoom={true} minDistance={3} maxDistance={10} />
    </>
  );
}

export default function GlobePage() {
  const [data, setData] = useState<GlobeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<{ node: GeoNode; kind: string } | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/globe")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error || "Failed to load globe");
      })
      .catch((e) => setError(e.message));
  }, []);

  const totalNodes = data
    ? data.factories.length + data.brands.length + data.labs.length + data.distributors.length
    : 0;

  // Filter highlight by search.
  const searchHit = useMemo(() => {
    if (!data || !search.trim()) return null;
    const q = search.trim().toLowerCase();
    const all = [
      ...data.factories.map((n) => ({ kind: "Factory", n })),
      ...data.brands.map((n) => ({ kind: "Brand", n })),
      ...data.labs.map((n) => ({ kind: "Lab", n })),
      ...data.distributors.map((n) => ({ kind: "Distributor", n })),
    ];
    return all.find((x) => x.n.name.toLowerCase().includes(q)) || null;
  }, [data, search]);

  if (error) return <div className="p-6 text-red-700">{error}</div>;
  if (!data) return <div className="p-6 text-slate-500">Loading globe…</div>;

  if (totalNodes === 0) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <h1 className="text-2xl font-black text-slate-900 mb-2">Supply-chain globe</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-bold text-amber-900">No geocoded entities yet</p>
          <p className="text-sm text-amber-800 mt-2">
            Run the geocoder to populate lat/lng from each entity's city + country:
          </p>
          <pre className="mt-3 p-3 bg-white rounded text-xs font-mono text-slate-800 overflow-x-auto">
{`npm run seed:geocode
# or only one entity type:
npm run seed:geocode -- --only=Factory --limit=20`}
          </pre>
          <p className="text-xs text-amber-700 mt-2">
            Nominatim has a 1 req/sec rate limit — a full pass takes a few
            minutes. Re-runs skip rows that already have coordinates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full">
      {/* Header HUD */}
      <div className="absolute top-4 left-4 z-10 rounded-xl bg-white/90 backdrop-blur border border-slate-200 p-4 max-w-xs">
        <h1 className="text-lg font-black text-slate-900">Supply-chain globe</h1>
        <p className="text-xs text-slate-500 mt-1">
          {data.counts.factories} factories · {data.counts.brands} brands ·{" "}
          {data.counts.labs} labs · {data.counts.distributors} distributors ·{" "}
          {data.counts.shipments} shipments (90d)
        </p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search entity…"
          className="mt-3 w-full px-2 py-1 border border-slate-300 rounded text-sm"
        />
        {searchHit && (
          <button
            onClick={() => setPick({ node: searchHit.n, kind: searchHit.kind })}
            className="mt-2 w-full text-left px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs font-bold text-amber-800 hover:bg-amber-100"
          >
            ↗ {searchHit.kind}: {searchHit.n.name}
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 rounded-xl bg-white/90 backdrop-blur border border-slate-200 p-3 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: "#00b4c3" }} />
          Factory <span className="text-slate-400">(pulse = active 30d)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: "#f59e0b" }} />
          Brand HQ
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: "#22c55e" }} />
          FUZE-owned lab
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: "#a78bfa" }} />
          Partner lab
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: "#ec4899" }} />
          Distributor
        </div>
      </div>

      {/* Flyout panel */}
      {pick && (
        <div className="absolute top-4 right-4 z-10 rounded-xl bg-white/95 backdrop-blur border border-slate-200 p-5 max-w-xs shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">{pick.kind}</p>
              <h2 className="font-black text-slate-900">{pick.node.name}</h2>
              {pick.node.city || pick.node.country ? (
                <p className="text-xs text-slate-600 mt-1">
                  {[pick.node.city, pick.node.country].filter(Boolean).join(", ")}
                </p>
              ) : null}
              {pick.node.pipelineStage && (
                <p className="text-xs mt-1">
                  Stage:{" "}
                  <span className="font-bold">{pick.node.pipelineStage}</span>
                </p>
              )}
              {pick.kind === "Factory" && pick.node.active && (
                <p className="text-xs text-emerald-700 font-bold mt-1">⚡ Active (30d)</p>
              )}
            </div>
            <button
              onClick={() => setPick(null)}
              className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            >
              ×
            </button>
          </div>
          <a
            href={
              pick.kind === "Brand"
                ? `/brands/${pick.node.id}`
                : pick.kind === "Factory"
                  ? `/factories/${pick.node.id}`
                  : pick.kind === "Lab"
                    ? `/admin/labs/${pick.node.id}`
                    : pick.kind === "Distributor"
                      ? `/admin/distributors/${pick.node.id}`
                      : "#"
            }
            className="mt-3 block w-full text-center px-3 py-1.5 bg-[#00b4c3] text-white rounded text-xs font-bold hover:bg-[#009aa8]"
          >
            Open detail →
          </a>
        </div>
      )}

      <Canvas camera={{ position: [0, 0, 6], fov: 50 }} style={{ background: "#020617" }}>
        <Suspense fallback={null}>
          <Scene data={data} onPick={(node, kind) => setPick({ node, kind })} />
        </Suspense>
      </Canvas>
    </div>
  );
}
