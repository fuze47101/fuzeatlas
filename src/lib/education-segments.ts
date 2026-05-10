/**
 * Slim configuration for /education/[segment] sub-pages.
 *
 * Phase 2 of ROADMAP_v2 — segment-specific FUZE education for the
 * verticals Andrew listed (hospitality, intimates, kids/baby, workwear,
 * athletic, medical). Page-per-segment was rejected as duplicative;
 * one dynamic route + this config drives all of them.
 *
 * Add a segment by appending an entry. Keep `body` to short paragraphs
 * — the segment landing pages are pitch tools, not encyclopedias.
 *
 * Brand voice rules apply: FUZE / metamaterial only, never silver/nano.
 * The /education main page ALREADY uses competitor names with explicit
 * chemistry (silver-ion, AgCl) inside attribution context; segment
 * copy below talks about FUZE on its own terms.
 */

export type SegmentSlug =
  | "hospitality"
  | "intimates"
  | "kids"
  | "workwear"
  | "athletic"
  | "medical";

export interface SegmentRecommendedTier {
  tier: "F1" | "F2" | "F3" | "F4";
  why: string;
}

export interface SegmentMetric {
  label: string;
  value: string;
  blurb?: string;
}

export interface SegmentTestPriority {
  test: string;
  why: string;
}

export interface SegmentConfig {
  slug: SegmentSlug;
  title: string;
  audience: string;
  hero: string;
  body: string[];
  recommendedTiers: SegmentRecommendedTier[];
  primaryTests: SegmentTestPriority[];
  proofPoints: SegmentMetric[];
  primaryRegulatory: string[];
  /** Two-or-three sentence outreach hook reps can paste into emails. */
  outreachHook: string;
  /** Optional follow-up CTA links. Local app paths only — no external URLs. */
  ctas?: Array<{ href: string; label: string }>;
}

const SEGMENTS: Record<SegmentSlug, SegmentConfig> = {
  hospitality: {
    slug: "hospitality",
    title: "Hospitality",
    audience: "Hotels, hotel groups, hospitality linen suppliers, B&L laundry programs",
    hero: "Antimicrobial bedding, sheets, towels, and table linens that survive industrial wash cycles.",
    body: [
      "Hospitality linens take more wash hits per year than any other textile category. A typical hotel sheet sees 200+ industrial laundry cycles before retirement. Most antimicrobial finishes are gone within 30 cycles.",
      "FUZE bonds permanently into the fiber and runs on the contact-kill mechanism. Wash water stays clean, the metamaterial stays on the fabric, and the antimicrobial protection stays at spec for the rated wash life of the tier.",
      "Hospitality groups using FUZE can hold a single durable spec across the entire linen pool — sheets, towels, robes, table linens — without the per-item retreatment programs every leaching-chemistry vendor requires.",
    ],
    recommendedTiers: [
      {
        tier: "F1",
        why: "Heavy-duty hospitality wash counts (200+) and color hold for high-end linens.",
      },
      {
        tier: "F2",
        why: "Standard hospitality programs — guest sheets, pillowcases, mid-tier towels.",
      },
    ],
    primaryTests: [
      {
        test: "AATCC 100",
        why: "Hospitality buyers default to AATCC 100 reports; FUZE F1/F2 passes through the layered geometry.",
      },
      {
        test: "ISO 20743",
        why: "Required by EU hospitality groups and Asian linen suppliers.",
      },
      {
        test: "AATCC 30",
        why: "Antifungal validation is critical for humid environments and pool/spa textile programs.",
      },
    ],
    proofPoints: [
      { label: "Wash life (F1)", value: "100 wash cycles", blurb: "Validated through internal AATCC 100 / ISO 20743 protocol." },
      { label: "Wash life (F2)", value: "75 wash cycles" },
      { label: "Active dose (F1)", value: "1.0 mg/kg" },
    ],
    primaryRegulatory: [
      "EPA federal registration",
      "California EPA approved (Q1 2026)",
      "OEKO-TEX Standard 100 Class I",
      "PFAS-free",
    ],
    outreachHook:
      "We're rolling FUZE out across hospitality linen programs in the US Northeast right now (NY market, Q2 2026). FUZE bonds permanently into the fiber and runs at 0.75 mg/kg — no binder, no curing oven, no formaldehyde. Brands switching from silver-ion programs see equal-or-better antimicrobial performance with zero leaching into laundry effluent. Worth a 20-minute walkthrough?",
    ctas: [
      { href: "/pricing", label: "See cost vs a specific competitor →" },
      { href: "/sustainability", label: "See sustainability impact →" },
    ],
  },

  intimates: {
    slug: "intimates",
    title: "Intimates & Next-to-Skin",
    audience: "Intimate apparel brands, base-layer brands, skin-contact athletic apparel",
    hero: "OEKO-TEX Class I antimicrobial — for the most regulated skin-contact category.",
    body: [
      "Intimates and base layers sit against skin for 8-16 hours a day. The antimicrobial chemistry choice has to clear OEKO-TEX Class I (the strictest skin-contact category) and has to be defensible against parabens / formaldehyde / silver-ion regulatory tailwinds.",
      "FUZE is OEKO-TEX Standard 100 Class I certified. It bonds to the fiber and doesn't migrate to skin. It doesn't release silver ions, doesn't crosslink with formaldehyde, and doesn't include any of the chemistries currently named in EU and US restricted-substance lists (PFAS, BPA, parabens).",
      "Brands building around 'clean' or 'sensitive skin' positioning can credibly cite FUZE in their substance-free claims — and back it up with the OEKO-TEX cert + EPA registration documentation.",
    ],
    recommendedTiers: [
      { tier: "F2", why: "Most performance-grade intimates — body wash + odor + color hold." },
      { tier: "F3", why: "Standard intimates programs at modest price point." },
    ],
    primaryTests: [
      {
        test: "ASTM E2149",
        why: "Skin-contact testing benefits from the dynamic-contact test that matches FUZE mechanism.",
      },
      {
        test: "ISO 18184",
        why: "Antiviral validation for premium intimates positioning.",
      },
    ],
    proofPoints: [
      { label: "Wash life (F2)", value: "75 wash cycles" },
      { label: "OEKO-TEX", value: "Standard 100 Class I", blurb: "The strictest skin-contact category." },
      { label: "PFAS", value: "Zero" },
    ],
    primaryRegulatory: [
      "OEKO-TEX Standard 100 Class I",
      "bluesign® approved",
      "EPA federal registration",
      "California EPA approved (Q1 2026)",
      "PFAS-free",
    ],
    outreachHook:
      "FUZE clears OEKO-TEX Standard 100 Class I — the same skin-contact category your fabrics already certify into. We bond into the fiber permanently at 0.75 mg/kg, no binder, no formaldehyde, no PFAS. With Texas AG investigating Lululemon for PFAS in activewear and California SB 707 in force, FUZE is the only antimicrobial with zero exposure on either of those regulatory fronts. Worth a 20-minute walkthrough?",
    ctas: [{ href: "/pricing", label: "See cost vs your current spec →" }],
  },

  kids: {
    slug: "kids",
    title: "Kids & Baby",
    audience: "Children's apparel brands, baby gear (sleep sacks, blankets, swaddles), nursery textiles",
    hero: "EPA-registered + California-approved + PFAS-free — built for the most scrutinized category.",
    body: [
      "Kids and baby textiles get the sharpest regulatory and parental scrutiny of any apparel category. Anything migrating to a child's skin, anything classified as an aquatic toxin, and anything PFAS-related is a brand-killer once it hits press.",
      "FUZE doesn't leach. There is no metal in the wash water from FUZE-treated sheets, sleep sacks, or onesies. It carries the EPA federal registration and the California EPA approval (Q1 2026) — the two regulatory benchmarks parents and retailers actually check for.",
      "It's also PFAS-free, with no formaldehyde crosslinker and no acrylic binder polymer. No restricted-substance carrier chemistry comes along for the ride.",
    ],
    recommendedTiers: [
      { tier: "F3", why: "Standard kids/baby apparel — comfortable cost-to-performance." },
      { tier: "F4", why: "Crib sheets and high-volume nursery textiles where cost rules." },
    ],
    primaryTests: [
      {
        test: "ASTM E2149",
        why: "Direct-contact testing — what matters for skin contact at small body size.",
      },
      {
        test: "AATCC 30",
        why: "Antifungal — required for sleep environment textiles.",
      },
    ],
    proofPoints: [
      { label: "EPA", value: "Federal registered" },
      { label: "California EPA", value: "Approved Q1 2026" },
      { label: "PFAS", value: "Zero" },
      { label: "Formaldehyde", value: "Zero" },
    ],
    primaryRegulatory: [
      "EPA federal registration",
      "California EPA approved (Q1 2026)",
      "OEKO-TEX Standard 100 Class I",
      "PFAS-free",
      "No formaldehyde",
    ],
    outreachHook:
      "Texas AG just opened an investigation into Lululemon over PFAS in activewear. California SB 707 restricts PFAS in textiles. If your kids/baby line uses any silver-ion, AgCl, or PFAS-finished antimicrobial, you're one investigative-journalism cycle away from a brand crisis. FUZE is EPA-registered, Cal EPA-approved, and contains zero PFAS / silver / formaldehyde. Worth a 20-minute walkthrough?",
    ctas: [{ href: "/pricing", label: "See your cost on a kids program →" }],
  },

  workwear: {
    slug: "workwear",
    title: "Workwear & Uniforms",
    audience: "Industrial workwear brands, healthcare uniforms, hospitality staff uniforms, FR-treated workwear",
    hero: "Wash-cycle durability that survives the industrial laundry program.",
    body: [
      "Workwear and uniforms see industrial laundry — high-temp, high-pH detergent, alkaline rinse, oxidative bleach. Most antimicrobial finishes don't survive 50 cycles of that environment. Silver-ion finishes oxidize, AgCl converts to soluble silver salts in alkaline rinse, and zinc finishes wash off entirely.",
      "FUZE is non-leaching by design — the metamaterial bonds into the fiber and stays there through industrial wash conditions. The contact-kill mechanism doesn't depend on having a labile ion pool that can be stripped out by aggressive detergent chemistry.",
      "For FR (flame-resistant) workwear, FUZE is compatible with the standard FR finishes (Proban, Pyrovatex, inherent-FR fibers) and applies in the same exhaust or pad-dry-cure step — no extra production passes.",
    ],
    recommendedTiers: [
      { tier: "F1", why: "Heavy industrial wash + multi-year uniform programs." },
      { tier: "F2", why: "Standard healthcare and food-service uniforms." },
    ],
    primaryTests: [
      {
        test: "ASTM E2149",
        why: "Dynamic-contact test — durable performance through the industrial wash program.",
      },
      {
        test: "AATCC 100",
        why: "Required at higher tiers for healthcare and government workwear contracts.",
      },
    ],
    proofPoints: [
      { label: "Wash life (F1)", value: "100 industrial wash cycles" },
      { label: "Wash life (F2)", value: "75 industrial wash cycles" },
      { label: "FR compatibility", value: "Compatible with Proban / Pyrovatex / inherent-FR" },
    ],
    primaryRegulatory: [
      "EPA federal registration",
      "California EPA approved (Q1 2026)",
      "OEKO-TEX Standard 100 Class I",
      "PFAS-free",
    ],
    outreachHook:
      "Industrial wash chemistry strips most silver-ion and zinc antimicrobial finishes out of uniform fabrics inside 30-50 cycles. FUZE bonds into the fiber and survives the full uniform service life — F1 documented through 100 industrial cycles, with the third-party reports on file. Worth a 20-minute walkthrough?",
    ctas: [{ href: "/pricing", label: "Cost on a uniform program →" }],
  },

  athletic: {
    slug: "athletic",
    title: "Athletic & Performance",
    audience: "Activewear brands, performance apparel, technical outdoor brands",
    hero: "Antimicrobial + odor + UV + microfiber control — every benefit stacked into one application.",
    body: [
      "Performance brands have to layer multiple finishes onto a single fabric: antimicrobial, moisture management, UV protection, color hold. Most chemistries do one job. FUZE F1 stacks all of them in one mill application.",
      "F1 Full Spectrum delivers the antimicrobial baseline plus active fabric performance (faster drying, improved evaporation), color fastness improvement, UVA/UVB fiber protection, microfiber shielding (reduces wash-water shedding), and detergent chemistry catalysis. Every benefit is permanent for the rated wash life.",
      "It's also PFAS-free, formaldehyde-free, OEKO-TEX Class I, and EPA-registered — exactly the regulatory stack performance brands need as Texas AG / California SB 707 / EU REACH rules tighten on activewear.",
    ],
    recommendedTiers: [
      { tier: "F1", why: "The full benefit stack — antimicrobial + UV + color + microfiber." },
      { tier: "F2", why: "Most activewear programs — antimicrobial + color + UV." },
    ],
    primaryTests: [
      {
        test: "ASTM E2149",
        why: "Direct-contact test — the right validation for performance fabrics at standard density.",
      },
      {
        test: "AATCC 100",
        why: "Required at premium tiers; F1/F2 pass.",
      },
      {
        test: "ISO 18184",
        why: "Antiviral test — useful for performance apparel marketed as 'germ-resistant'.",
      },
    ],
    proofPoints: [
      { label: "Wash life (F1)", value: "100 wash cycles" },
      { label: "F1 benefits", value: "Antimicrobial + UV + color + microfiber" },
      { label: "PFAS", value: "Zero" },
    ],
    primaryRegulatory: [
      "EPA federal registration",
      "California EPA approved (Q1 2026)",
      "OEKO-TEX Standard 100 Class I",
      "bluesign® approved",
      "PFAS-free",
    ],
    outreachHook:
      "Texas AG is investigating Lululemon over PFAS in activewear. California SB 707 is restricting PFAS in textiles. Most antimicrobial finishes on activewear today either contain PFAS or sit alongside it — the regulatory exposure on existing performance fabric specs is real and growing. FUZE F1 stacks antimicrobial + UV + color hold + microfiber control into one PFAS-free, EPA-registered application. Worth a 20-minute walkthrough?",
    ctas: [{ href: "/pricing", label: "Cost on a performance program →" }],
  },

  medical: {
    slug: "medical",
    title: "Medical & Healthcare",
    audience: "Hospital linen suppliers, scrubs brands, patient gown manufacturers, medical mask/PPE textiles",
    hero: "Antibacterial + antiviral + antifungal validation, on the right test stack.",
    body: [
      "Medical and healthcare textiles need a complete antimicrobial validation stack — antibacterial, antiviral, and antifungal — across the wash life of the textile. Most finishes only have antibacterial data; antiviral and antifungal are usually self-published or absent.",
      "FUZE has third-party reports across all three: AATCC 100 / ASTM E2149 for antibacterial, ISO 18184 for antiviral, AATCC 30 for antifungal. Reports are shared with hospital procurement on request — that's the asymmetry vs leaching chemistries, where vendors don't share their AATCC 100 reports.",
      "FUZE is also EPA federally registered and Cal EPA approved, with documented OEKO-TEX Class I certification. The full regulatory stack required for procurement-driven hospital supply contracts.",
    ],
    recommendedTiers: [
      { tier: "F1", why: "Hospital linens with extended wash service life." },
      { tier: "F2", why: "Scrubs, patient gowns, masks, and standard healthcare textiles." },
    ],
    primaryTests: [
      {
        test: "ASTM E2149",
        why: "Direct-contact validation — the most relevant test for surface-contact pathogen reduction.",
      },
      {
        test: "ISO 18184",
        why: "Antiviral textile testing — required for any 'antiviral' procurement claim.",
      },
      {
        test: "AATCC 30",
        why: "Antifungal validation — required for hospital linen and patient-care textiles.",
      },
      {
        test: "AATCC 100",
        why: "Standard antibacterial procurement requirement; F1 passes through the layered geometry.",
      },
    ],
    proofPoints: [
      { label: "Antibacterial", value: "AATCC 100 / E2149 third-party reports" },
      { label: "Antiviral", value: "ISO 18184 third-party reports" },
      { label: "Antifungal", value: "AATCC 30 third-party reports" },
      { label: "Wash life (F1)", value: "100 wash cycles" },
    ],
    primaryRegulatory: [
      "EPA federal registration",
      "California EPA approved (Q1 2026)",
      "OEKO-TEX Standard 100 Class I",
      "PFAS-free",
    ],
    outreachHook:
      "Hospital procurement increasingly asks for the full antimicrobial validation stack — antibacterial + antiviral + antifungal — across the textile's wash service life. Most antimicrobial vendors only share antibacterial data. FUZE has third-party AATCC 100 / ASTM E2149 / ISO 18184 / AATCC 30 reports across all three categories, plus EPA + Cal EPA registration. We share the reports with procurement on request. Worth a 20-minute walkthrough?",
    ctas: [{ href: "/pricing", label: "Cost on a medical program →" }],
  },
};

export const SEGMENT_ORDER: SegmentSlug[] = [
  "hospitality",
  "intimates",
  "kids",
  "workwear",
  "athletic",
  "medical",
];

export function getSegmentConfig(slug: string): SegmentConfig | null {
  if (!Object.prototype.hasOwnProperty.call(SEGMENTS, slug)) return null;
  return SEGMENTS[slug as SegmentSlug];
}

export function listSegments(): SegmentConfig[] {
  return SEGMENT_ORDER.map((s) => SEGMENTS[s]);
}
