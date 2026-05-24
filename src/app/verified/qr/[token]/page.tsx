/**
 * /verified/qr/[token] — Phase 12B public hangtag landing.
 *
 * No auth. Increments scan count + renders product verification.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerTranslations } from "@/i18n/server";

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
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.lang)).verifiedQrPage;
  const data = await loadQr(token);
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#00b4c3] to-[#009ba8] text-white px-6 py-12 sm:py-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-bold uppercase tracking-wider mb-3">
          {T.verifiedBadge}
        </div>
        <h1 className="text-3xl sm:text-4xl font-black">{data.brand.name}</h1>
        {data.tier && (
          <p className="mt-2 text-sm text-white/90">
            {T.tierPrefix} <span className="font-bold">{data.tier}</span>
          </p>
        )}
      </section>

      {/* Product info */}
      <section className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3">
            {T.productSectionTitle}
          </h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            {data.product.sku && (
              <>
                <dt className="text-slate-500">{T.skuLabel}</dt>
                <dd className="text-right font-mono">{data.product.sku}</dd>
              </>
            )}
            {data.product.batchCode && (
              <>
                <dt className="text-slate-500">{T.batchLabel}</dt>
                <dd className="text-right font-mono">{data.product.batchCode}</dd>
              </>
            )}
            {data.fabric?.fuzeNumber && (
              <>
                <dt className="text-slate-500">{T.fuzeNumberLabel}</dt>
                <dd className="text-right font-mono">FUZE-{data.fabric.fuzeNumber}</dd>
              </>
            )}
            {data.fabric?.construction && (
              <>
                <dt className="text-slate-500">{T.constructionLabel}</dt>
                <dd className="text-right">{data.fabric.construction}</dd>
              </>
            )}
            {data.fabric?.weightGsm && (
              <>
                <dt className="text-slate-500">{T.weightLabel}</dt>
                <dd className="text-right">{data.fabric.weightGsm} {T.weightUnit}</dd>
              </>
            )}
          </dl>
        </div>

        {data.mostRecentTest && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
            <h2 className="text-xs uppercase tracking-wider text-emerald-800 font-bold mb-3">
              {T.mostRecentValidation}
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
              {T.testedPrefix} {new Date(data.mostRecentTest.date).toLocaleDateString()}
              {data.mostRecentTest.washCount != null && (
                <> · {T.afterWashesPrefix} {data.mostRecentTest.washCount} {T.afterWashesSuffix}</>
              )}
            </p>
          </div>
        )}

        <details className="rounded-xl border border-slate-200 bg-white p-5">
          <summary className="cursor-pointer font-bold text-slate-900">
            {T.whatDoesThisMean}
          </summary>
          <div className="mt-3 text-sm text-slate-700 space-y-2">
            <p>{T.explainerP1}</p>
            <p>{T.explainerP2}</p>
            <p>
              <strong>{T.certificationsLabel}</strong> {T.certificationsBody}
            </p>
          </div>
        </details>

        {data.sustainability.fuzeLitersConsumed != null && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
            <h2 className="text-xs uppercase tracking-wider text-indigo-800 font-bold mb-2">
              {T.sustainabilityTitle}
            </h2>
            <p className="text-sm text-slate-700">
              <span className="font-black text-2xl text-indigo-900">
                {data.sustainability.fuzeLitersConsumed.toFixed(1)}L
              </span>
              <span className="ml-2">{T.sustainabilityBody}</span>
            </p>
          </div>
        )}

        <div className="text-center pt-2">
          {data.brand.publicSlug ? (
            <Link
              href={`/verified/${data.brand.publicSlug}`}
              className="text-sm text-[#00b4c3] font-bold hover:underline"
            >
              {T.seeMorePrefix} {data.brand.name} {T.seeMoreSuffix}
            </Link>
          ) : (
            <Link
              href="/claims"
              className="text-sm text-[#00b4c3] font-bold hover:underline"
            >
              {T.learnMoreLink}
            </Link>
          )}
        </div>
      </section>

      <footer className="max-w-2xl mx-auto px-6 py-6 text-center text-xs text-slate-500">
        <p>
          {T.footerVerifiedBy} ·{" "}
          <a href="https://fuzeatlas.com" className="hover:underline">
            fuzeatlas.com
          </a>
        </p>
      </footer>
    </div>
  );
}
