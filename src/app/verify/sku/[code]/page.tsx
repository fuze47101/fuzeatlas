/**
 * /verify/sku/[code] — BONUS-1 public hangtag-QR landing.
 *
 * Server-rendered. No auth (path is in middleware PUBLIC_PATHS). The
 * QR code on a garment hangtag points here; the URL carries the FUZE
 * number or a customer/factory code as the path param.
 *
 * Renders a clean trust page: who treated it, with what tier of FUZE,
 * when it was lab-validated, and the FUZE certification chip strip.
 * If the code doesn't resolve, renders a friendly "this isn't a
 * FUZE-certified SKU" state instead of a 404 page.
 */
import Link from "next/link";
import { getServerTranslations } from "@/i18n/server";

interface VerifyResponse {
  ok: boolean;
  fabric?: {
    id: string;
    fuzeNumber: number | null;
    customerCode: string | null;
    factoryCode: string | null;
    construction: string | null;
    color: string | null;
    tier: string | null;
  };
  brand?: { id: string; name: string } | null;
  factory?: { id: string; name: string; country: string | null } | null;
  latestTestRun?: {
    id: string;
    testType: string;
    testDate: string | null;
    labName: string | null;
    labCountry: string | null;
    reportNumber: string | null;
  } | null;
  certifications?: { name: string; icon: string }[];
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://fuzeatlas.com";

const TIER_DESCRIPTIONS: Record<string, { name: string; washes: number }> = {
  F1: { name: "Full Spectrum", washes: 100 },
  F2: { name: "Advanced Performance", washes: 75 },
  F3: { name: "Core Performance", washes: 50 },
  F4: { name: "Essential Protection", washes: 25 },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

async function loadVerify(code: string): Promise<VerifyResponse | null> {
  try {
    const res = await fetch(`${APP_URL}/api/public/verify-sku/${encodeURIComponent(code)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      if (res.status === 404) return { ok: false };
      return null;
    }
    return (await res.json()) as VerifyResponse;
  } catch {
    return null;
  }
}

export default async function VerifySkuPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams?: Promise<{ lang?: string; locale?: string }>;
}) {
  const { code } = await params;
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.locale || sp.lang)).verifySku;
  const data = await loadVerify(code);

  // Network / API error — render a soft "couldn't verify right now" state.
  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-md border border-slate-200 p-8 text-center">
          <div className="text-4xl mb-3">🤔</div>
          <h1 className="text-lg font-bold text-slate-900 mb-1">{T.errorTitle}</h1>
          <p className="text-sm text-slate-600">
            {T.errorBlurb}
          </p>
        </div>
      </div>
    );
  }

  // Resolved-but-not-found — clean public messaging, no 404 page.
  if (!data.ok || !data.fabric) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-md border border-slate-200 p-8 text-center">
          <div className="text-4xl mb-3">🔎</div>
          <h1 className="text-lg font-bold text-slate-900 mb-1">{T.notCertifiedTitle}</h1>
          <p className="text-sm text-slate-600 mb-4">
            {T.notCertifiedBlurbPrefix} <span className="font-mono font-bold">{code}</span> {T.notCertifiedBlurbSuffix}
          </p>
          <Link
            href="https://fuzefaq.com"
            className="inline-block text-xs text-[#00b4c3] font-bold hover:underline"
          >
            {T.whatIsFuze}
          </Link>
        </div>
      </div>
    );
  }

  const fabric = data.fabric;
  const tierInfo = fabric.tier ? TIER_DESCRIPTIONS[fabric.tier] : null;
  const latestTest = data.latestTestRun;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-cyan-50/30">
      <div className="max-w-2xl mx-auto p-4 sm:p-8">
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 p-8 text-white shadow-xl mb-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-emerald-200 mb-1">
                {T.fuzeVerified}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black">
                {T.pageTitle}
              </h1>
              <p className="text-sm text-emerald-100 mt-1">
                {T.pageSubtitle}
              </p>
            </div>
            <span className="text-4xl shrink-0" aria-hidden="true">
              ✓
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {data.brand && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-200 font-bold">
                  {T.brandLabel}
                </p>
                <p className="text-lg font-bold mt-0.5">{data.brand.name}</p>
              </div>
            )}
            {data.factory && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-200 font-bold">
                  {T.millLabel}
                </p>
                <p className="text-lg font-bold mt-0.5">
                  {data.factory.name}
                  {data.factory.country && (
                    <span className="text-emerald-200 font-normal ml-1">
                      · {data.factory.country}
                    </span>
                  )}
                </p>
              </div>
            )}
            {fabric.tier && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-200 font-bold">
                  {T.fuzeTierLabel}
                </p>
                <p className="text-lg font-bold mt-0.5">
                  {fabric.tier}
                  {tierInfo && (
                    <span className="text-emerald-200 font-normal ml-1">
                      · {tierInfo.washes} {T.washClaimSuffix}
                    </span>
                  )}
                </p>
              </div>
            )}
            {fabric.fuzeNumber != null && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-200 font-bold">
                  {T.fuzeNumberLabel}
                </p>
                <p className="text-lg font-mono font-bold mt-0.5">
                  FUZE-{fabric.fuzeNumber}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Latest test run */}
        {latestTest && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">
              {T.recentValidation}
            </p>
            <p className="text-base font-bold text-slate-900">
              {latestTest.testType.replace(/_/g, " ")} {T.testTypeSuffix}{" "}
              <span className="text-emerald-700">{T.testPassed}</span>
            </p>
            <p className="text-sm text-slate-600 mt-1">
              {latestTest.labName ? `${T.validatedByPrefix} ${latestTest.labName}` : T.validatedByGeneric}
              {latestTest.labCountry ? ` (${latestTest.labCountry})` : ""}
              {" "}{T.validatedOn}{" "}
              <span className="font-semibold text-slate-900">
                {formatDate(latestTest.testDate)}
              </span>
              .
            </p>
            {latestTest.reportNumber && (
              <p className="text-[11px] text-slate-500 mt-2 font-mono">
                {T.reportRefPrefix} {latestTest.reportNumber}
              </p>
            )}
          </div>
        )}

        {/* Certifications */}
        {data.certifications && data.certifications.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-3">
              {T.certifications}
            </p>
            <div className="flex flex-wrap gap-2">
              {data.certifications.map((c) => (
                <span
                  key={c.name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 font-semibold"
                >
                  <span aria-hidden="true">{c.icon}</span>
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* About strip */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <p className="text-sm text-slate-700">
            {T.aboutBody}
          </p>
          <Link
            href="https://fuzefaq.com"
            className="inline-block text-xs text-[#00b4c3] font-bold hover:underline mt-2"
          >
            {T.learnMore}
          </Link>
        </div>

        <p className="text-center text-[10px] text-slate-400 mt-6">
          {T.footerAddress}
        </p>
      </div>
    </div>
  );
}
