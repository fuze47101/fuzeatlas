// Shared FUZE pricing/environmental-score building blocks.
//
// Extracted from src/app/pricing/page.tsx when the pricing page was split
// into two topics (General FUZE Pricing at /pricing, Environmental Score at
// /environmental-score). Both pages drive their math off the same tier
// ladder, grade badge, and number helpers — keep them here so they can't
// drift between the two routes.

// ─── Helpers ──────────────────────────────────
export function uid() {
  return Math.random().toString(16).slice(2);
}
export function num(n: number, digits = 4) {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

// FUZE application tiers — permanent integration at different concentration levels.
// Internal: dose drives pricing math. Customer-facing: tier name only, no mg references.
//
// Andrew (2026-05-04): every tier is permanent. The dose ladder is NOT a wash-count
// ladder — it's a BENEFIT-STACKING ladder. F4 is where FUZE dominates natural fibers
// (no competitor approaches us on cellulose at this dose). Each step up adds another
// fabric-performance benefit on top of the antimicrobial baseline:
//   F4  → antimicrobial + cotton/natural-fiber dominance
//   F3  → + moisture wicking + faster drying + improved evaporation
//   F2  → + color fastness + UVA/UVB fiber protection
//   F1  → + microfiber shielding (reduces wash shedding) + detergent-chemistry catalysis
type TierBenefit = { icon: string; text: string };

export const FUZE_TIERS: ReadonlyArray<{
  id: string;
  name: string;
  dose: number;
  washes: number;
  color: string;
  desc: string;
  pitch: string;
  benefits: ReadonlyArray<TierBenefit>;
  /** True if FUZE outperforms the entire competitive set on natural fibers
   *  at this dose. Used to surface a "cotton dominance" callout. */
  naturalFiberDomination: boolean;
  /** Primary efficacy test where this tier peak-performs. F4/F3 use
   *  ASTM E2149 (dynamic contact, designed for non-leaching antimicrobials)
   *  because that's the mechanism FUZE uses. F1/F2 also pass AATCC 100
   *  (the layered ion-release test that historically advantages leaching
   *  competitors) thanks to higher metamaterial density. See CLAUDE.md
   *  → "CRITICAL: Test Methodology — AATCC 100 vs ASTM E2149". */
  primaryTest: "ASTM E2149" | "ASTM E2149 + AATCC 100";
  testNote: string;
}> = [
  {
    id: "F1",
    name: "Full Spectrum",
    dose: 1.0,
    washes: 100,
    color: "from-emerald-500 to-emerald-600",
    desc: "Every benefit FUZE delivers, stacked. Microfiber shielding and detergent-chemistry catalysis on top of color, UV, drying, and antimicrobial.",
    pitch: "When the brand wants the full performance stack — antimicrobial, fabric performance, color, UV, AND microfiber shielding.",
    naturalFiberDomination: true,
    primaryTest: "ASTM E2149 + AATCC 100",
    testNote: "Sufficient metamaterial density to pass both — the dynamic-contact test (E2149, the mechanism match for non-leaching FUZE) AND the layered ion-release test (AATCC 100, the historical test built around leaching competitors).",
    benefits: [
      { icon: "🦠", text: "Permanent antimicrobial bond — AATCC 100 third-party validated" },
      { icon: "👑", text: "Cotton & natural-fiber dominance — no competitor matches FUZE on cellulose" },
      { icon: "💧", text: "Enhanced moisture wicking" },
      { icon: "🌬️", text: "Faster drying time" },
      { icon: "♨️", text: "Improved evaporation rate" },
      { icon: "🎨", text: "Color fastness improvement" },
      { icon: "☀️", text: "UVA fiber protection" },
      { icon: "🛡️", text: "UVB fiber protection" },
      { icon: "🧵", text: "Microfiber shielding — reduces shedding into wash water" },
      { icon: "✨", text: "Catalyzes home laundry detergent chemistry" },
    ],
  },
  {
    id: "F2",
    name: "Advanced Performance",
    dose: 0.75,
    washes: 75,
    color: "from-teal-500 to-teal-600",
    desc: "Adds color fastness + UVA/UVB fiber protection on top of Core Performance's wicking, drying, and evaporation gains.",
    pitch: "When the brand needs color hold + UV protection in addition to active fabric performance.",
    naturalFiberDomination: true,
    primaryTest: "ASTM E2149 + AATCC 100",
    testNote: "Density is high enough to also pass AATCC 100 — the layered ion-release test that historically advantages leaching competitors. ASTM E2149 (the dynamic-contact test designed for non-leaching chemistries like FUZE) remains the mechanism-correct primary.",
    benefits: [
      { icon: "🦠", text: "Permanent antimicrobial bond — AATCC 100 third-party validated" },
      { icon: "👑", text: "Cotton & natural-fiber dominance" },
      { icon: "💧", text: "Enhanced moisture wicking" },
      { icon: "🌬️", text: "Faster drying time" },
      { icon: "♨️", text: "Improved evaporation rate" },
      { icon: "🎨", text: "Color fastness improvement" },
      { icon: "☀️", text: "UVA fiber protection" },
      { icon: "🛡️", text: "UVB fiber protection" },
    ],
  },
  {
    id: "F3",
    name: "Core Performance",
    dose: 0.5,
    washes: 50,
    color: "from-cyan-500 to-cyan-600",
    desc: "Adds active fabric performance — wicking, drying, evaporation — on top of the antimicrobial baseline.",
    pitch: "When the brand wants performance fabric features (wicking, drying, evaporation) layered on top of antimicrobial.",
    naturalFiberDomination: true,
    primaryTest: "ASTM E2149",
    testNote: "ASTM E2149 is the test designed for non-leaching, contact-kill antimicrobials — exactly how FUZE works. AATCC 100's layered geometry was built around leaching competitors and slows non-leaching contact mechanisms; meet us on the right test.",
    benefits: [
      { icon: "🦠", text: "Permanent antimicrobial bond — AATCC 100 third-party validated" },
      { icon: "👑", text: "Cotton & natural-fiber dominance" },
      { icon: "💧", text: "Enhanced moisture wicking" },
      { icon: "🌬️", text: "Faster drying time" },
      { icon: "♨️", text: "Improved evaporation rate" },
    ],
  },
  {
    id: "F4",
    name: "Essential Protection",
    dose: 0.25,
    washes: 25,
    color: "from-sky-500 to-sky-600",
    desc: "The dose where FUZE dominates natural fibers. No competitor on the market approaches our performance on cotton and cellulose at this concentration.",
    pitch: "When the brand wants the strongest cotton / natural-fiber antimicrobial on the market at the lowest cost. This is where we beat everyone.",
    naturalFiberDomination: true,
    primaryTest: "ASTM E2149",
    testNote: "ASTM E2149 dynamic-contact testing is the right validation method for non-leaching, contact-kill chemistries. FUZE doesn't leach metal into wash water by design — we kill on direct contact, which is exactly what E2149 measures. AATCC 100's stacked layers create dead zones that leaching competitors fill with ion clouds; FUZE has no ion cloud (and we don't want one), so AATCC 100 understates our real-world contact-kill performance at this dose.",
    benefits: [
      { icon: "🦠", text: "Permanent antimicrobial bond — AATCC 100 third-party validated" },
      { icon: "👑", text: "Cotton & natural-fiber dominance — FUZE outperforms every silver-ion / QAC / zinc / chitosan competitor on cellulose at this dose" },
    ],
  },
] as const;

export function Gradebadge({ grade, score }: { grade: string; score: number }) {
  const color =
    score >= 90 ? "bg-emerald-500" :
    score >= 70 ? "bg-emerald-400" :
    score >= 50 ? "bg-yellow-500" :
    score >= 30 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${color} text-white font-black text-2xl shadow-lg`}>
      {grade}
    </div>
  );
}
