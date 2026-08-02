// @ts-nocheck
/**
 * Red Rover seed data + seeding logic — single source of truth shared by
 * the /api/cron/seed-red-rover route and scripts/seed-red-rover.ts.
 *
 * Takes a Prisma client as an argument so it stays portable (no @/lib/prisma
 * import) and can run from a plain tsx script against caboose.
 *
 * The 14-target book, all owned by Josh Lujan, ranked per the LOCKED
 * RANKING (2026-08-01, Andrew). EU targets carry the EU biocide phase-out
 * CATALYST in their intel (2028 review / 2030 exit — a lever, not a lead).
 */

export const JOSH_ID = "cmrmb51hk0000lb04r6ceoemn"; // Josh Lujan — owns the whole book

export const EU_CATALYST =
  "EU biocide phase-out — 2028 review, 2030 deadline for European chemical companies to exit toxic biocides. " +
  "Use as a negotiation CATALYST (don't lead with it); position FUZE (non-leaching, PFAS-free, non-toxic) as the compliant replacement.";

function withCatalyst(intel: string | null): string {
  const base = (intel || "").trim();
  return base ? `${base}\n\n${EU_CATALYST}` : EU_CATALYST;
}

export type SeedContact = {
  name: string;
  title?: string;
  email?: string;
  side?: "TARGET" | "FUZE";
  role?: "NEGOTIATION" | "TECHNICAL_GATEKEEPER";
  notes?: string;
};

export type SeedTarget = {
  name: string;
  rank: number;
  tier: "TIER1" | "TIER2" | "PARKED";
  stage:
    | "IDENTIFIED"
    | "CONTACTED"
    | "PRESENTATION"
    | "TESTING"
    | "AGREEMENT"
    | "ACTIVE"
    | "STALLED"
    | "PARKED";
  companyClass: string;
  geo: string;
  initialContact?: string;
  keyMeetings?: string;
  currentAgreements?: string;
  currentStatus?: string;
  nextStep?: string;
  whoDroveIt?: string;
  intel?: string;
  contacts?: SeedContact[];
};

export const TARGETS: SeedTarget[] = [
  {
    name: "CHT",
    rank: 1,
    tier: "TIER1",
    stage: "CONTACTED",
    companyClass: "Textile-chemical major (CHT Group)",
    geo: "Germany",
    currentStatus: "Engaged; full presentation pending.",
    nextStep: "Schedule and deliver the full FUZE presentation.",
    whoDroveIt: "Andrew.",
    intel: withCatalyst(
      "Joscha Teubert is NOT the CHT contact. (Joscha = ex-Archroma, open to a move → talent / intel angle.)",
    ),
  },
  {
    name: "Transfar",
    rank: 2,
    tier: "TIER1",
    stage: "PRESENTATION",
    companyClass: "Textile-chemical distributor (world's largest)",
    geo: "China (Shanghai)",
    currentStatus:
      "Active pricing + technical dialogue — FTP F1 dyebath 130°C exhaust, ~RMB250/kg, cost-to-factory framing.",
    nextStep: "Technical + platform presentation; China trip.",
    whoDroveIt: "Andrew (lead); Tandy — China technical.",
    contacts: [{ name: "Henry Wang", side: "TARGET", role: "NEGOTIATION" }],
  },
  {
    name: "Sanitized",
    rank: 3,
    tier: "TIER1",
    stage: "CONTACTED",
    companyClass: "Antimicrobial brand-owner (Sanitized AG)",
    geo: "Switzerland",
    currentStatus: "Lead-in via Lee Howarth.",
    nextStep: "Full presentation.",
    whoDroveIt: "Andrew + Lee Howarth.",
    intel: withCatalyst(
      "Unhappy with the Archroma→Rudolf exclusive-distributor switch (Rudolf's quiver carries 10+ competing products → Sanitized sidelined). Receptivity lever.",
    ),
    contacts: [
      {
        name: "Lee Howarth",
        title: "Sanitized lead-in",
        side: "FUZE",
        role: "NEGOTIATION",
        notes: "Introduction path into Sanitized (not a recruit).",
      },
    ],
  },
  {
    name: "Polygiene",
    rank: 4,
    tier: "TIER1",
    stage: "TESTING",
    companyClass:
      "Antimicrobial brand-owner (silver-chloride StayFresh/ViralOff; under HeiQ Group)",
    geo: "Sweden",
    currentStatus:
      "Live technical eval; open-book Q&A on $36/kg, EPA 90890-1/-2, HeiQ FFL fouling, and difficult fabrics; shared 99.9% cotton @100 washes (AATCC 100 & ASTM E2149).",
    nextStep: "Full presentation; support the evaluation.",
    whoDroveIt: "Andrew + Josh.",
    intel: withCatalyst("HeiQ owns Polygiene — one entry point."),
    contacts: [
      {
        name: "Henry K",
        title: "Head of Technical",
        side: "TARGET",
        role: "TECHNICAL_GATEKEEPER",
      },
    ],
  },
  {
    name: "Archroma",
    rank: 5,
    tier: "TIER1",
    stage: "AGREEMENT",
    companyClass: "Global textile-chemical major",
    geo: "Switzerland",
    currentAgreements:
      "Distribution agreement ALREADY IN PLACE, approved by Dave Parkinson.",
    currentStatus:
      "OPEN: how the existing agreement figures with Archroma's new HeiQ deal. Latest thread: Roland (Archroma), late 2025.",
    nextStep: "Reconcile the existing agreement vs the HeiQ deal via Roland.",
    whoDroveIt: "Andrew + Dave Parkinson.",
    intel: withCatalyst(null),
    contacts: [{ name: "Roland", side: "TARGET", role: "NEGOTIATION" }],
  },
  {
    name: "Concept III",
    rank: 6,
    tier: "TIER1",
    stage: "CONTACTED",
    companyClass: "US textile sales arm + distributor",
    geo: "USA",
    currentStatus:
      "Massive sales arm + distributor; historically exclusive with Polygiene (refused other antimicrobials); Polygiene now absent from their site; still reps big mills.",
    nextStep:
      "Ryan books intro + Q&A → identify their standard antimicrobial → replace with FUZE across the sales process + fabrics.",
    whoDroveIt: "Andrew → Ryan (book) → Josh (close).",
    intel:
      "Intro vehicle: 'Fuze X DryTex'. conceptiii.com. Ties to the Polygiene target.",
    contacts: [
      {
        name: "Ryan Prince",
        email: "ryan.prince@fuze47.com",
        side: "FUZE",
        role: "NEGOTIATION",
        notes: "Books the intro + Q&A call.",
      },
    ],
  },
  {
    name: "Rudolf (Duraner/Turkey)",
    rank: 7,
    tier: "TIER2",
    stage: "TESTING",
    companyClass: "Textile-chemical major (Rudolf GmbH Turkey JV)",
    geo: "Turkey",
    currentStatus:
      "Turkey office (not the German HQ) certified FUZE lab validation; SRS funded the full Turkish testing battery toward Turkey/EU approval.",
    nextStep: "Resolve the test-standard path; complete Turkey/EU approval.",
    whoDroveIt: "Andrew + SRS + Turkey lead scientist.",
    intel: withCatalyst(
      "HANGUP: their textile test method descends from surface-sanitizer testing (5–10 min kill standard) — non-leaching FUZE can't meet it on that standard. OPEN: name the Turkey lead scientist.",
    ),
  },
  {
    name: "Microban",
    rank: 8,
    tier: "TIER2",
    stage: "IDENTIFIED",
    companyClass: "#1 antimicrobial additives",
    geo: "USA",
    currentStatus: "Highest-value antimicrobial target; US talent anchor.",
    nextStep: "Outreach.",
  },
  {
    name: "Milliken",
    rank: 9,
    tier: "TIER2",
    stage: "CONTACTED",
    companyClass: "US textile/chemical major (AlphaSan)",
    geo: "USA",
    currentStatus: "Warm intro via Bob + a prior email to Todd Moore.",
    nextStep: "Reconnect via Todd Moore.",
    whoDroveIt: "Andrew (Bob → Todd Moore).",
    contacts: [{ name: "Todd Moore", side: "TARGET", role: "NEGOTIATION" }],
  },
  {
    name: "Hi-Goal",
    rank: 10,
    tier: "TIER2",
    stage: "ACTIVE",
    companyClass: "Existing FUZE distributor being elevated",
    geo: "Shanghai, China",
    currentStatus:
      "Active distributor (Shanghai HiGoal factory testing); pairs with Transfar on the Asia (Shanghai) leg.",
    nextStep: "Define the elevation plan.",
    whoDroveIt: "Danny / Tina.",
  },
  {
    name: "Pulcra Chemicals",
    rank: 11,
    tier: "PARKED",
    stage: "PARKED",
    companyClass: "Textile specialty-chemical major",
    geo: "Germany",
    intel: withCatalyst(null),
  },
  {
    name: "DyStar",
    rank: 12,
    tier: "PARKED",
    stage: "PARKED",
    companyClass: "Global dye/textile-chemical major",
    geo: "Singapore (German ops)",
    intel: withCatalyst(null),
  },
  {
    name: "Sciessent",
    rank: 13,
    tier: "PARKED",
    stage: "PARKED",
    companyClass: "US antimicrobial (Agion/Lava)",
    geo: "USA",
    intel:
      "Andrew met Meg (surname TBD) to recruit/poach — referral from Malcolm at Matchmaster. [talent + intel angle]",
  },
  {
    name: "Kaneyo / Kanematsu",
    rank: 14,
    tier: "TIER2",
    stage: "CONTACTED",
    companyClass:
      "Japanese trading house / distribution arm (KANEYO CO., Osaka; Kanematsu sogo shosha)",
    geo: "Japan",
    currentStatus:
      "Trading-house adoption + Japan distribution expansion (not single-brand product-dev); elevate the existing relationship to a distribution/adoption agreement.",
    nextStep: "Define the Japan distribution path.",
    whoDroveIt: "Andrew.",
    intel: "Asia leg — Japan stop.",
    contacts: [
      {
        name: "Amon Yamaguchi",
        email: "amon_yamaguchi@kwm.kanematsu.co.jp",
        side: "TARGET",
        role: "NEGOTIATION",
      },
    ],
  },
];

// Free-text dossier fields we backfill-only (never clobber live edits).
const TEXT_FIELDS = [
  "initialContact",
  "keyMeetings",
  "currentAgreements",
  "currentStatus",
  "nextStep",
  "whoDroveIt",
  "intel",
] as const;

/**
 * Idempotent seed. Structural fields (rank/tier/stage/class/geo/owner)
 * always reconcile to the seed; free-text dossier fields are backfilled
 * only when empty so live edits survive a re-run. Contacts are
 * create-if-missing by (target, name).
 */
export async function seedRedRover(prisma: any) {
  const results: any[] = [];

  for (const t of TARGETS) {
    const existing = await prisma.redRoverTarget.findFirst({
      where: { name: t.name },
    });

    const structural = {
      rank: t.rank,
      tier: t.tier,
      stage: t.stage,
      companyClass: t.companyClass,
      geo: t.geo,
      ownerId: JOSH_ID,
    };

    let target;
    if (!existing) {
      const textData: Record<string, any> = {};
      for (const f of TEXT_FIELDS) if (t[f] != null) textData[f] = t[f];
      target = await prisma.redRoverTarget.create({
        data: { name: t.name, ...structural, ...textData },
      });
      results.push({ name: t.name, action: "created", id: target.id });
    } else {
      const textData: Record<string, any> = {};
      for (const f of TEXT_FIELDS) {
        const cur = (existing as any)[f];
        if ((cur == null || cur === "") && t[f] != null) textData[f] = t[f];
      }
      target = await prisma.redRoverTarget.update({
        where: { id: existing.id },
        data: { ...structural, ...textData },
      });
      results.push({
        name: t.name,
        action: "updated",
        id: target.id,
        backfilled: Object.keys(textData),
      });
    }

    for (const c of t.contacts || []) {
      const existingC = await prisma.redRoverContact.findFirst({
        where: { targetId: target.id, name: c.name },
      });
      if (!existingC) {
        await prisma.redRoverContact.create({
          data: {
            targetId: target.id,
            name: c.name,
            title: c.title ?? null,
            email: c.email ?? null,
            side: c.side ?? "TARGET",
            role: c.role ?? "NEGOTIATION",
            notes: c.notes ?? null,
          },
        });
      }
    }
  }

  const total = await prisma.redRoverTarget.count();
  const byJosh = await prisma.redRoverTarget.count({ where: { ownerId: JOSH_ID } });
  const contacts = await prisma.redRoverContact.count();

  return {
    ok: true,
    seeded: results.length,
    totalTargets: total,
    ownedByJosh: byJosh,
    totalContacts: contacts,
    results,
  };
}
