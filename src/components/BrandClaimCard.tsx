"use client";

/**
 * <BrandClaimCard /> — Phase 15 IMP-1.
 *
 * Rendered on /brand-portal when user.brandId is null. Three paths:
 *   1) "I'm at <inferred>"  — server-side domain match, one-click
 *   2) "Find my brand"      — typeahead search over Brand.name
 *   3) "Request workspace"  — open a BrandWorkspaceRequest for admin
 *
 * Replaces the dead-end "no brand associated" empty screen.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface BrandLite {
  id: string;
  name: string;
  website: string | null;
  country?: string | null;
}

interface InferenceResponse {
  ok: boolean;
  brand: BrandLite | null;
  domain: string | null;
}

export default function BrandClaimCard() {
  const router = useRouter();
  const [inferred, setInferred] = useState<InferenceResponse | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BrandLite[]>([]);
  const [requestName, setRequestName] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; msg: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/brand-portal/infer-brand")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setInferred(j);
        if (j?.domain) setRequestName(`${j.domain.split(".")[0]}`.replace(/^./, (c: string) => c.toUpperCase()));
      })
      .catch(() => {
        if (!cancelled) setInferred({ ok: false, brand: null, domain: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/brand-portal/brand-search?q=${encodeURIComponent(query)}`);
        const j = await res.json();
        if (!cancelled && j.ok) setResults(j.brands || []);
      } catch {}
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  async function claimExisting(brandId: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/brand-portal/request-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ existingBrandId: brandId }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Claim failed");
      if (j.mode === "claimed") {
        // Hard reload so the AuthContext re-fetches with brandId set.
        window.location.href = "/brand-portal";
      } else {
        setFeedback({
          kind: "ok",
          msg: "Request submitted — an admin will confirm shortly.",
        });
      }
    } catch (e: any) {
      setFeedback({ kind: "error", msg: e?.message || "Failed" });
    } finally {
      setBusy(false);
    }
  }

  async function submitRequest() {
    if (!requestName.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/brand-portal/request-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestedBrandName: requestName.trim(),
          suggestedDomain: inferred?.domain || null,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setFeedback({
        kind: "ok",
        msg: "Request submitted — an admin will set up your workspace shortly.",
      });
    } catch (e: any) {
      setFeedback({ kind: "error", msg: e?.message || "Failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="rounded-2xl border-2 border-[#00b4c3] bg-gradient-to-br from-[#00b4c3]/5 to-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-[#00b4c3] mb-2">
          Welcome to FUZE Atlas
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
          Let's get you connected to your brand
        </h1>
        <p className="text-sm text-slate-700 mt-2">
          Pick the path that fits — we'll set up your workspace and get you to your
          supply chain dashboard.
        </p>

        {/* PATH 1: inferred */}
        {inferred?.brand && (
          <div className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Detected from your email domain
            </p>
            <p className="text-lg font-bold text-slate-900 mt-1">
              {inferred.brand.name}
              {inferred.brand.country && (
                <span className="text-sm font-normal text-slate-600"> · {inferred.brand.country}</span>
              )}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              We matched <span className="font-mono">{inferred.domain}</span> to this brand's site.
              One click and you're in.
            </p>
            <button
              onClick={() => claimExisting(inferred.brand!.id)}
              disabled={busy}
              className="mt-3 px-4 py-2 rounded bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 focus-ring"
            >
              {busy ? "…" : `I'm at ${inferred.brand.name} →`}
            </button>
          </div>
        )}

        {/* PATH 2: search */}
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Find my brand
          </p>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type your brand name…"
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus-ring"
          />
          {results.length > 0 && (
            <ul className="mt-2 rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 max-h-64 overflow-auto">
              {results.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => claimExisting(b.id)}
                    disabled={busy}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 focus-ring text-sm"
                  >
                    <span className="font-bold">{b.name}</span>
                    {b.country && (
                      <span className="text-slate-600"> · {b.country}</span>
                    )}
                    {b.website && (
                      <span className="block text-[11px] text-slate-500">{b.website}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-slate-500 mt-2">No matches for "{query}".</p>
          )}
        </div>

        {/* PATH 3: request new */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Don't see your brand?
          </p>
          <p className="text-sm text-slate-700 mt-1">
            Request a new workspace and an admin will set it up.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              placeholder="Brand name"
              className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus-ring"
            />
            <button
              onClick={submitRequest}
              disabled={busy || !requestName.trim()}
              className="px-4 py-2 rounded bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009aa8] disabled:opacity-50 focus-ring"
            >
              {busy ? "…" : "Request workspace"}
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-4 rounded-lg p-3 text-sm ${
              feedback.kind === "ok"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                : "bg-red-50 border border-red-200 text-red-900"
            }`}
          >
            {feedback.msg}
          </div>
        )}
      </div>
    </div>
  );
}
