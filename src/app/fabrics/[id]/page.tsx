export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function getFabric(id: string) {
  // Use relative fetch so it works on Vercel too
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/fabrics/${id}`, {
    cache: "no-store",
  });

  // If NEXT_PUBLIC_BASE_URL isn't set in dev, fall back to localhost
  if (!res.ok && !process.env.NEXT_PUBLIC_BASE_URL) {
    const res2 = await fetch(`http://localhost:3000/api/fabrics/${id}`, { cache: "no-store" });
    return res2.json();
  }

  return res.json();
}

export default async function FabricDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getFabric(id);

  if (!data?.ok) {
    return (
      <div style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Fabric</h1>
        <div style={{ opacity: 0.8 }}>Not found.</div>
        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>id: {id}</div>
      </div>
    );
  }

  const f = data.item;

  return (
    <div style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Fabric</h1>
        <div style={{ fontSize: 12, opacity: 0.6 }}>{f.id}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Core</div>
          <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
            <div><b>Construction:</b> {f.construction ?? "—"}</div>
            <div><b>Color:</b> {f.color ?? "—"}</div>
            <div><b>Width (in):</b> {f.widthInches ?? "—"}</div>
            <div><b>Weight (gsm):</b> {f.weightGsm ?? "—"}</div>
          </div>
        </div>

        <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Contents</div>
          {f.contents?.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {f.contents.map((c: any) => (
                <span
                  key={c.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                    background: "white",
                  }}
                >
                  {c.material}
                  {c.percent !== null && c.percent !== undefined ? ` ${c.percent}%` : ""}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.75 }}>—</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #e5e5e5", borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Submissions</div>
        {f.submissions?.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {f.submissions.map((s: any) => (
              <div key={s.id} style={{ borderTop: "1px solid #f0f0f0", paddingTop: 10 }}>
                <div style={{ fontWeight: 800 }}>
                  {s.fuzeFabricNumber !== null && s.fuzeFabricNumber !== undefined ? `FUZE ${s.fuzeFabricNumber}` : "—"}
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  {s.customerFabricCode ? `Cust: ${s.customerFabricCode}` : ""}
                  {s.customerFabricCode && s.factoryFabricCode ? " • " : ""}
                  {s.factoryFabricCode ? `Factory: ${s.factoryFabricCode}` : ""}
                </div>
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                  {s.applicationMethod ?? "—"}
                  {s.treatmentLocation ? ` • ${s.treatmentLocation}` : ""}
                  {s.applicationDate ? ` • ${new Date(s.applicationDate).toLocaleDateString()}` : ""}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  {s.brand?.name ? `Brand: ${s.brand.name}` : ""}
                  {s.brand?.name && s.factory?.name ? " • " : ""}
                  {s.factory?.name ? `Factory: ${s.factory.name}` : ""}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ opacity: 0.75 }}>—</div>
        )}
      </div>

      <div style={{ marginTop: 16, border: "1px solid #e5e5e5", borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Raw</div>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, margin: 0, opacity: 0.9 }}>
{JSON.stringify(f.raw ?? {}, null, 2)}
        </pre>
      </div>
    </div>
  );
}
