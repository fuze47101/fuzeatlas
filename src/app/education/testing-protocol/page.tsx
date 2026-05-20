// @ts-nocheck
import Link from "next/link";

/**
 * /education/testing-protocol — FUZE Certified Testing Protocol
 *
 * The single source of truth for how FUZE-treated fabric must be tested.
 * Built 2026-05-20 after a customer test failure investigation: ICP came
 * back at 0.68 mg/kg (mid-tier loading, well above F3 floor) but AATCC 100
 * + ASTM E2149 both failed. Root cause: lab used autoclave (120°C under
 * pressure) for fabric sterilization, which opens synthetic fibers
 * (especially nylon) and causes the surface-bound metamaterial to be
 * absorbed into the fiber matrix where bacteria can't reach it.
 *
 * BV Hong Kong validated with a side-by-side battery (autoclave vs UV,
 * same fabric, same test). UV samples: ≥99.9% reduction across all 8
 * coupons. Autoclave samples: highly variable, several at 0.0%.
 *
 * The bacterial-motility nuance (Andrew's explanation): autoclave samples
 * showed ~90% kill on Staph because Staph is highly mobile and finds
 * surviving surface particles; Klebsiella failures were the extreme cases
 * (0.0% reduction) because Kleb is less mobile and can't reach buried
 * chemistry.
 *
 * This page is REQUIRED reading for every new Atlas access requester
 * (factory, lab, distributor, brand) before they're approved. Andrew
 * gates the request flow on acknowledgment of this protocol.
 *
 * Source-of-truth references: Andrew's email reply to the customer +
 * BV Hong Kong's May 2026 battery report (Joanne).
 *
 * Customer identity is NOT named on this page — generic case study only.
 *
 * NEVER deviate from the brand voice rules in src/lib/fuze-knowledge.ts
 * when editing this page. FUZE / metamaterial / contact-kill only.
 * No silver / nano / Ag in user-facing copy.
 */

export const metadata = {
  title: "FUZE Certified Testing Protocol",
  description:
    "Required testing protocol for FUZE-treated fabric. ICP-first verification, UV-only sterilization, low-sulfur growth medium, ASTM E2149 as primary test.",
};

export default function TestingProtocolPage() {
  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-slate-500 mb-3">
        <Link href="/education" className="hover:text-slate-700">Education</Link>
        <span className="mx-1">›</span>
        <span className="text-slate-700 font-medium">Certified Testing Protocol</span>
      </nav>

      {/* Hero */}
      <div className="mb-6">
        <div className="inline-block bg-red-100 text-red-800 text-[11px] font-black uppercase tracking-wider px-2 py-1 rounded mb-2">
          Required reading
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900">
          FUZE Certified Testing Protocol
        </h1>
        <p className="text-slate-600 mt-2 max-w-3xl">
          This is the only test protocol FUZE Technologies will support. Any deviation —
          different sterilization, different growth medium, different contact period,
          or skipping ICP verification — voids the results and wastes everyone&apos;s time and
          money. Read this page in full before requesting a test, applying for Atlas
          access, or shipping samples to any lab.
        </p>
      </div>

      {/* Top-of-page summary card */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 mb-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
          The seven rules
        </p>
        <ol className="space-y-1.5 text-sm">
          <li><span className="font-black text-emerald-300">1.</span> ICP first. No antimicrobial test starts without ICP confirmation of fabric loading in mg/kg.</li>
          <li><span className="font-black text-emerald-300">2.</span> Sterilization is UV ONLY. Autoclave destroys the test.</li>
          <li><span className="font-black text-emerald-300">3.</span> Growth medium is low-sulfur. Mueller Hinton Broth is the standard.</li>
          <li><span className="font-black text-emerald-300">4.</span> No pre-test handling of the fabric. No hand-washing the sample.</li>
          <li><span className="font-black text-emerald-300">5.</span> ASTM E2149 contact time is 24 hours minimum.</li>
          <li><span className="font-black text-emerald-300">6.</span> ASTM E2149 is the primary recommended test for every FUZE tier.</li>
          <li><span className="font-black text-emerald-300">7.</span> AATCC 100 and ISO 20743 are supported ONLY at ICP ≥ 1.0 mg/kg (F1 Full Spectrum).</li>
        </ol>
      </div>

      {/* Section 1 — ICP First */}
      <section className="mb-10">
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-2xl font-black text-[#00b4c3]">1.</span>
          <h2 className="text-2xl font-black text-slate-900">ICP First — No Exceptions</h2>
        </div>
        <p className="text-slate-700 mb-3 max-w-3xl">
          Every test begins with ICP-MS (inductively coupled plasma mass spectrometry) on
          the treated fabric. ICP measures the actual mg of FUZE metamaterial loaded onto
          the fabric, in mg/kg of fabric weight. Without this number, an antimicrobial
          test result is uninterpretable — a failure could mean the chemistry is
          underperforming, or it could mean the factory under-applied. You can&apos;t tell
          which from a CFU log without the ICP context.
        </p>
        <p className="text-slate-700 mb-3 max-w-3xl">
          FUZE&apos;s recommended ICP lab is <strong>Formosa Laboratories (Taipei)</strong>.
          They have the calibration curve, the sample-prep protocol, and the turnaround
          time we&apos;ve standardized on. Your account manager or distributor can route
          samples to Formosa directly.
        </p>
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 max-w-3xl">
          <p className="text-sm font-bold text-amber-900 mb-1">
            ⚠ If your lab proposes running AATCC 100, ASTM E2149, ISO 20743, AATCC 30,
            or ISO 18184 without ICP first, STOP.
          </p>
          <p className="text-sm text-amber-800">
            Tell them the protocol requires ICP-first verification. We will not accept,
            certify, or share results from an antimicrobial test run without paired ICP
            confirmation of the fabric&apos;s actual loading.
          </p>
        </div>
      </section>

      {/* Section 2 — Sterilization */}
      <section className="mb-10">
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-2xl font-black text-[#00b4c3]">2.</span>
          <h2 className="text-2xl font-black text-slate-900">Sterilization — UV Only</h2>
        </div>
        <p className="text-slate-700 mb-3 max-w-3xl">
          Fabric samples must be sterilized via UV exposure before antimicrobial testing.
          <strong> Autoclave sterilization is forbidden.</strong> Autoclave at 120°C under
          pressure opens synthetic fibers — especially nylon — and the FUZE metamaterial
          that was permanently bonded to the fiber surface gets absorbed into the now-open
          fiber matrix. Once absorbed, the particles can no longer make physical contact
          with the bacterial cells the test introduces. FUZE&apos;s mechanism is contact-kill.
          No contact, no kill. False failure.
        </p>
        <div className="bg-slate-100 border-l-4 border-slate-400 px-4 py-3 mb-4 max-w-3xl">
          <p className="text-sm text-slate-700">
            <strong>Bacterial mobility makes the false-failure non-uniform.</strong>{" "}
            Highly mobile bacteria like <em>Staphylococcus aureus</em> still show ~90%
            reduction on autoclave-prepped samples because Staph moves through the
            suspension and finds the surviving surface chemistry. Less-mobile bacteria
            like <em>Klebsiella pneumoniae</em> show the worst results (0.0% reduction
            is common) because they can&apos;t physically reach the buried particles. If
            a test report shows decent Staph numbers but zero/near-zero Kleb, that&apos;s
            the autoclave signature.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
            Case study — BV Hong Kong validation, May 2026
          </p>
          <p className="text-sm text-slate-700 mb-4">
            A recent customer testing case failed AATCC 100 and ASTM E2149 despite an
            ICP of 0.68 mg/kg (well above the F3 Core Performance application floor).
            Bureau Veritas Hong Kong ran a controlled side-by-side battery on eight
            garment samples — same fabric, same test, same chemistry — with the only
            variable being sterilization method (autoclave vs UV).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left px-3 py-2 font-bold">Sample</th>
                  <th className="text-right px-3 py-2 font-bold">UV (CFU log)</th>
                  <th className="text-right px-3 py-2 font-bold">UV (% reduction)</th>
                  <th className="text-right px-3 py-2 font-bold">Autoclave (CFU log)</th>
                  <th className="text-right px-3 py-2 font-bold">Autoclave (% reduction)</th>
                </tr>
              </thead>
              <tbody className="text-slate-800">
                <tr className="border-t border-slate-100"><td className="px-3 py-1.5">Black garment</td><td className="text-right px-3 py-1.5 tabular-nums">4.1</td><td className="text-right px-3 py-1.5 tabular-nums">≥99.9%</td><td className="text-right px-3 py-1.5 tabular-nums text-red-700">0.3</td><td className="text-right px-3 py-1.5 tabular-nums text-red-700">49.9%</td></tr>
                <tr className="border-t border-slate-100"><td className="px-3 py-1.5">Black garment</td><td className="text-right px-3 py-1.5 tabular-nums">5.1</td><td className="text-right px-3 py-1.5 tabular-nums">≥99.9%</td><td className="text-right px-3 py-1.5 tabular-nums text-red-700 font-bold">0</td><td className="text-right px-3 py-1.5 tabular-nums text-red-700 font-bold">0.0%</td></tr>
                <tr className="border-t border-slate-100"><td className="px-3 py-1.5">Light blue garment</td><td className="text-right px-3 py-1.5 tabular-nums">4.1</td><td className="text-right px-3 py-1.5 tabular-nums">≥99.9%</td><td className="text-right px-3 py-1.5 tabular-nums text-red-700 font-bold">0</td><td className="text-right px-3 py-1.5 tabular-nums text-red-700 font-bold">0.0%</td></tr>
                <tr className="border-t border-slate-100"><td className="px-3 py-1.5">Black garment</td><td className="text-right px-3 py-1.5 tabular-nums">5.2</td><td className="text-right px-3 py-1.5 tabular-nums">≥99.9%</td><td className="text-right px-3 py-1.5 tabular-nums text-amber-700">0.9</td><td className="text-right px-3 py-1.5 tabular-nums text-amber-700">87.4%</td></tr>
                <tr className="border-t border-slate-100"><td className="px-3 py-1.5">Dark blue garment</td><td className="text-right px-3 py-1.5 tabular-nums">5.3</td><td className="text-right px-3 py-1.5 tabular-nums">≥99.9%</td><td className="text-right px-3 py-1.5 tabular-nums">3.1</td><td className="text-right px-3 py-1.5 tabular-nums">99.9%</td></tr>
                <tr className="border-t border-slate-100"><td className="px-3 py-1.5">Black garment</td><td className="text-right px-3 py-1.5 tabular-nums">5.2</td><td className="text-right px-3 py-1.5 tabular-nums">≥99.9%</td><td className="text-right px-3 py-1.5 tabular-nums text-amber-700">0.8</td><td className="text-right px-3 py-1.5 tabular-nums text-amber-700">84.2%</td></tr>
                <tr className="border-t border-slate-100"><td className="px-3 py-1.5">Teal garment</td><td className="text-right px-3 py-1.5 tabular-nums">5.3</td><td className="text-right px-3 py-1.5 tabular-nums">≥99.9%</td><td className="text-right px-3 py-1.5 tabular-nums text-red-700">0.2</td><td className="text-right px-3 py-1.5 tabular-nums text-red-700">36.9%</td></tr>
                <tr className="border-t border-slate-100"><td className="px-3 py-1.5">Blue garment</td><td className="text-right px-3 py-1.5 tabular-nums">5.3</td><td className="text-right px-3 py-1.5 tabular-nums">≥99.9%</td><td className="text-right px-3 py-1.5 tabular-nums text-amber-700">0.5</td><td className="text-right px-3 py-1.5 tabular-nums text-amber-700">68.4%</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-600 mt-3">
            UV-sterilized samples: 100% pass rate, ≥99.9% reduction across the board.
            Autoclave-sterilized samples from the SAME fabric: highly variable, with
            multiple samples crashing to 0.0% reduction. The chemistry was identical;
            only the prep method differed.
          </p>
          <p className="text-xs text-slate-500 mt-2 italic">
            Source: Bureau Veritas Hong Kong battery, May 2026. Full report available
            from FUZE on request.
          </p>
        </div>

        <div className="bg-red-50 border border-red-300 rounded-xl p-4 mt-4 max-w-3xl">
          <p className="text-sm font-bold text-red-900 mb-1">
            ⚠ When submitting samples to ANY lab — explicitly mark &quot;NOT AUTOCLAVE&quot; on the test request form.
          </p>
          <p className="text-sm text-red-800">
            Labs default to autoclave sterilization for most antimicrobial-textile
            customers because most antimicrobial chemistries are leaching ion-release
            systems that aren&apos;t affected by autoclave. FUZE is different. Unless
            you explicitly request UV sterilization on every submission form, the lab
            will use autoclave by default and silently void your results.
          </p>
        </div>
      </section>

      {/* Section 3 — Growth Medium */}
      <section className="mb-10">
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-2xl font-black text-[#00b4c3]">3.</span>
          <h2 className="text-2xl font-black text-slate-900">Growth Medium — Low Sulfur</h2>
        </div>
        <p className="text-slate-700 mb-3 max-w-3xl">
          The growth medium used to incubate the bacterial challenge must be low in
          sulfur compounds. Sulfur coats the FUZE metamaterial and reduces its
          effectiveness during testing — blood-based or sulfur-rich media will produce
          false negatives even on properly applied F1 Full Spectrum fabric. Specifically
          avoid blood-supplemented growth media, which deposit sulfur onto the antimicrobial
          chemistry.
        </p>
        <p className="text-slate-700 mb-3 max-w-3xl">
          <strong>Mueller Hinton Broth (MHB) is the preferred medium.</strong> It&apos;s
          a standardized, low-sulfur, neutral-pH medium used worldwide for CLSI
          antimicrobial susceptibility testing. Bureau Veritas Hong Kong runs FUZE
          testing on MHB and the results are reliable.
        </p>
        <p className="text-slate-700 max-w-3xl">
          We recognize that MHB can be difficult for some textile-microbiology labs to
          source on short notice — it&apos;s more commonly stocked by clinical labs than
          by textile testing houses. If your lab cannot obtain MHB, ask for the lowest-sulfur
          medium they have available and explicitly decline any blood-supplemented or
          sulfur-rich option. If you&apos;re unsure whether your lab&apos;s default medium
          meets the requirement, email{" "}
          <a href="mailto:andrew@fuze47.com" className="text-[#00b4c3] font-bold hover:underline">
            andrew@fuze47.com
          </a>{" "}
          with the lab&apos;s proposed protocol and we&apos;ll review before you ship.
        </p>
      </section>

      {/* Section 4 — Sample Handling */}
      <section className="mb-10">
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-2xl font-black text-[#00b4c3]">4.</span>
          <h2 className="text-2xl font-black text-slate-900">Sample Handling — No Pre-Test Washing</h2>
        </div>
        <p className="text-slate-700 mb-3 max-w-3xl">
          Do not hand-wash, rinse, or otherwise manipulate the fabric sample before
          testing. Spray-applied FUZE in particular has a surface distribution profile
          that physical handling can disrupt — pre-test handwashing can move chemistry
          off the sampled surface and produce a false negative on coupons that would
          otherwise pass at the same loading.
        </p>
        <p className="text-slate-700 max-w-3xl">
          BV Hong Kong&apos;s May 2026 follow-up battery (samples 52251530641 and 52251530638)
          confirmed this directly. Initial test runs returned 0.0% reduction. The
          repeated runs, performed without the pre-test hand wash, returned strong
          positive readings with the same fabric and same chemistry.
        </p>
      </section>

      {/* Section 5 — Contact Time */}
      <section className="mb-10">
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-2xl font-black text-[#00b4c3]">5.</span>
          <h2 className="text-2xl font-black text-slate-900">Contact Time — 24 Hours Minimum (ASTM E2149)</h2>
        </div>
        <p className="text-slate-700 mb-3 max-w-3xl">
          ASTM E2149 is a dynamic-contact test — the fabric is shaken in a buffered
          bacterial suspension and CFU reduction is measured after a defined contact
          period. The standard&apos;s default contact period (1 hour) was calibrated around
          ion-leaching antimicrobials, which kill on a fast timescale. FUZE is a
          contact-kill chemistry — slower kinetics, requires bacteria to physically
          encounter the metamaterial particles distributed across the fiber surface.
          Run the test for a minimum of 24 hours.
        </p>
        <p className="text-slate-700 max-w-3xl text-sm">
          ISO 20743 and AATCC 100 already have their own defined contact periods (24h
          and 18-24h respectively) — those don&apos;t need adjustment. The 24-hour minimum
          applies specifically to ASTM E2149.
        </p>
      </section>

      {/* Section 6 — Recommended Tests */}
      <section className="mb-10">
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-2xl font-black text-[#00b4c3]">6.</span>
          <h2 className="text-2xl font-black text-slate-900">Tier × Test Compatibility</h2>
        </div>
        <p className="text-slate-700 mb-4 max-w-3xl">
          The right test depends on the FUZE tier applied. ASTM E2149 is the primary
          recommended test for every tier because it was designed for non-leaching
          contact-kill chemistry. AATCC 100 and ISO 20743 are supported only at the F1
          Full Spectrum tier where the application density is sufficient to overcome
          those tests&apos; layered-coupon geometry (which was designed for ion-leaching
          chemistries and disadvantages non-leaching antimicrobials at lower densities).
        </p>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-w-3xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-4 py-3 font-bold text-slate-700">Tier</th>
                <th className="text-left px-4 py-3 font-bold text-slate-700">Loading (mg/kg)</th>
                <th className="text-left px-4 py-3 font-bold text-slate-700">Required test</th>
                <th className="text-left px-4 py-3 font-bold text-slate-700">Optional add-on tests</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-4 py-3 font-bold text-slate-900">F4 Essential</td>
                <td className="px-4 py-3 text-slate-700">0.25</td>
                <td className="px-4 py-3"><span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded">ASTM E2149</span></td>
                <td className="px-4 py-3 text-slate-400 text-xs">None — AATCC/ISO not supported below 1.0 mg/kg</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-4 py-3 font-bold text-slate-900">F3 Core</td>
                <td className="px-4 py-3 text-slate-700">0.5</td>
                <td className="px-4 py-3"><span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded">ASTM E2149</span></td>
                <td className="px-4 py-3 text-slate-400 text-xs">None — AATCC/ISO not supported below 1.0 mg/kg</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-4 py-3 font-bold text-slate-900">F2 Advanced</td>
                <td className="px-4 py-3 text-slate-700">0.75</td>
                <td className="px-4 py-3"><span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded">ASTM E2149</span></td>
                <td className="px-4 py-3 text-slate-400 text-xs">None — AATCC/ISO not supported below 1.0 mg/kg</td>
              </tr>
              <tr className="border-t border-slate-100 bg-emerald-50/40">
                <td className="px-4 py-3 font-bold text-slate-900">F1 Full Spectrum</td>
                <td className="px-4 py-3 text-slate-700">1.0</td>
                <td className="px-4 py-3"><span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded">ASTM E2149</span></td>
                <td className="px-4 py-3 text-xs">
                  <span className="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded mr-1">AATCC 100</span>
                  <span className="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded mr-1">ISO 20743</span>
                  <span className="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded mr-1">AATCC 30 (antifungal)</span>
                  <span className="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded">ISO 18184 (antiviral)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3 max-w-3xl">
          A factory or brand can still request AATCC 100 or ISO 20743 on an F2 / F3 / F4
          fabric — but FUZE will not certify the results, and any failure on those tests
          at sub-F1 loadings will be treated as a methodology issue, not a chemistry
          failure. ICP confirmation of ≥1.0 mg/kg is the gate.
        </p>
      </section>

      {/* Section 7 — Why these matter */}
      <section className="mb-10">
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-2xl font-black text-[#00b4c3]">7.</span>
          <h2 className="text-2xl font-black text-slate-900">Why the Protocol Matters</h2>
        </div>
        <p className="text-slate-700 mb-3 max-w-3xl">
          FUZE is a <strong>non-leaching, contact-kill antimicrobial</strong>. The
          metamaterial bonds permanently into the fiber surface during standard textile
          finishing — it doesn&apos;t release ions, doesn&apos;t migrate, doesn&apos;t wash out.
          The kill mechanism requires bacteria to physically touch the metamaterial
          particles on the fiber surface.
        </p>
        <p className="text-slate-700 mb-3 max-w-3xl">
          This mechanism is different from every legacy antimicrobial textile chemistry
          (silver-ion releases, zinc pyrithione, QAC, silver chloride). Those chemistries
          leach ions into the surrounding moisture and kill bacteria via that ion field —
          the bacteria don&apos;t have to touch the chemistry itself. Most legacy tests
          (AATCC 100, ISO 20743) were designed around that ion-leaching mechanism. They
          stack multiple layers of fabric around an inoculated coupon and measure
          surviving CFU after a contact period — geometry that helps leaching chemistries
          saturate the inter-layer space with ions.
        </p>
        <p className="text-slate-700 mb-3 max-w-3xl">
          ASTM E2149 was designed for the opposite case — non-leaching contact-kill
          chemistries. The treated fabric is shaken in a bacterial suspension; reduction
          is measured after a defined contact period. The test rewards direct surface
          contact. No ion field required. No leaching tolerated. <strong>It&apos;s the
          right test for FUZE.</strong>
        </p>
        <p className="text-slate-700 max-w-3xl">
          When the protocol gets violated — autoclave buries the particles, sulfur
          neutralizes the chemistry, pre-test handling disrupts the spray distribution,
          AATCC 100 is run at insufficient loading — the test fails not because FUZE
          doesn&apos;t work, but because the test conditions prevent the mechanism from
          firing. We don&apos;t accept those results. Neither should you.
        </p>
      </section>

      {/* Section 8 — Lab sign-off */}
      <section className="mb-10">
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-2xl font-black text-[#00b4c3]">8.</span>
          <h2 className="text-2xl font-black text-slate-900">Acknowledgment</h2>
        </div>
        <p className="text-slate-700 mb-3 max-w-3xl">
          By requesting Atlas access, submitting a test request, or shipping samples to
          any lab in the FUZE-recommended network, you acknowledge that you have read
          and will follow this protocol. Test results submitted to FUZE that deviate from
          the protocol — autoclave sterilization, sulfur-rich growth medium, pre-test
          fabric handling, missing ICP verification, AATCC/ISO at sub-F1 loadings — will
          be flagged as methodology-deficient and will not be certified.
        </p>
        <p className="text-slate-700 mb-3 max-w-3xl">
          If your existing lab cannot meet this protocol, FUZE will refer you to one
          that can (BV, Intertek, ITS, VL, FPC are all qualified; Formosa Labs Taipei
          for ICP). Contact your account manager or email{" "}
          <a href="mailto:andrew@fuze47.com" className="text-[#00b4c3] font-bold hover:underline">
            andrew@fuze47.com
          </a>{" "}
          (CC{" "}
          <a href="mailto:tina@fuzebiotech.com" className="text-[#00b4c3] font-bold hover:underline">
            tina@fuzebiotech.com
          </a>{" "}
          at our Taipei office for Asia-region routing) for a lab referral.
        </p>
      </section>

      {/* Footer CTA */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
        <p className="text-sm font-bold text-slate-900 mb-2">Questions about the protocol?</p>
        <p className="text-sm text-slate-600 mb-4 max-w-2xl mx-auto">
          Ask in the FUZE AI FAQ chat — it has this protocol indexed and can answer
          specific questions about ICP thresholds, lab selection, sample prep,
          test sequencing, or how to ask your lab for the right conditions.
        </p>
        <Link
          href="/brand-portal/chat"
          className="inline-block px-5 py-2.5 bg-[#00b4c3] text-white text-sm font-bold rounded-lg hover:bg-[#0098a5]"
        >
          Open FUZE AI FAQ →
        </Link>
      </div>

      {/* Tiny meta */}
      <p className="text-[10px] text-slate-400 text-center mt-6">
        Protocol v1.0 · Published 2026-05-20 · Based on BV Hong Kong validation battery
        (May 2026) and the CAI-Textile failure investigation. Updates published quarterly.
      </p>
    </div>
  );
}
