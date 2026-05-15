"use client";

/**
 * <DocumentRepository /> — Phase 15 IMP-5.
 *
 * Drop-in unified document view per portal. Self-fetches from
 * `apiPath` (e.g. /api/brand-portal/documents) and renders a
 * 4-tab grid: Compliance · Testing · Commercial · Operations.
 * Search box filters within the active category.
 *
 * Compliance tab also gets the "Generate trust pack" button (the
 * server-side ZIP composer; stub returns 501 until wired).
 */
import { useEffect, useMemo, useState } from "react";

interface Row {
  id: string;
  kind: string;
  category: "compliance" | "testing" | "commercial" | "operations";
  title: string;
  sourceEntity: { kind: string; id: string | null; name: string } | null;
  fileUrl: string | null;
  createdAt: string | null;
}

type Cat = "compliance" | "testing" | "commercial" | "operations";

const TABS: { id: Cat; label: string; icon: string; blurb: string }[] = [
  {
    id: "compliance",
    label: "Compliance",
    icon: "📜",
    blurb: "EPA, OEKO-TEX, bluesign, PFAS-free, SDS — the public trust pack.",
  },
  {
    id: "testing",
    label: "Testing",
    icon: "🧪",
    blurb: "ICP, antibacterial, antifungal, antiviral, odor test reports.",
  },
  {
    id: "commercial",
    label: "Commercial",
    icon: "💼",
    blurb: "Invoices, POs, pricing sheets, contracts.",
  },
  {
    id: "operations",
    label: "Operations",
    icon: "⚙️",
    blurb: "Brand protocols, recipe cards, application guides.",
  },
];

export default function DocumentRepository({
  apiPath,
  trustPackPath,
}: {
  apiPath: string;
  trustPackPath?: string;
}) {
  const [tab, setTab] = useState<Cat>("compliance");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trustPackBusy, setTrustPackBusy] = useState(false);
  const [trustPackFeedback, setTrustPackFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiPath)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.ok) setRows(j.documents || []);
        else setError(j.error || "Failed");
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [apiPath]);

  const filtered = useMemo(() => {
    const lowered = q.trim().toLowerCase();
    return rows
      .filter((r) => r.category === tab)
      .filter(
        (r) =>
          !lowered ||
          r.title.toLowerCase().includes(lowered) ||
          r.kind.toLowerCase().includes(lowered) ||
          (r.sourceEntity?.name || "").toLowerCase().includes(lowered),
      );
  }, [rows, tab, q]);

  const tabCounts = useMemo(() => {
    const c: Record<Cat, number> = { compliance: 0, testing: 0, commercial: 0, operations: 0 };
    for (const r of rows) c[r.category]++;
    return c;
  }, [rows]);

  async function downloadTrustPack() {
    if (!trustPackPath) return;
    setTrustPackBusy(true);
    setTrustPackFeedback(null);
    try {
      const res = await fetch(trustPackPath, { method: "POST" });
      if (res.status === 501) {
        const j = await res.json().catch(() => null);
        setTrustPackFeedback(j?.message || "Trust pack composer not yet provisioned.");
      } else if (!res.ok) {
        const j = await res.json().catch(() => null);
        setTrustPackFeedback(j?.error || `Failed (${res.status}).`);
      } else {
        // BONUS-2 — server returns a print-ready HTML document. Open in
        // a new tab so the user can Ctrl-P / Cmd-P → Save as PDF. Same
        // flow the sustainability report uses.
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          const html = await res.text();
          const blob = new Blob([html], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
          setTrustPackFeedback(
            "Trust pack opened in a new tab. Use Ctrl/Cmd + P → Save as PDF.",
          );
        } else {
          // Future: server returns a ZIP. Keep the download path alive
          // so a different backend implementation works without a
          // frontend change.
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `fuze-trust-pack-${new Date().toISOString().slice(0, 10)}`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (e: any) {
      setTrustPackFeedback(e?.message || "Failed");
    } finally {
      setTrustPackBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div role="tablist" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase focus-ring transition-all ${
                tab === t.id
                  ? "bg-[#00b4c3] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
              <span className="ml-2 text-[10px] font-normal opacity-80">{tabCounts[t.id]}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search documents…"
          className="w-full sm:w-64 px-3 py-2 border border-slate-300 rounded text-sm focus-ring"
        />
      </div>

      <p className="text-xs text-slate-600 mb-3">
        {TABS.find((t) => t.id === tab)?.blurb}
      </p>

      {tab === "compliance" && trustPackPath && (
        <div className="mb-4 rounded-xl border border-[#00b4c3] bg-[#00b4c3]/5 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-slate-900">Trust pack</p>
            <p className="text-xs text-slate-600 mt-0.5">
              EPA + California EPA + OEKO-TEX + bluesign + PFAS attestation + SDS, in one ZIP.
            </p>
          </div>
          <div className="text-right">
            <button
              onClick={downloadTrustPack}
              disabled={trustPackBusy}
              className="px-3 py-1.5 rounded bg-[#00b4c3] text-white text-xs font-bold hover:bg-[#009aa8] disabled:opacity-50 focus-ring"
            >
              {trustPackBusy ? "Building…" : "Generate trust pack"}
            </button>
            {trustPackFeedback && (
              <p className="text-[11px] text-slate-600 mt-1 max-w-[18rem]">{trustPackFeedback}</p>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : error ? (
        <p className="text-red-700 text-sm">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          <p className="text-3xl mb-2" aria-hidden="true">📭</p>
          <p className="font-bold text-slate-900">No documents in this category</p>
          <p className="text-sm mt-1">
            Try a different category or clear the search.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {filtered.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 p-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{r.title}</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold uppercase mr-2">
                    {r.kind}
                  </span>
                  {r.sourceEntity && <span>{r.sourceEntity.name}</span>}
                  {r.createdAt && (
                    <span className="ml-2 text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>
              {r.fileUrl ? (
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={r.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-[#00b4c3] hover:underline focus-ring rounded px-1"
                  >
                    View
                  </a>
                  <a
                    href={r.fileUrl}
                    download
                    className="text-xs font-bold text-slate-700 hover:underline focus-ring rounded px-1"
                  >
                    Download
                  </a>
                </div>
              ) : (
                <span className="text-[11px] text-slate-500 shrink-0">Restricted</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
