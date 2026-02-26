"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function FabricDetailPage() {
  const { id } = useParams();
  const [fabric, setFabric] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/fabrics/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.item) {
          setFabric(data.item);
        } else {
          setError("Fabric not found.");
        }
      })
      .catch(() => setError("Failed to load fabric."));
  }, [id]);

  if (error) return <div style={{ padding: 32, color: "red" }}>{error}</div>;
  if (!fabric) return <div style={{ padding: 32 }}>Loading...</div>;

  const contentsStr = fabric.contents
    ?.map((c: any) => `${c.material}${c.percent ? ` ${c.percent}%` : ""}`)
    .join(", ");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px", fontFamily: "sans-serif" }}>
      {/* Back */}
      <Link href="/" style={{ color: "#0066cc", textDecoration: "none", fontSize: 14 }}>
        ← Back to list
      </Link>

      {/* Fabric Header */}
      <h1 style={{ marginTop: 16, marginBottom: 4, fontSize: 24, fontWeight: 700 }}>
        Fabric Detail
      </h1>

      <div style={{ background: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: 8, padding: 20, marginTop: 16, marginBottom: 32 }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            {[
              ["Construction", fabric.construction],
              ["Color", fabric.color],
              ["Width (inches)", fabric.widthInches],
              ["Weight (GSM)", fabric.weightGsm],
              ["Contents", contentsStr || "—"],
            ].map(([label, value]) => (
              <tr key={label as string}>
                <td style={{ padding: "6px 16px 6px 0", fontWeight: 600, color: "#555", width: 160, verticalAlign: "top" }}>
                  {label}
                </td>
                <td style={{ padding: "6px 0", color: "#222" }}>
                  {(value as any) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Submissions */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
        Submissions ({fabric.submissions?.length ?? 0})
      </h2>

      {(!fabric.submissions || fabric.submissions.length === 0) && (
        <p style={{ color: "#666" }}>No submissions yet.</p>
      )}

      {fabric.submissions?.map((sub: any) => (
        <div key={sub.id} style={{ border: "1px solid #dee2e6", borderRadius: 8, marginBottom: 24, overflow: "hidden" }}>
          {/* Submission Header */}
          <div style={{ background: "#343a40", color: "#fff", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              {sub.fuzeFabricNumber ? `FUZE ${sub.fuzeFabricNumber}` : "Submission"}
            </span>
            <span style={{ fontSize: 13, opacity: 0.8 }}>
              {sub.brand?.name ?? ""}{sub.factory?.name ? ` · ${sub.factory.name}` : ""}
            </span>
          </div>

          {/* Submission Details */}
          <div style={{ padding: "16px 20px", background: "#fff" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", marginBottom: 16 }}>
              {[
                ["Customer Code", sub.customerFabricCode],
                ["Factory Code", sub.factoryFabricCode],
                ["Application", sub.applicationMethod],
                ["App Date", sub.applicationDate ? new Date(sub.applicationDate).toLocaleDateString() : null],
                ["Wash Target", sub.washTarget ? `${sub.washTarget} washes` : null],
                ["Program", sub.programName],
                ["Category", sub.category],
                ["Treatment Location", sub.treatmentLocation],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase" }}>{label}</span>
                  <div style={{ fontSize: 14, color: "#222", marginTop: 2 }}>{(value as any) ?? "—"}</div>
                </div>
              ))}
            </div>

            {/* Status Flags */}
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid #eee", fontSize: 13 }}>
              <div>
                <strong>ICP:</strong>{" "}
                {sub.icpSent ? "✓ Sent" : "Not sent"} →{" "}
                {sub.icpReceived ? "✓ Received" : "Pending"} →{" "}
                <PassBadge value={sub.icpPassed} />
              </div>
              <div>
                <strong>AB:</strong>{" "}
                {sub.abSent ? "✓ Sent" : "Not sent"} →{" "}
                {sub.abReceived ? "✓ Received" : "Pending"} →{" "}
                <PassBadge value={sub.abPassed} />
              </div>
            </div>
          </div>

          {/* Test Runs */}
          {sub.testRuns?.length > 0 && (
            <div style={{ borderTop: "1px solid #dee2e6", padding: "16px 20px", background: "#fafafa" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#444" }}>
                Test Runs ({sub.testRuns.length})
              </h4>
              {sub.testRuns.map((run: any) => (
                <div key={run.id} style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 6, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{run.testType}</span>
                    <span style={{ fontSize: 12, color: "#666" }}>
                      {run.lab?.name ?? ""}
                      {run.testDate ? ` · ${new Date(run.testDate).toLocaleDateString()}` : ""}
                      {run.washCount != null ? ` · ${run.washCount} washes` : ""}
                    </span>
                  </div>
                  {run.icpResult && (
                    <div style={{ fontSize: 13 }}>
                      <strong>ICP:</strong> Ag = {run.icpResult.agValue ?? "—"} {run.icpResult.unit ?? ""}
                      {run.icpResult.auValue != null ? ` · Au = ${run.icpResult.auValue} ${run.icpResult.unit ?? ""}` : ""}
                    </div>
                  )}
                  {run.abResult && (
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      <strong>AB:</strong> {run.abResult.organism1 ?? ""}: {run.abResult.result1 ?? "—"}
                      {run.abResult.organism2 ? ` · ${run.abResult.organism2}: ${run.abResult.result2 ?? "—"}` : ""}
                      {" · "}<PassBadge value={run.abResult.pass} />
                    </div>
                  )}
                  {run.testReportNumber && (
                    <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                      Report: {run.testReportNumber}{run.testMethodStd ? ` · Method: ${run.testMethodStd}` : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PassBadge({ value }: { value: boolean | null }) {
  if (value === null || value === undefined) return <span style={{ color: "#999" }}>—</span>;
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
      background: value ? "#d4edda" : "#f8d7da",
      color: value ? "#155724" : "#721c24",
    }}>
      {value ? "PASS" : "FAIL"}
    </span>
  );
}
