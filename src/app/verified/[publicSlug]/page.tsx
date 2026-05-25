/**
 * /verified/[publicSlug] — Phase 12A public brand storefront.
 *
 * No auth. Renders 404 unless the brand profile is publicEnabled
 * AND has at least one brand-approved test result.
 *
 * Server-rendered. The API does the gating; this page just calls it
 * server-side and renders. Cached at the edge for 5 minutes.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicPageBeacon from "@/components/PublicPageBeacon";
import { getServerTranslations } from "@/i18n/server";

interface ActiveTier {
  tier: string;
  lastPassedAt: string;
}

interface StorefrontPayload {
  ok: boolean;
  brand: {
    name: string;
    website: string | null;
    country: string | null;
    textileCategory: string | null;
  };
  profile: {
    logoUrl: string | null;
    primaryColor: string | null;
    heroHeadline: string;
    heroSubhead: string;
    supportEmail: string | null;
  };
  stats: {
    fabricsCertified: number;
    testsPassed12mo: number;
    countriesShipping: number;
  };
  activeTiers: ActiveTier[];
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://fuzeatlas.com";

async function loadStorefront(slug: string): Promise<StorefrontPayload | null> {
  try {
    const res = await fetch(`${APP_URL}/api/public/verified/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j.ok) return null;
    return j as StorefrontPayload;
  } catch {
    return null;
  }
}

const TIER_DETAILS: Record<string, { name: string; washes: number; concentration: string }> = {
  F1: { name: "Full Spectrum", washes: 100, concentration: "1.0 mg/kg" },
  F2: { name: "Advanced", washes: 75, concentration: "0.75 mg/kg" },
  F3: { name: "Core", washes: 50, concentration: "0.5 mg/kg" },
  F4: { name: "Foundation", washes: 25, concentration: "0.25 mg/kg" },
};

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicSlug: string }>;
}) {
  const { publicSlug } = await params;
  const data = await loadStorefront(publicSlug);
  if (!data) return { title: "Verified — FUZE Atlas" };
  return {
    title: `${data.brand.name} — Verified FUZE Certified`,
    description: data.profile.heroSubhead,
    openGraph: {
      title: `${data.brand.name} × FUZE`,
      description: data.profile.heroSubhead,
      images: data.profile.logoUrl ? [data.profile.logoUrl] : undefined,
    },
  };
}

export default async function VerifiedStorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicSlug: string }>;
  searchParams?: Promise<{ lang?: string; locale?: string }>;
}) {
  const { publicSlug } = await params;
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.locale || sp.lang)).publicVerifiedPage;
  const data = await loadStorefront(publicSlug);
  if (!data) notFound();

  const primary = data.profile.primaryColor || "#00b4c3";

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicPageBeacon path={`/verified/${publicSlug}`} />
      {/* Hero */}
      <section
        className="relative px-6 py-20 sm:py-28"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, #009ba8 100%)`,
        }}
      >
        <div className="max-w-5xl mx-auto text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-bold uppercase tracking-wider mb-4">
            {T.certifiedBadge}
          </div>
          {data.profile.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.profile.logoUrl}
              alt={`${data.brand.name} logo`}
              className="h-16 mb-4 bg-white/10 rounded-lg p-2"
            />
          )}
          <h1 className="text-4xl sm:text-5xl font-black mb-3">
            {data.profile.heroHeadline}
          </h1>
          <p className="text-lg text-white/90 max-w-2xl">
            {data.profile.heroSubhead}
          </p>
        </div>
      </section>

      {/* Live stats */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label={T.statFabricsCertified} value={data.stats.fabricsCertified} />
          <StatCard
            label={T.statTestsPassed}
            value={data.stats.testsPassed12mo}
          />
          <StatCard
            label={T.statCountries}
            value={data.stats.countriesShipping}
          />
        </div>
      </section>

      {/* Active tier badges */}
      {data.activeTiers.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 pb-12">
          <h2 className="text-2xl font-black text-slate-900 mb-1">
            {T.activeTiersTitle}
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            {T.activeTiersBody}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {data.activeTiers.map((t) => {
              const meta = TIER_DETAILS[t.tier];
              return (
                <div
                  key={t.tier}
                  className="rounded-xl border-2 border-slate-200 bg-white p-5"
                  style={{ borderColor: `${primary}33` }}
                >
                  <div
                    className="text-3xl font-black"
                    style={{ color: primary }}
                  >
                    {t.tier}
                  </div>
                  <p className="text-sm font-bold text-slate-900 mt-1">
                    {meta?.name || ""}
                  </p>
                  {meta && (
                    <p className="text-xs text-slate-600 mt-1">
                      {meta.washes} washes · {meta.concentration}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-2">
                    {T.lastPassedLabel}{" "}
                    {new Date(t.lastPassedAt).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* About FUZE technology */}
      <section className="max-w-5xl mx-auto px-6 pb-12">
        <details className="rounded-xl border border-slate-200 bg-white p-5">
          <summary className="cursor-pointer font-bold text-slate-900">
            {T.aboutSummaryTitle}
          </summary>
          <div className="mt-3 text-sm text-slate-700 space-y-3">
            <p>
              FUZE is a proprietary antimicrobial textile treatment built around
              FUZE metamaterial — produced via liquid laser ablation from recycled
              electronics. The treatment bonds to fibers during standard textile
              finishing (exhaust, pad-dry-cure, or spray) without changing dye,
              hand, or breathability.
            </p>
            <p>
              FUZE is non-leaching by design. Bacterial reduction happens through
              physical contact with the bonded metamaterial — not through ions
              released into wash water. That posture sits FUZE on the right side
              of every PFAS-free regulatory tailwind.
            </p>
            <p>
              <strong>Certifications:</strong> OEKO-TEX Standard 100 Class I,
              bluesign® approved, EPA registered (federal), California EPA
              approved (Q1 2026), PFAS-free.
            </p>
            <p>
              <strong>Validated standards:</strong> ASTM E2149 (the non-leaching
              contact-kill test, primary for F3/F4 tiers), AATCC 100, AATCC 30,
              ISO 18184, ISO 20743.
            </p>
          </div>
        </details>
      </section>

      {/* Verification CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div
          className="rounded-2xl p-8 text-center text-white"
          style={{
            background: `linear-gradient(135deg, ${primary} 0%, #009ba8 100%)`,
          }}
        >
          <h2 className="text-2xl font-black mb-2">
            {T.verifyCtaTitle}
          </h2>
          <p className="text-sm text-white/90 mb-4">
            {T.verifyCtaBody}
          </p>
          <Link
            href="/verified/qr"
            className="inline-block px-5 py-2 rounded-md bg-white text-slate-900 font-bold hover:bg-slate-100"
          >
            {T.verifyCtaBtn}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-8 text-xs text-slate-500 border-t border-slate-200">
        <div className="flex flex-wrap justify-between gap-2">
          <p>
            {T.footerCertifiedBy} ·{" "}
            <a href="https://fuzeatlas.com" className="hover:underline">
              fuzeatlas.com
            </a>
          </p>
          <p>
            {data.brand.website && (
              <a href={data.brand.website} className="hover:underline">
                {T.brandSiteLink}
              </a>
            )}
            {data.profile.supportEmail && (
              <>
                {" · "}
                <a
                  href={`mailto:${data.profile.supportEmail}`}
                  className="hover:underline"
                >
                  {T.contactLink}
                </a>
              </>
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
      <p className="text-4xl font-black text-slate-900 tabular-nums">{value}</p>
      <p className="text-xs uppercase tracking-wider text-slate-500 mt-1 font-bold">
        {label}
      </p>
    </div>
  );
}
