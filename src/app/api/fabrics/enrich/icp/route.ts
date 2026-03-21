// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ------------------------------------------------------------------ *
 *  ICP Test Profile Generator — FUZE Allotrope Model
 *
 *  FUZE high density allotrope operates at 0.10 – 1.0 mg/kg (ppm).
 *  Max application is ~2.0 mg/kg on the extreme high end.
 *
 *  Pricing tiers:
 *    F1 = ~1.0 mg/kg  (Full Spectrum)
 *    F2 = ~0.75 mg/kg (Advanced Performance)
 *    F3 = ~0.50 mg/kg (Core Performance)
 *    F4 = ~0.25 mg/kg (Essential Protection)
 *
 *  Antimicrobial correlation:
 *    ASTM E2149 (dynamic shake flask):
 *      - 80% of fabrics at ≥0.5 ppm show >99.9% reduction
 *      - 20% show 90-95% reduction (still passing)
 *      - Below 0.25 ppm, dropoff begins
 *
 *    AATCC 100 (absorption method):
 *      - Excellent results at 0.75-1.0 ppm
 *      - Falls off below 0.5 ppm
 *      - Cotton shows strong performance even at lower concentrations
 *
 *  Cotton absorbs allotrope more efficiently than synthetics,
 *  achieving >90% reduction even at 0.25 ppm.
 *
 *  All generated data is tagged with [FI] for human review.
 * ------------------------------------------------------------------ */

// ── FUZE ICP ranges by fiber type + construction ──────────────────

interface FuzeIcpProfile {
  agRange: [number, number];   // Ag ppm (mg/kg) — FUZE allotrope detection
  tierDistribution: number[];  // Probability weights for [F1, F2, F3, F4] tier assignment
  confidence: "HIGH" | "MEDIUM" | "LOW";
  notes: string;
}

const FUZE_PROFILES: Record<string, FuzeIcpProfile> = {
  // Cotton-dominant — excellent allotrope uptake, high efficacy at lower concentrations
  "Cotton|knit": {
    agRange: [0.20, 0.95],
    tierDistribution: [0.20, 0.30, 0.35, 0.15], // Skews F2-F3, cotton doesn't need as much
    confidence: "HIGH",
    notes: "Cotton knits — excellent allotrope absorption via exhaust method",
  },
  "Cotton|woven": {
    agRange: [0.18, 0.90],
    tierDistribution: [0.15, 0.30, 0.35, 0.20],
    confidence: "HIGH",
    notes: "Cotton wovens — strong uptake, slightly lower than knits due to tighter construction",
  },
  // Polyester-dominant — requires more allotrope for equivalent performance
  "Polyester|knit": {
    agRange: [0.30, 1.00],
    tierDistribution: [0.25, 0.35, 0.25, 0.15],
    confidence: "MEDIUM",
    notes: "Polyester knits — pad application, allotrope adhesion varies with finish state",
  },
  "Polyester|woven": {
    agRange: [0.35, 1.00],
    tierDistribution: [0.30, 0.35, 0.25, 0.10],
    confidence: "MEDIUM",
    notes: "Polyester wovens — tighter construction needs higher concentration for efficacy",
  },
  // Nylon — good affinity for allotrope
  "Polyamide (Nylon)|knit": {
    agRange: [0.25, 0.95],
    tierDistribution: [0.20, 0.30, 0.30, 0.20],
    confidence: "MEDIUM",
    notes: "Nylon knits — good allotrope affinity via amide bond interaction",
  },
  "Polyamide (Nylon)|woven": {
    agRange: [0.25, 0.90],
    tierDistribution: [0.20, 0.35, 0.30, 0.15],
    confidence: "MEDIUM",
    notes: "Nylon wovens — solid retention, comparable to cotton",
  },
  // Blends
  "blend|knit": {
    agRange: [0.20, 0.95],
    tierDistribution: [0.20, 0.30, 0.30, 0.20],
    confidence: "MEDIUM",
    notes: "Blended knits — uptake correlates with cotton percentage in blend",
  },
  "blend|woven": {
    agRange: [0.25, 0.95],
    tierDistribution: [0.25, 0.30, 0.30, 0.15],
    confidence: "LOW",
    notes: "Blended wovens — wider range, depends on fiber ratio and finish",
  },
  // Fallback
  "default": {
    agRange: [0.15, 1.00],
    tierDistribution: [0.25, 0.25, 0.25, 0.25],
    confidence: "LOW",
    notes: "Generic estimate — insufficient data for fiber-specific prediction",
  },
};

// Tier concentration centers (mg/kg)
const TIER_CENTERS = {
  F1: { center: 0.90, spread: 0.10 },  // 0.80 - 1.00
  F2: { center: 0.70, spread: 0.08 },  // 0.62 - 0.78
  F3: { center: 0.45, spread: 0.08 },  // 0.37 - 0.53
  F4: { center: 0.22, spread: 0.06 },  // 0.16 - 0.28
};

function getProfile(dominantFiber: string | null, category: string | null): FuzeIcpProfile & { key: string } {
  const fiber = dominantFiber || "default";
  const cat = (category || "").toLowerCase();
  const catKey = /knit|jersey|rib|interlock|tricot/i.test(cat) ? "knit" : /woven|weave|plain|twill|satin/i.test(cat) ? "woven" : "knit";

  const specificKey = `${fiber}|${catKey}`;
  if (FUZE_PROFILES[specificKey]) return { ...FUZE_PROFILES[specificKey], key: specificKey };

  const blendKey = `blend|${catKey}`;
  if (FUZE_PROFILES[blendKey]) return { ...FUZE_PROFILES[blendKey], key: blendKey };

  return { ...FUZE_PROFILES["default"], key: "default" };
}

// ── Seeded random for reproducible results per fabric ID ──────────
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return () => {
    hash = (hash * 1664525 + 1013904223) & 0x7fffffff;
    return hash / 0x7fffffff;
  };
}

// ── Pick tier based on distribution weights ──────────────────────
function pickTier(distribution: number[], rng: () => number): string {
  const tiers = ["F1", "F2", "F3", "F4"];
  const roll = rng();
  let cumulative = 0;
  for (let i = 0; i < distribution.length; i++) {
    cumulative += distribution[i];
    if (roll < cumulative) return tiers[i];
  }
  return "F3"; // fallback
}

// ── Generate Ag concentration for a given tier ──────────────────
function generateAgValue(tier: string, rng: () => number): number {
  const t = TIER_CENTERS[tier as keyof typeof TIER_CENTERS] || TIER_CENTERS.F3;
  const value = t.center + (rng() - 0.5) * 2 * t.spread;
  return Math.round(Math.max(0.10, Math.min(1.20, value)) * 100) / 100;
}

// ── Antibacterial estimation based on FUZE allotrope concentration ──
function estimateAntibacterial(
  agPpm: number,
  isCotton: boolean,
  rng: () => number
): {
  astm2149: { reduction: string; pass: boolean; organism: string };
  aatcc100: { reduction: string; pass: boolean; organism: string };
  tier: string;
} {
  // Determine effective tier
  let tier = "F4";
  if (agPpm >= 0.80) tier = "F1";
  else if (agPpm >= 0.60) tier = "F2";
  else if (agPpm >= 0.35) tier = "F3";

  // Cotton bonus: equivalent to ~1 tier higher performance at same concentration
  const effectivePpm = isCotton ? agPpm * 1.4 : agPpm;

  // ── ASTM E2149 (dynamic shake flask) ──
  // 80% at ≥0.5 ppm get 99.9%, 20% split between 90-95% and 75-90%
  let astm2149reduction: string;
  let astm2149pass: boolean;

  if (effectivePpm >= 0.50) {
    const roll = rng();
    if (roll < 0.80) {
      astm2149reduction = ">99.9%";
      astm2149pass = true;
    } else if (roll < 0.90) {
      // 10% in 95-99.9 range
      const pct = (95 + rng() * 4.9).toFixed(1);
      astm2149reduction = `${pct}%`;
      astm2149pass = true;
    } else {
      // 10% in 90-95 range
      const pct = (90 + rng() * 5).toFixed(1);
      astm2149reduction = `${pct}%`;
      astm2149pass = true;
    }
  } else if (effectivePpm >= 0.30) {
    const roll = rng();
    if (roll < 0.50) {
      astm2149reduction = ">99.9%";
      astm2149pass = true;
    } else if (roll < 0.80) {
      const pct = (90 + rng() * 9.9).toFixed(1);
      astm2149reduction = `${pct}%`;
      astm2149pass = true;
    } else {
      const pct = (75 + rng() * 15).toFixed(1);
      astm2149reduction = `${pct}%`;
      astm2149pass = parseFloat(pct) >= 80;
    }
  } else {
    // Below 0.30 effective — dropoff
    const roll = rng();
    if (roll < 0.30) {
      const pct = (85 + rng() * 14.9).toFixed(1);
      astm2149reduction = `${pct}%`;
      astm2149pass = true;
    } else {
      const pct = (50 + rng() * 35).toFixed(1);
      astm2149reduction = `${pct}%`;
      astm2149pass = parseFloat(pct) >= 80;
    }
  }

  // ── AATCC 100 (absorption method) ──
  // Awesome results at 0.75-1.0, falls off below that
  let aatcc100reduction: string;
  let aatcc100pass: boolean;

  if (effectivePpm >= 0.75) {
    const roll = rng();
    if (roll < 0.85) {
      aatcc100reduction = ">99.9%";
      aatcc100pass = true;
    } else {
      const pct = (95 + rng() * 4.9).toFixed(1);
      aatcc100reduction = `${pct}%`;
      aatcc100pass = true;
    }
  } else if (effectivePpm >= 0.50) {
    const roll = rng();
    if (roll < 0.60) {
      aatcc100reduction = ">99.9%";
      aatcc100pass = true;
    } else if (roll < 0.85) {
      const pct = (90 + rng() * 9.9).toFixed(1);
      aatcc100reduction = `${pct}%`;
      aatcc100pass = true;
    } else {
      const pct = (75 + rng() * 15).toFixed(1);
      aatcc100reduction = `${pct}%`;
      aatcc100pass = parseFloat(pct) >= 80;
    }
  } else if (effectivePpm >= 0.30) {
    const roll = rng();
    if (roll < 0.35) {
      const pct = (90 + rng() * 9.9).toFixed(1);
      aatcc100reduction = `${pct}%`;
      aatcc100pass = true;
    } else {
      const pct = (65 + rng() * 25).toFixed(1);
      aatcc100reduction = `${pct}%`;
      aatcc100pass = parseFloat(pct) >= 80;
    }
  } else {
    const pct = (40 + rng() * 35).toFixed(1);
    aatcc100reduction = `${pct}%`;
    aatcc100pass = parseFloat(pct) >= 80;
  }

  return {
    astm2149: { reduction: astm2149reduction, pass: astm2149pass, organism: "S. aureus (ATCC 6538)" },
    aatcc100: { reduction: aatcc100reduction, pass: aatcc100pass, organism: "S. aureus (ATCC 6538)" },
    tier,
  };
}

// ── Main handler ──────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false;
    const limit = body.limit || 0;

    // Find fabrics that have NO ICP test results
    const fabrics = await prisma.fabric.findMany({
      where: {
        submissions: { none: { testRuns: { some: { testType: "ICP" } } } },
      },
      include: {
        contents: { orderBy: { percent: "desc" } },
        submissions: { select: { id: true }, take: 1 },
      },
      ...(limit > 0 ? { take: limit } : {}),
      orderBy: { fuzeNumber: "asc" },
    });

    // Process each fabric
    const results: any[] = [];
    let profiledCount = 0;
    const stats = {
      tiers: { F1: 0, F2: 0, F3: 0, F4: 0 },
      astm2149pass: 0,
      aatcc100pass: 0,
      total: 0,
    };

    for (const fabric of fabrics) {
      const dominantFiber = fabric.contents[0]?.material || null;
      const isCotton = /cotton/i.test(dominantFiber || "") || /cotton/i.test(fabric.construction || "");
      const category = fabric.fabricCategory || (
        fabric.construction?.toLowerCase().includes("knit") ? "knit" :
        fabric.construction?.toLowerCase().includes("weave") || fabric.construction?.toLowerCase().includes("woven") ? "woven" : null
      );

      const profile = getProfile(dominantFiber, category);

      // Seeded random for reproducibility
      const rng = seededRandom(fabric.id);

      // Pick tier and generate concentration
      const tier = pickTier(profile.tierDistribution, rng);
      const agPpm = generateAgValue(tier, rng);
      const auPpm = Math.round(rng() * 0.05 * 100) / 100; // Trace Au, 0-0.05 ppm

      // Estimate antibacterial results
      const abResults = estimateAntibacterial(agPpm, isCotton, rng);

      // Track stats
      stats.tiers[tier as keyof typeof stats.tiers]++;
      if (abResults.astm2149.pass) stats.astm2149pass++;
      if (abResults.aatcc100.pass) stats.aatcc100pass++;
      stats.total++;

      profiledCount++;
      results.push({
        id: fabric.id,
        fuzeNumber: fabric.fuzeNumber,
        construction: fabric.construction,
        dominantFiber,
        category,
        isCotton,
        assignedTier: tier,
        profileKey: profile.key,
        confidence: profile.confidence,
        icpEstimate: {
          agPpm,
          agRange: profile.agRange,
          auPpm,
          unit: "mg/kg",
        },
        astm2149: abResults.astm2149,
        aatcc100: abResults.aatcc100,
        notes: profile.notes,
      });

      // Create records if not dry run
      if (!dryRun) {
        let submissionId: string;
        const existingSub = await prisma.fabricSubmission.findFirst({
          where: { fabricId: fabric.id },
          select: { id: true },
        });

        if (existingSub) {
          submissionId = existingSub.id;
        } else {
          const newSub = await prisma.fabricSubmission.create({
            data: {
              fabricId: fabric.id,
              fuzeFabricNumber: fabric.fuzeNumber,
              customerFabricCode: fabric.customerCode,
              factoryFabricCode: fabric.factoryCode,
              status: "FI_ESTIMATED",
              testStatus: "ESTIMATED",
              category: "FI_ENRICHMENT",
              raw: { source: "FI_ICP_GENERATOR_V2", generatedAt: new Date().toISOString() },
            },
          });
          submissionId = newSub.id;
        }

        // Create ICP TestRun + IcpResult
        await prisma.testRun.create({
          data: {
            submissionId,
            testType: "ICP",
            testMethodRaw: `[FI] Estimated ICP-OES — FUZE ${tier} allotrope profile`,
            testMethodStd: "ICP-OES",
            testedMetal: "Ag",
            raw: {
              source: "FI_ICP_GENERATOR_V2",
              profileKey: profile.key,
              assignedTier: tier,
              confidence: profile.confidence,
              generatedAt: new Date().toISOString(),
              notes: profile.notes,
              isEstimate: true,
            },
            aiReviewNotes: `[FI] FUZE ${tier} profile. Ag: ${agPpm} mg/kg. Confidence: ${profile.confidence}`,
            icpResult: {
              create: {
                agValue: agPpm,
                auValue: auPpm,
                agRaw: `[FI] ${agPpm} mg/kg (${tier} tier, range ${profile.agRange[0]}-${profile.agRange[1]})`,
                auRaw: `[FI] ${auPpm} mg/kg (trace)`,
                unit: "mg/kg",
              },
            },
          },
        });

        // Create ASTM E2149 TestRun
        await prisma.testRun.create({
          data: {
            submissionId,
            testType: "ANTIBACTERIAL",
            testMethodRaw: `[FI] Estimated ASTM E2149 — ${abResults.astm2149.organism}`,
            testMethodStd: "ASTM E2149",
            raw: {
              source: "FI_ICP_GENERATOR_V2",
              testStandard: "ASTM E2149",
              reduction: abResults.astm2149.reduction,
              organism: abResults.astm2149.organism,
              pass: abResults.astm2149.pass,
              correlatedAgPpm: agPpm,
              tier,
              isEstimate: true,
              generatedAt: new Date().toISOString(),
            },
            aiReviewNotes: `[FI] ASTM E2149: ${abResults.astm2149.reduction} reduction (${abResults.astm2149.pass ? "PASS" : "FAIL"}) — correlated with ${agPpm} mg/kg Ag (${tier})`,
          },
        });

        // Create AATCC 100 TestRun
        await prisma.testRun.create({
          data: {
            submissionId,
            testType: "ANTIBACTERIAL",
            testMethodRaw: `[FI] Estimated AATCC 100 — ${abResults.aatcc100.organism}`,
            testMethodStd: "AATCC 100",
            raw: {
              source: "FI_ICP_GENERATOR_V2",
              testStandard: "AATCC 100",
              reduction: abResults.aatcc100.reduction,
              organism: abResults.aatcc100.organism,
              pass: abResults.aatcc100.pass,
              correlatedAgPpm: agPpm,
              tier,
              isEstimate: true,
              generatedAt: new Date().toISOString(),
            },
            aiReviewNotes: `[FI] AATCC 100: ${abResults.aatcc100.reduction} reduction (${abResults.aatcc100.pass ? "PASS" : "FAIL"}) — correlated with ${agPpm} mg/kg Ag (${tier})`,
          },
        });
      }
    }

    // Summary
    const passRateAstm = stats.total > 0 ? Math.round(stats.astm2149pass / stats.total * 100) : 0;
    const passRateAatcc = stats.total > 0 ? Math.round(stats.aatcc100pass / stats.total * 100) : 0;

    return NextResponse.json({
      ok: true,
      dryRun,
      totalWithoutIcp: fabrics.length,
      profilesGenerated: profiledCount,
      summary: {
        tierDistribution: stats.tiers,
        astm2149PassRate: `${passRateAstm}%`,
        aatcc100PassRate: `${passRateAatcc}%`,
        agRange: "0.10 - 1.00 mg/kg",
        model: "FUZE Allotrope V2",
      },
      results: results.slice(0, 50),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
