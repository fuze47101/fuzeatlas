// @ts-nocheck
/**
 * GET /api/cron/seed-playbooks — Phase 9H bootstrap.
 *
 * Seeds the three Phase 9H starter playbooks:
 *   - Activewear (Lululemon / Texas-AG angle)
 *   - Hospitality (NY Hospitality Market)
 *   - Outdoor / Hunting (KUIU / Patagonia angle)
 *
 * Idempotent — uses upsert keyed on name. Re-running is a no-op.
 * Bearer-authed via CRON_SECRET so a manager doesn't accidentally
 * trigger it from a browser.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PLAYBOOKS = [
  {
    name: "Activewear — Lululemon / Texas-AG angle",
    textileCategory: "activewear",
    description: `# Activewear playbook

The Texas Attorney General's PFAS investigation into Lululemon (April 2026) plus California SB-707 are the strongest regulatory tailwind FUZE has ever had in performance apparel. Lead with:

## Opening hook (cold)
"Texas AG is currently investigating Lululemon for PFAS in activewear. Every brand in performance apparel is one news cycle away from being the next one named. FUZE F1 is the only EPA-registered, OEKO-TEX Class I, PFAS-free antimicrobial textile treatment your engineering team can certify against today — without changing dye, hand, or breathability."

## The pitch
- F1 Full Spectrum (1.0 mg/kg) — 100-wash third-party validated
- ASTM E2149 + AATCC 100 (we test on the right test for non-leaching)
- Bluesign approved, OEKO-TEX Standard 100 Class I, California EPA approved Q1 2026

## What to ask for
A single 19L carboy ($X delivered) to validate on their current high-volume fabric construction. Their finishing partner runs it through exhaust or pad-dry-cure (they already know how to do this). Two-week test cycle.

## Common objections
- Competitor chemistry objection: "We already use silver-ion." → "Silver-ion leaches. The Texas AG case is about leaching chemistry into wash water. FUZE is non-leaching by design — it's the exact countermeasure."
- Competitor evidence objection: "Wash count claims need third-party validation." → "Yes — that's why we publish AATCC 100 and ISO 20743 reports from independent labs. Polygiene and Silvadur don't share their reports publicly. We do, on request."`,
    notes:
      "Pair with sequence 'default' (6-step long funnel). Send the Texas AG news article as the first email attachment.",
  },
  {
    name: "Hospitality — NY Hospitality Market",
    textileCategory: "hospitality",
    description: `# Hospitality playbook

NY Hospitality Market is FUZE's most-active vertical. Hotel linens, bedding, F&B uniforms, hotel guest robes. Brand decisions made at corporate; hotel-level GMs influence but don't sign.

## Opening hook (warm intro via Barth)
"FUZE F3 is the antimicrobial treatment several SF/NYC luxury hotel groups are evaluating right now. 50 washes guaranteed, zero PFAS, no chemistry change. The interesting part for a property owner: it eliminates odor complaints on guest bathrobes and sheets without any change to laundry SOP."

## The pitch
- F3 Core Performance (0.5 mg/kg) — 50-wash third-party validated
- ASTM E2149 primary test (right for non-leaching contact-kill)
- Standard linen-house finishing equipment (exhaust / pad-dry-cure)
- QR-coded hangtag for guest-facing brand story

## Calculator hook
"Run your annual linen budget through fuzefaq.com — most hotel groups see net cost reduction within 18 months because they replace linen 30% less often."

## What to ask for
Intro to their head of housekeeping operations + the linen supplier (often a contracted laundry house — Cintas, ALSCO, regional player). FUZE talks to both.

## Common objections
- "Linen replacement cycle is already fine." → "FUZE isn't replacement-cycle reduction, it's odor-and-stain-cycle reduction. Tracking unit: 'guest complaint per 1000 room-nights' drops 40-60% in our pilot data."`,
    notes: "QR hangtag = strong proof point. Pair with fuzefaq.com calculator link.",
  },
  {
    name: "Outdoor / Hunting — KUIU / Patagonia angle",
    textileCategory: "activewear",
    description: `# Outdoor / Hunting playbook

KUIU is the canonical anchor brand for this vertical — Joseph Zack's call to Andrew (May 7) is the template for every conversation. The buyer here cares about:
1. Antimicrobial performance over multi-day wear (sweat + bacteria on hunt + multi-day backpacking)
2. Odor masking for hunting use cases (game-scent suppression)
3. Brand authenticity (no greenwashing claims)

## Opening hook (cold via LinkedIn)
"FUZE is the antimicrobial textile treatment now used by KUIU on their performance hunting line. It eliminates bacterial odor on multi-day-wear merino + synthetic blends without leaching chemistry into wash water. F1 = 100 washes third-party validated, PFAS-free."

## The pitch
- F1 Full Spectrum (1.0 mg/kg) on merino, F2 on poly blends
- ASTM E2149 + AATCC 100 (we test on both — at F1 density we pass both)
- ISO 18184 antiviral data available on request
- Zero PFAS, OEKO-TEX Class I, bluesign approved

## Brand visibility
- Brand portal supply chain dashboard (see /brand-portal/supply-chain on real KUIU account)
- ICP cadence stipulation enforced through Atlas
- Cross-factory pricing tier discount kicks in around 6,000L lifetime consumption

## What to ask for
Two fabric submissions — one merino, one poly blend. We treat both at F1 + F2 and send back the matrix. Customer sees side-by-side what tier they actually need.

## Common objections
- "We already work with Polygiene." → "FUZE is non-leaching by design. Polygiene's data is on the leaching test. If a Texas AG-type story breaks for outdoor, your supply chain is already on the right side."
- "Our PD timeline is 18 months." → "FUZE drops into existing finishing — no PD cycle change needed. Your finishing partner runs it through their current pad-dry-cure line."`,
    notes:
      "Joseph Zack at KUIU is the live anchor reference. Reference our delivered KUIU promise (supply-chain dashboard + ICP cadence + pricing tier ladder).",
  },
];

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const results: any[] = [];
  for (const p of PLAYBOOKS) {
    try {
      const row = await prisma.bDPlaybook.upsert({
        where: { name: p.name },
        update: {
          textileCategory: p.textileCategory,
          description: p.description,
          notes: p.notes,
        },
        create: {
          name: p.name,
          textileCategory: p.textileCategory,
          description: p.description,
          notes: p.notes,
        },
      });
      results.push({ ok: true, name: row.name, id: row.id });
    } catch (e: any) {
      results.push({ ok: false, name: p.name, error: e?.message || String(e) });
    }
  }
  return NextResponse.json({ ok: true, results });
}
