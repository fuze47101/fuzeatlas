import Link from "next/link";

type Fabric = {
  id: string;
  fuzeFabricNumber?: number | null;
  customerFabricCode?: string | null;
  factoryFabricCode?: string | null;
  construction?: string | null;
  color?: string | null;
  widthInches?: number | null;
  weightGsm?: number | null;
  applicationMethod?: string | null;
  applicationDate?: string | null;
  treatmentLocation?: string | null;
  contents?: { material: string; percent?: number | null; rawText?: string | null }[];
  raw?: any;
};

async function getFabric(id: string): Promise<Fabric | null> {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(`${base}/api/fabrics?id=${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function FabricDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fabric = await getFabric(id);

  if (!fabric) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Fabric not found</h1>
        <p><Link href="/">← Back</Link></p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/">← Back to search</Link>
      </p>

      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
        FUZE {fabric.fuzeFabricNumber ?? "—"}
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
        <div><b>Customer Code:</b> {fabric.customerFabricCode ?? "—"}</div>
        <div><b>Factory Code:</b> {fabric.factoryFabricCode ?? "—"}</div>
        <div><b>Construction:</b> {fabric.construction ?? "—"}</div>
        <div><b>Color:</b> {fabric.color ?? "—"}</div>
        <div><b>Width (in):</b> {fabric.widthInches ?? "—"}</div>
        <div><b>Weight (gsm):</b> {fabric.weightGsm ?? "—"}</div>
        <div><b>Method:</b> {fabric.applicationMethod ?? "—"}</div>
        <div><b>Date:</b> {fabric.applicationDate ?? "—"}</div>
        <div style={{ gridColumn: "1 / -1" }}><b>Location:</b> {fabric.treatmentLocation ?? "—"}</div>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 24 }}>Contents</h2>
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

      <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 24 }}>Raw row</h2>
      <pre style={{ whiteSpace: "pre-wrap", background: "#111", color: "#eee", padding: 12, borderRadius: 10 }}>
        {JSON.stringify(fabric.raw ?? {}, null, 2)}
      </pre>
    </div>
  );
}
