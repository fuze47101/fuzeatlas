"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const input = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box" as const,
};

const label = {
  display: "block",
  fontSize: 12,
  fontWeight: 700 as const,
  opacity: 0.7,
  marginBottom: 6,
  textTransform: "uppercase" as const,
  letterSpacing: 0.3,
};

export default function NewFabricPage() {
  const router = useRouter();

  const [construction, setConstruction] = useState("");
  const [color, setColor] = useState("");
  const [widthInches, setWidthInches] = useState("");
  const [weightGsm, setWeightGsm] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // At least one meaningful field required
    if (!construction && !color && !widthInches && !weightGsm) {
      setError("Please fill in at least one field.");
      return;
    }

    setLoading(true);

    const body: Record<string, string | number> = {};
    if (construction) body.construction = construction;
    if (color) body.color = color;
    if (widthInches && !isNaN(parseFloat(widthInches))) body.widthInches = parseFloat(widthInches);
    if (weightGsm && !isNaN(parseFloat(weightGsm))) body.weightGsm = parseFloat(weightGsm);

    const res = await fetch("/api/fabrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (res.ok) {
      const data = await res.json();
      const id = data.fabric?.id;
      if (id) {
        router.push(`/fabrics/${id}`);
      } else {
        router.push("/");
      }
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create fabric. Check that fields are valid.");
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/"
          style={{ fontSize: 13, opacity: 0.6, textDecoration: "none", color: "inherit", fontWeight: 700 }}
        >
          ← Back to Fabrics
        </Link>
      </div>

      <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5, marginBottom: 6 }}>
        New Fabric
      </div>
      <div style={{ fontSize: 14, opacity: 0.6, marginBottom: 24 }}>
        Creates a blank fabric record. You can add submissions and test results from the detail view.
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <div style={label}>Construction</div>
          <input
            style={input}
            value={construction}
            onChange={(e) => setConstruction(e.target.value)}
            placeholder='e.g. "Knit", "Woven", "Non-woven"'
          />
        </div>

        <div>
          <div style={label}>Color</div>
          <input
            style={input}
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder='e.g. "White", "Black", "Natural"'
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <div style={label}>Width (inches)</div>
            <input
              style={input}
              type="number"
              min={0}
              step="0.01"
              value={widthInches}
              onChange={(e) => setWidthInches(e.target.value)}
              placeholder="e.g. 58"
            />
          </div>
          <div>
            <div style={label}>Weight (GSM)</div>
            <input
              style={input}
              type="number"
              min={0}
              step="0.1"
              value={weightGsm}
              onChange={(e) => setWeightGsm(e.target.value)}
              placeholder="e.g. 180"
            />
          </div>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #f2c1c1", background: "#fff6f6", color: "#c0392b", fontWeight: 700, fontSize: 14 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 20px",
            borderRadius: 12,
            border: "none",
            background: loading ? "#ccc" : "#1a1a1a",
            color: "white",
            fontWeight: 900,
            fontSize: 15,
            cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: 0.2,
          }}
        >
          {loading ? "Creating…" : "Create Fabric →"}
        </button>
      </form>
    </div>
  );
}
