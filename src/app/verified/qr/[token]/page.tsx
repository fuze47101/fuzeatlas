/**
 * /verified/qr/[token] — Phase 12B public hangtag landing.
 *
 * No auth. Increments scan count + renders product verification.
 */
import { notFound } from "next/navigation";
import Link from "next/link";

interface QrPayload {
  ok: boolean;
  brand: { name: string; publicSlug: string | null };
  product: { sku: string | null; batchCode: string | null; printedAt: string | null };
  fabric: { fuzeNumber: number | null; construction: string | null; weightGsm: number | null; category: string | null } | null;
  tier: string | null;
  mostRecentTest: {
    type: string;
    method: string | null;
    date: string;
    washCount: number | null;
    result: string;
  } | null;
  sustainability: { fuzeLitersConsumed: number | null };
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://fuzeatlas.com";

async function loadQr(token: string): Promise<QrPayload | null> {
  try {
    const res = await fetch(`${APP_URL}/api/public/qr/${token}`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    return j.ok ? (j as QrPayload) : null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic"; // scan-counter requires fresh hit

export default async function HangtagVerificationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await loadQr(token);
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#00b4c3] to-[#009ba8] text-white px-6 py-12 sm:py-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-bold uppercase tracking-wider mb-3">
          ✓ Verified FUZE-treated
        </div>
        <h1 className="text-3xl sm:text-4xl font-black">{data.brand.name}</h1>
        {data.tier && (
          <p className="mt-2 text-sm text-white/90">
            FUZE tier <span className="font-bold">{data.tier}</span>
          </p>
        )}
      </section>

      {/* Product info */}
      <section className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3">
            Product
          </h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            {data.product.sku && (
              <>
                <dt className="text-slate-500">SKU</dt>
                <dd className="text-right font-mono">{data.product.sku}</dd>
              </>
            )}
            {data.product.batchCode && (
              <>
                <dt className="text-slate-500">Batch</dt>
                <dd className="text-right font-mono">{data.product.batchCode}</dd>
              </>
            )}
            {data.fabric?.fuzeNumber && (
              <>
                <dt className="text-slate-500">FUZE #</dt>
                <dd className="text-right font-mono">FUZE-{data.fabric.fuzeNumber}</dd>
              </>
            )}
            {data.fabric?.construction && (
              <>
                <dt className="text-slate-500">Construction</dt>
                <dd className="text-right">{data.fabric.construction}</dd>
              </>
            )}
            {data.fabric?.weightGsm && (
              <>
                <dt className="text-slate-500">Weight</dt>
                <dd className="text-right">{data.fabric.weightGsm} GSM</dd>
              </>
            )}
          </dl>
        </div>

        {data.mostRecentTest && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
            <h2 className="text-xs uppercase tracking-wider text-emerald-800 font-bold mb-3">
              Most recent validation
            </h2>
            <p className="text-sm">
              <span className="font-bold text-slate-900">{data.mostRecentTest.type}</span>
              {data.mostRecentTest.method && (
                <span className="text-slate-600"> · {data.mostRecentTest.method}</span>
              )}
            </p>
            <p className="text-2xl font-black text-emerald-800 mt-1">
              {data.mostRecentTest.result}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Tested {new Date(data.mostRecentTest.date).toLocaleDateString()}
              {data.mostRecentTest.washCount != null && (
                <> · after {data.mostRecentTest.washCount} washes</>
              )}
            </p>
          </div>
        )}

        <details className="rounded-xl border border-slate-200 bg-white p-5">
          <summary className="cursor-pointer font-bold text-slate-900">
            What does this mean?
          </summary>
          <div className="mt-3 text-sm text-slate-700 space-y-2">
            <p>
              FUZE is a proprietary antimicrobial textile treatment. The FUZE
              metamaterial bonds permanently to the fiber surface during
              standard textile finishing — no leaching, no PFAS, no chemistry
              change to the fabric's hand or breathability.
            </p>
            <p>
              Bacterial reduction happens through direct contact with the bonded
              metamaterial — that's why FUZE leads with ASTM E2149 (the
              contact-kill test designed for non-leaching antimicrobials),
              alongside AATCC 100 for layered geometry validation.
            </p>
            <p>
              <strong>Certifications:</strong> OEKO-TEX Standard 100 Class I,
              bluesign® approved, EPA registered, California EPA approved
              (Q1 2026), PFAS-free.
            </p>
          </div>
        </details>

        {data.sustainability.fuzeLitersConsumed != null && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
            <h2 className="text-xs uppercase tracking-wider text-indigo-800 font-bold mb-2">
              Sustainability
            </h2>
            <p className="text-sm text-slate-700">
              <span className="font-black text-2xl text-indigo-900">
                {data.sustainability.fuzeLitersConsumed.toFixed(1)}L
              </span>
              <span className="ml-2">FUZE consumed across this fabric to date.</span>
            </p>
          </div>
        )}

        <div className="text-center pt-2">
          {data.brand.publicSlug ? (
            <Link
              href={`/verified/${data.brand.publicSlug}`}
              className="text-sm text-[#00b4c3] font-bold hover:underline"
            >
              See more {data.brand.name} certified products →
            </Link>
          ) : (
            <Link
              href="/claims"
              className="text-sm text-[#00b4c3] font-bold hover:underline"
            >
              Learn more about FUZE technology →
            </Link>
          )}
        </div>
      </section>

      <footer className="max-w-2xl mx-auto px-6 py-6 text-center text-xs text-slate-500">
        <p>
          Verified by FUZE Atlas ·{" "}
          <a href="https://fuzeatlas.com" className="hover:underline">
            fuzeatlas.com
          </a>
        </p>
      </footer>
    </div>
  );
}
