/**
 * /claims — Phase 12D public claims library.
 *
 * Standards explainer + competitive test-methodology jab from
 * CLAUDE.md + downloadable PUBLIC-audience ProductDocuments.
 */
import Link from "next/link";
import PublicPageBeacon from "@/components/PublicPageBeacon";

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

export default async function ClaimsPage() {
  const docs = await loadDocs();
  const byCategory = new Map<string, Doc[]>();
  for (const d of docs) {
    const arr = byCategory.get(d.category) || [];
    arr.push(d);
    byCategory.set(d.category, arr);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicPageBeacon path="/claims" />
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#00b4c3] to-[#009ba8] text-white px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-black">Claims, certifications &amp; methodology</h1>
          <p className="mt-3 text-lg text-white/90">
            How FUZE works, what it's certified for, and why we test it the way we do.
          </p>
        </div>
      </section>

      {/* Tech overview */}
      <section className="max-w-4xl mx-auto px-6 py-12 space-y-4">
        <h2 className="text-2xl font-black text-slate-900">FUZE technology</h2>
        <p className="text-slate-700">
          FUZE is a proprietary antimicrobial textile treatment built around FUZE
          metamaterial — produced via liquid laser ablation from recycled
          electronics in our Salt Lake City facility. The treatment bonds
          permanently to fibers during standard textile finishing (exhaust,
          pad-dry-cure, or spray application) without changing the fabric's hand,
          dye, drape, or breathability.
        </p>
        <p className="text-slate-700">
          FUZE is <strong>non-leaching by design</strong>. Bacterial reduction
          happens through direct physical contact between bacterial cells and the
          bonded FUZE metamaterial on the fiber surface — there's no chemistry
          released into wash water, no PFAS, no binders, no curing chemistry. The
          posture sits FUZE on the right side of every regulatory tailwind
          (Texas AG PFAS investigations, California SB-707).
        </p>
        <p className="text-slate-700">
          <strong>Treatment tiers:</strong> F1 Full Spectrum (1.0 mg/kg, 100
          washes validated) · F2 Advanced (0.75 mg/kg, 75 washes) · F3 Core (0.5
          mg/kg, 50 washes) · F4 Foundation (0.25 mg/kg, 25 washes). Wash counts
          are documented through independent-lab AATCC 100 + ISO 20743 testing,
          published on request.
        </p>
      </section>

      {/* Certifications */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-black text-slate-900 mb-4">Certifications</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              t: "EPA registered (federal)",
              d: "FUZE chemistry is registered with the U.S. Environmental Protection Agency as an antimicrobial pesticide.",
            },
            {
              t: "California EPA approved (Q1 2026)",
              d: "Cleared for activewear, baby/kids textiles, and healthcare use cases under California's stricter regime.",
            },
            {
              t: "OEKO-TEX Standard 100 Class I",
              d: "Certified safe for direct skin contact — including baby and intimate apparel.",
            },
            {
              t: "bluesign® approved",
              d: "Chemistry verified safe for workers, consumers, and the environment under bluesign criteria.",
            },
            {
              t: "PFAS-free",
              d: "Zero per- and polyfluoroalkyl substances anywhere in the formulation. No binders, no curing aids.",
            },
            {
              t: "Standards validated",
              d: "AATCC 100, ASTM E2149, AATCC 30, ISO 18184, ISO 20743 — third-party reports available on request.",
            },
          ].map((c) => (
            <div key={c.t} className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-slate-900">{c.t}</h3>
              <p className="text-sm text-slate-600 mt-1">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Standards explainer */}
      <section className="max-w-4xl mx-auto px-6 py-12 space-y-4">
        <h2 className="text-2xl font-black text-slate-900">Test standards</h2>
        <p className="text-slate-700">
          Antimicrobial performance for textiles isn't a single number — it
          depends heavily on which standard you ran the test on, and whether
          that standard fits the chemistry. Here's how FUZE maps onto the
          methods.
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
          <h2 className="text-2xl font-black mb-4">Why we lead with ASTM E2149</h2>
          <p className="text-white/90 leading-relaxed">
            We test on ASTM E2149 because it's the test designed for non-leaching
            antimicrobials. Competitor chemistries that rely on AATCC 100 do so
            because AATCC 100's stacked-layer geometry helps leaching ions
            saturate the inter-layer space — the test favors leaching by
            construction. FUZE doesn't leach, by design. Meet us on the right
            test.
          </p>
          <p className="text-white/70 text-sm mt-4">
            (Competitor attribution: the layered-test caveat applies to silver-ion,
            silver-chloride, and quat-based finishers — not to FUZE.)
          </p>
        </div>
      </section>

      {/* Document library */}
      {docs.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-black text-slate-900 mb-4">Documents</h2>
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
            Press kit
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
