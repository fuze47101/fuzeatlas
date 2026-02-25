// src/app/fabrics/[id]/page.tsx
import Link from "next/link";

type Fabric = {
  id: string;
  fuzeFabricNumber?: number | null;
  construction?: string | null;
  color?: string | null;
  widthInches?: number | null;
  weightGsm?: number | null;
  raw?: any;
  contents?: { material: string; percent?: number | null; rawText?: string | null }[];
  submissions?: any[];
};

async function getFabric(id: string): Promise<Fabric | null> {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(`${base}/api/fabrics?id=${encodeURIComponent(id)}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

export default async function FabricDetailPage({ params }: { params: { id: string } }) {
  const fabric = await getFabric(params.id);

  if (!fabric) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Fabric not found</h1>
        <p>
          <Link href="/">← Back</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/">← Back to search</Link>
      </p>

      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
        FUZE {fabric.fuzeFabricNumber ?? "—"}
      </h1>

      <div style={{ marginBottom: 16, opacity: 0.85 }}>
        <div>Construction: {fabric.construction ?? "—"}</div>
        <div>Color: {fabric.color ?? "—"}</div>
        <div>Width (in): {fabric.widthInches ?? "—"}</div>
        <div>Weight (gsm): {fabric.weightGsm ?? "—"}</div>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>Contents</h2>
      <ul>
        {(fabric.contents || []).map((c, i) => (
          <li key={i}>
            {c.material}
            {c.percent != null ? ` — ${c.percent}%` : ""}
            {c.rawText ? ` (${c.rawText})` : ""}
          </li>
        ))}
        {(fabric.contents || []).length === 0 && <li>—</li>}
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24 }}>Raw</h2>
      <pre style={{ whiteSpace: "pre-wrap", background: "#111", color: "#eee", padding: 12, borderRadius: 8 }}>
        {JSON.stringify(fabric.raw ?? {}, null, 2)}
      </pre>
    </div>
  );
}