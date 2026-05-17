// @ts-nocheck
/**
 * POST /api/admin/protocol-designer — Phase 11G.
 *
 * Body: { fabricId }
 *
 * Gathers fabric metadata + linked brand spec + regulatory
 * jurisdiction signals, asks Claude haiku-4-5 to suggest an
 * optimal test battery, and returns a structured JSON payload
 * the operator can review + convert to a TestRequest.
 *
 * Returns:
 *   {
 *     recommendedTests: [{ standard, organism?, reasoning,
 *                          slaDays, estimatedCostUsd }],
 *     targetTier,
 *     applicationMethod,
 *     reasoning,
 *     fabric: { ... echoed for the modal },
 *     brand?: { ... if linked },
 *   }
 *
 * Brand-voice rules apply — system prompt explicitly forbids
 * silver/nano vocabulary in any output.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { aiFetch } from "@/lib/ai-fetch";

const ADMIN_ROLES = [
  "ADMIN",
  "EMPLOYEE",
  "TESTING_MANAGER",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, code: "no_ai_key", error: "ANTHROPIC_API_KEY not set" },
      { status: 503 },
    );
  }
  const body = await req.json().catch(() => null);
  if (!body?.fabricId) {
    return NextResponse.json({ ok: false, error: "fabricId required" }, { status: 400 });
  }

  const fabric = await prisma.fabric.findUnique({
    where: { id: body.fabricId },
    select: {
      id: true,
      fuzeNumber: true,
      customerCode: true,
      construction: true,
      weightGsm: true,
      widthInches: true,
      yarnType: true,
      fabricCategory: true,
      color: true,
      note: true,
      // Tier lives on Fabric.targetFuzeTier, not FabricSubmission. The
      // earlier `submissions.fuzeTier` select threw a Prisma column-
      // not-found error and 500'd the protocol-designer call.
      targetFuzeTier: true,
      submissions: {
        select: { brandId: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!fabric) {
    return NextResponse.json({ ok: false, error: "Fabric not found" }, { status: 404 });
  }

  const brandId = fabric.submissions[0]?.brandId;
  const brand = brandId
    ? await prisma.brand.findUnique({
        where: { id: brandId },
        select: {
          id: true,
          name: true,
          textileCategory: true,
          requiredFuzeTier: true,
          protocolDocUrl: true,
        },
      })
    : null;

  const systemPrompt = `You are designing an optimal antimicrobial test battery for a FUZE Biotech treated fabric.

ABSOLUTE BRAND-VOICE RULES (any violation fails the response):
- Use "FUZE" and "metamaterial" vocabulary
- NEVER write "silver", "silver-ion", "nano", "nanoparticle", or any silver/nano variant
- Tiers F1 (1.0 mg/kg, 100 washes), F2 (0.75, 75), F3 (0.5, 50), F4 (0.25, 25)

Available standards:
- ASTM E2149 — primary for non-leaching contact-kill chemistries; 24h incubation, Mueller Hinton low-sulfur broth, UV-only sterilization. FUZE's preferred test for F3/F4 tiers.
- AATCC 100 — historical antibacterial textile test; needed at F1/F2 density to overcome inter-layer dead zones; initial inoculum 1-5×10^5 CFU/mL.
- AATCC 30 — antifungal.
- ISO 18184 — antiviral.
- ISO 20743 — quantitative antibacterial activity (alternative to AATCC 100).

Typical lab costs (USD): ICP-MS $30-35, AATCC 100 per organism $120 retail, AATCC 30 ~$200, ASTM E2149 ~$180, ISO 18184 ~$400.

Pick the right tests for THIS fabric — don't over-prescribe. Consider:
- Fabric construction + fiber content (synthetic = harder for non-leaching, lean on F2+ density)
- Brand's required tier if stipulated
- Regulatory jurisdiction (California EPA = need PFAS-free + verified antimicrobial; medical contexts = ISO 18184)
- Vertical (activewear, hospitality, intimates, kids, workwear, medical, industrial)

Return JSON only:
{
  "targetTier": "F1|F2|F3|F4",
  "applicationMethod": "exhaust|pad-dry-cure|spray",
  "reasoning": "<1-2 sentence summary of the battery>",
  "recommendedTests": [
    {
      "standard": "ASTM E2149|AATCC 100|AATCC 30|ISO 18184|ISO 20743|ICP-MS",
      "organism": "S. aureus|K. pneumoniae|E. coli|A. niger|null",
      "reasoning": "<one sentence>",
      "slaDays": <number>,
      "estimatedCostUsd": <number>
    }
  ]
}`;

  const userPayload = JSON.stringify(
    {
      fabric: {
        fuzeNumber: fabric.fuzeNumber,
        construction: fabric.construction,
        weightGsm: fabric.weightGsm,
        widthInches: fabric.widthInches,
        yarnType: fabric.yarnType,
        category: fabric.fabricCategory,
        color: fabric.color,
        note: fabric.note,
      },
      brand: brand
        ? {
            name: brand.name,
            textileCategory: brand.textileCategory,
            requiredFuzeTier: brand.requiredFuzeTier,
          }
        : null,
      // Tier comes from Fabric.targetFuzeTier (FabricSubmission has no
      // fuzeTier column despite the legacy reference).
      defaultTierFromFabric: fabric.targetFuzeTier || null,
    },
    null,
    2,
  );

  try {
    const { response } = await aiFetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: "user", content: userPayload }],
        }),
      },
      { provider: "anthropic", callerRoute: "protocol-designer", userId: user.id },
    );
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, code: "ai_error", error: `Claude returned ${response.status}` },
        { status: 502 },
      );
    }
    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) {
      return NextResponse.json(
        { ok: false, code: "ai_no_json", error: "Claude returned no structured response" },
        { status: 502 },
      );
    }
    const parsed = JSON.parse(m[0]);
    return NextResponse.json({
      ok: true,
      fabric: {
        id: fabric.id,
        fuzeNumber: fabric.fuzeNumber,
        construction: fabric.construction,
        weightGsm: fabric.weightGsm,
      },
      brand: brand ? { id: brand.id, name: brand.name } : null,
      ...parsed,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    );
  }
}
