/**
 * /verified/[publicSlug]/esg — Phase 12C public ESG snapshot listing.
 *
 * Server-rendered, 10min revalidate. 404 unless brand is publicEnabled.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerTranslations } from "@/i18n/server";

interface Snapshot {
  period: string;
  periodStart: string;
  periodEnd: string;
  fabricsCertified: number;
  testsRunCount: number;
  testsPassedCount: number;
  fuzeConsumedLiters: number;
  factoryCountActive: number;
  zeroPfasFabricCount: number;
  publicPdfUrl: string | null;
  publishedAt: string | null;
}

interface Payload {
  ok: boolean;
  brand: { name: string };
  snapshots: Snapshot[];
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://fuzeatlas.com";

export const revalidate = 600;

async function loadEsg(slug: string): Promise<Payload | null> {
  try {
    const res = await fetch(`${APP_URL}/api/public/verified/${slug}/esg`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j.ok ? (j as Payload) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicSlug: string }>;
}) {
  const { publicSlug } = await params;
  const data = await loadEsg(publicSlug);
  const T = (await getServerTranslations()).verifiedEsgPage;
  if (!data) return { title: T.metaTitleFallback };
  return {
    title: `${data.brand.name} ${T.metaTitleSuffix}`,
    description: `${T.metaDescPrefix} ${data.brand.name}, ${T.metaDescSuffix}`,
  };
}

export default async function EsgListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicSlug: string }>;
  searchParams?: Promise<{ lang?: string }>;
}) {
  const { publicSlug } = await params;
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.lang)).verifiedEsgPage;
  const data = await loadEsg(publicSlug);
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-br from-[#00b4c3] to-[#009ba8] text-white px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-xs uppercase tracking-wider opacity-80 mb-1">
            <Link href={`/verified/${publicSlug}`} className="hover:underline">
              {T.backArrowPrefix} {data.brand.name}
            </Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black">
            {data.brand.name} {T.headingSuffix}
          </h1>
          <p className="mt-2 text-white/90">
            {T.heroSubtitle}
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-12">
        {data.snapshots.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-slate-500">
              {T.emptyBody}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.snapshots.map((s) => {
              const passRate =
                s.testsRunCount > 0 ? s.testsPassedCount / s.testsRunCount : null;
              return (
                <div
                  key={s.period}
                  className="rounded-xl border border-slate-200 bg-white p-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                    <h2 className="text-xl font-black text-slate-900">
                      {s.period}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {new Date(s.periodStart).toLocaleDateString()} –{" "}
                      {new Date(s.periodEnd).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <Stat label={T.statFabricsCertified} value={s.fabricsCertified} />
                    <Stat
                      label={T.statTestsPassed}
                      value={`${s.testsPassedCount}/${s.testsRunCount}`}
                    />
                    <Stat label={T.statFuzeLiters} value={s.fuzeConsumedLiters.toFixed(0)} />
                    <Stat label={T.statFactories} value={s.factoryCountActive} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    {passRate != null && (
                      <p>{T.passRateLabel} <b>{(passRate * 100).toFixed(1)}%</b></p>
                    )}
                    {s.publicPdfUrl && (
                      <a
                        href={s.publicPdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#00b4c3] font-bold hover:underline"
                      >
                        {T.downloadPdf}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <footer className="max-w-4xl mx-auto px-6 py-8 text-xs text-slate-500 text-center border-t border-slate-200">
        {T.footerCertifiedBy}
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
        {label}
      </p>
      <p className="text-2xl font-black text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
