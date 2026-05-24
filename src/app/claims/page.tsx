/**
 * /claims — Phase 12D public claims library.
 *
 * Standards explainer + competitive test-methodology jab from
 * CLAUDE.md + downloadable PUBLIC-audience ProductDocuments.
 */
import Link from "next/link";
import PublicPageBeacon from "@/components/PublicPageBeacon";
import { getServerTranslations } from "@/i18n/server";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://fuzeatlas.com";

interface Doc {
  id: string;
  docType: string;
  title: string;
  description: string | null;
  fileUrl: string;
  version: string | null;
  effectiveDate: string | null;
  category: string;
  productLine: string | null;
}

export const revalidate = 600;

export const metadata = {
  title: "FUZE Atlas — Claims, certifications & test methodology",
  description:
    "FUZE is a proprietary antimicrobial textile treatment. EPA registered, OEKO-TEX Standard 100 Class I, bluesign approved, PFAS-free. Validated to AATCC 100 / ASTM E2149 / AATCC 30 / ISO 18184 / ISO 20743.",
  openGraph: {
    title: "FUZE Atlas — Claims & certifications",
    description:
      "Standards, certifications, and test methodology for the FUZE antimicrobial textile treatment.",
  },
};

async function loadDocs(): Promise<Doc[]> {
  try {
    const res = await fetch(`${APP_URL}/api/public/claims`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    const j = await res.json();
    return j.ok ? j.documents : [];
  } catch {
    return [];
  }
}

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string }>;
}) {
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.lang)).claimsLandingPage;
  const docs = await loadDocs();
  const byCategory = new Map<string, Doc[]>();
  for (const d of docs) {
    const arr = byCategory.get(d.category) || [];
    arr.push(d);
    byCategory.set(d.category, arr);
  }

  const CERTS = [
    { t: T.certEpaTitle, d: T.certEpaBody },
    { t: T.certCaEpaTitle, d: T.certCaEpaBody },
    { t: T.certOekoTitle, d: T.certOekoBody },
    { t: T.certBluesignTitle, d: T.certBluesignBody },
    { t: T.certPfasTitle, d: T.certPfasBody },
    { t: T.certStandardsTitle, d: T.certStandardsBody },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicPageBeacon path="/claims" />
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#00b4c3] to-[#009ba8] text-white px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-black">{T.heroTitle}</h1>
          <p className="mt-3 text-lg text-white/90">
            {T.heroSubtitle}
          </p>
        </div>
      </section>

      {/* Tech overview */}
      <section className="max-w-4xl mx-auto px-6 py-12 space-y-4">
        <h2 className="text-2xl font-black text-slate-900">{T.techTitle}</h2>
        <p className="text-slate-700">
          {T.techBody1}
        </p>
        <p className="text-slate-700">
          {T.techBody2}
        </p>
        <p className="text-slate-700">
          {T.techBody3}
        </p>
      </section>

      {/* Certifications */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-black text-slate-900 mb-4">{T.certsTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CERTS.map((c) => (
            <div key={c.t} className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-slate-900">{c.t}</h3>
              <p className="text-sm text-slate-600 mt-1">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Standards explainer */}
      <section className="max-w-4xl mx-auto px-6 py-12 space-y-4">
        <h2 className="text-2xl font-black text-slate-900">{T.standardsTitle}</h2>
        <p className="text-slate-700">
          {T.standardsBody}
        </p>
        <dl className="space-y-4 mt-4">
          <Standard
            name="ASTM E2149"
            body="Dynamic-contact antimicrobial test. The treated fabric is shaken in a buffered bacterial suspension; bacterial reduction is measured after a defined contact period. Designed for non-leaching, contact-kill antimicrobials. This is FUZE's primary test for F3 (Core) and F4 (Foundation) tiers."
          />
          <Standard
            name="AATCC 100"
            body="The historical antibacterial test for textiles. Stacks multiple fabric layers around an inoculated coupon and measures surviving colony-forming units. Initial inoculum expected in the 1-5 × 10^5 CFU/mL range. FUZE passes AATCC 100 at F1 (Full Spectrum) and F2 (Advanced) densities."
          />
          <Standard
            name="AATCC 30"
            body="Antifungal performance — quantifies inhibition of fungal growth on treated fabric."
          />
          <Standard
            name="ISO 18184"
            body="Antiviral standard for textiles — quantitative virus reduction. FUZE-validated for healthcare and high-touch surface use cases."
          />
          <Standard
            name="ISO 20743"
            body="ISO equivalent to AATCC 100 — quantitative antibacterial activity assessment, broadly used internationally."
          />
        </dl>
      </section>

      {/* Methodology jab — verbatim from CLAUDE.md */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="rounded-2xl bg-slate-900 text-white p-8">
          <h2 className="text-2xl font-black mb-4">{T.jabTitle}</h2>
          <p className="text-white/90 leading-relaxed">
            {T.jabBody}
          </p>
          <p className="text-white/70 text-sm mt-4">
            {T.jabFootnote}
          </p>
        </div>
      </section>

      {/* Document library */}
      {docs.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-black text-slate-900 mb-4">{T.documentsTitle}</h2>
          {Array.from(byCategory.entries()).map(([cat, items]) => (
            <div key={cat} className="mb-6">
              <h3 className="text-sm uppercase tracking-wider text-slate-500 font-bold mb-2">
                {cat.replace(/_/g, " ")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map((d) => (
                  <a
                    key={d.id}
                    href={d.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-[#00b4c3] hover:shadow-md transition-all"
                  >
                    <p className="font-bold text-slate-900">{d.title}</p>
                    {d.description && (
                      <p className="text-sm text-slate-600 mt-1">{d.description}</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-2">
                      {d.docType}
                      {d.version && <> · {d.version}</>}
                      {d.productLine && <> · {d.productLine}</>}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <footer className="max-w-4xl mx-auto px-6 py-8 text-xs text-slate-500 text-center border-t border-slate-200">
        <p>
          FUZE Atlas ·{" "}
          <Link href="/press" className="hover:underline">
            {T.pressKitLink}
          </Link>{" "}
          ·{" "}
          <a href="https://fuzeatlas.com" className="hover:underline">
            fuzeatlas.com
          </a>
        </p>
      </footer>
    </div>
  );
}

function Standard({ name, body }: { name: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <dt className="font-bold text-slate-900">{name}</dt>
      <dd className="text-sm text-slate-700 mt-1">{body}</dd>
    </div>
  );
}
