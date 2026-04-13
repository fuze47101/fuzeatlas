import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { aiFetch } from "@/lib/ai-fetch";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — processing batches of brands

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * POST /api/admin/brand-validate
 *
 * Validates brands by researching each one with AI and classifying:
 *   - Is this a real company that still exists?
 *   - Do they make textile/apparel products?
 *   - Could FUZE antimicrobial treatment be relevant to them?
 *
 * Body options:
 *   { mode: "batch", batchSize?: number }          → Process next N unvalidated brands
 *   { mode: "specific", brandIds: string[] }       → Validate specific brands
 *   { mode: "revalidate", olderThanDays?: number } → Re-validate stale results
 *   { mode: "stats" }                              → Return validation progress stats
 *   { mode: "cleanup" }                            → Archive/delete based on validation results
 *
 * Also callable from Vercel cron via CRON_SECRET header.
 */
export async function POST(req: Request) {
  // Auth: admin or cron
  const cronSecret = req.headers.get("x-cron-secret");
  const isCron =
    cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

  if (!isCron) {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
    }
  }

  const body = await req.json();
  const mode = body.mode || "batch";

  // ── Stats mode ──
  if (mode === "stats") {
    return NextResponse.json(await getValidationStats());
  }

  // ── Cleanup mode ──
  if (mode === "cleanup") {
    return NextResponse.json(await executeCleanup(body));
  }

  // ── Validation modes ──
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY not configured" },
      { status: 500 }
    );
  }

  let brandsToValidate: { id: string; name: string; website: string | null; backgroundInfo: string | null; customerType: string | null; pipelineStage: string }[];

  if (mode === "specific" && body.brandIds?.length) {
    brandsToValidate = await prisma.brand.findMany({
      where: { id: { in: body.brandIds } },
      select: { id: true, name: true, website: true, backgroundInfo: true, customerType: true, pipelineStage: true },
    });
  } else if (mode === "revalidate") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (body.olderThanDays || 30));
    brandsToValidate = await prisma.brand.findMany({
      where: {
        OR: [
          { validationDate: { lt: cutoff } },
          { validationDate: null, validationStatus: { not: null } },
        ],
      },
      select: { id: true, name: true, website: true, backgroundInfo: true, customerType: true, pipelineStage: true },
      take: body.batchSize || 25,
      orderBy: { validationDate: "asc" },
    });
  } else {
    // Default batch mode — grab unvalidated brands
    const batchSize = Math.min(body.batchSize || 25, 50); // Cap at 50 per request
    brandsToValidate = await prisma.brand.findMany({
      where: { validationStatus: null },
      select: { id: true, name: true, website: true, backgroundInfo: true, customerType: true, pipelineStage: true },
      take: batchSize,
      orderBy: { createdAt: "asc" }, // Oldest first
    });
  }

  if (brandsToValidate.length === 0) {
    const statsResult = await getValidationStats();
    return NextResponse.json({
      ok: true,
      message: "No brands to validate",
      processed: 0,
      stats: statsResult.stats,
    });
  }

  // ── Process in sub-batches of 5 (parallel within batch) ──
  const results: ValidationResult[] = [];
  const SUB_BATCH = 5;

  for (let i = 0; i < brandsToValidate.length; i += SUB_BATCH) {
    const chunk = brandsToValidate.slice(i, i + SUB_BATCH);
    const chunkResults = await Promise.all(
      chunk.map((brand) => validateBrand(brand))
    );
    results.push(...chunkResults);
  }

  // ── Write results to DB ──
  let updated = 0;
  for (const r of results) {
    if (r.error) continue;
    try {
      await prisma.brand.update({
        where: { id: r.brandId },
        data: {
          validationStatus: r.status,
          validationReason: r.reason,
          validationDate: new Date(),
          fuzeRelevance: r.fuzeRelevance,
          textileCategory: r.textileCategory,
          companyStatus: r.companyStatus,
          validationData: r.fullResponse as any,
          // Auto-fill website if we found one and they don't have one
          ...(r.website ? { website: r.website } : {}),
          // Auto-fill backgroundInfo if empty
          ...(r.backgroundInfo ? { backgroundInfo: r.backgroundInfo } : {}),
        },
      });
      updated++;
    } catch (e) {
      console.error(`Failed to update brand ${r.brandId}:`, e);
    }
  }

  const statsResult = await getValidationStats();

  return NextResponse.json({
    ok: true,
    processed: brandsToValidate.length,
    updated,
    errors: results.filter((r) => r.error).length,
    results: results.map((r) => ({
      brandId: r.brandId,
      name: r.name,
      status: r.status,
      fuzeRelevance: r.fuzeRelevance,
      textileCategory: r.textileCategory,
      reason: r.reason,
      error: r.error,
    })),
    stats: statsResult.stats,
  });
}

/**
 * GET /api/admin/brand-validate — Quick stats
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
  }
  return NextResponse.json(await getValidationStats());
}

// ──────────────────────────────────────────────
// AI VALIDATION
// ──────────────────────────────────────────────

interface ValidationResult {
  brandId: string;
  name: string;
  status: string;
  reason: string;
  fuzeRelevance: string;
  textileCategory: string | null;
  companyStatus: string;
  website: string | null;
  backgroundInfo: string | null;
  fullResponse: any;
  error?: string;
}

async function validateBrand(brand: {
  id: string;
  name: string;
  website: string | null;
  backgroundInfo: string | null;
  customerType: string | null;
  pipelineStage: string;
}): Promise<ValidationResult> {
  const fallback: ValidationResult = {
    brandId: brand.id,
    name: brand.name,
    status: "unknown",
    reason: "AI validation failed",
    fuzeRelevance: "unknown",
    textileCategory: null,
    companyStatus: "unknown",
    website: null,
    backgroundInfo: null,
    fullResponse: null,
  };

  try {
    const prompt = buildValidationPrompt(brand);

    const { response } = await aiFetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      },
      { provider: "openai", callerRoute: "brand-validate" }
    );

    if (!response.ok) {
      const errText = await response.text();
      return { ...fallback, error: `OpenAI ${response.status}: ${errText.slice(0, 200)}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { ...fallback, error: "Empty AI response" };
    }

    const parsed = JSON.parse(content);

    return {
      brandId: brand.id,
      name: brand.name,
      status: parsed.validation_status || "unknown",
      reason: parsed.reason || "No reason provided",
      fuzeRelevance: parsed.fuze_relevance || "unknown",
      textileCategory: parsed.textile_category || null,
      companyStatus: parsed.company_status || "unknown",
      website: parsed.website || null,
      backgroundInfo: parsed.description || null,
      fullResponse: parsed,
    };
  } catch (e: any) {
    return { ...fallback, error: e.message };
  }
}

const SYSTEM_PROMPT = `You are a brand validation agent for FUZE Biotech, a company that makes antimicrobial textile treatments.

Your job: Given a brand/company name, determine if they are a REAL company that makes textile products where antimicrobial treatment adds value.

FUZE works with companies that make:
- Athletic/performance apparel (moisture-wicking, odor control)
- Outdoor/adventure clothing (anti-odor, durability)
- Hospitality textiles (hotel sheets, towels, restaurant uniforms)
- Medical/healthcare textiles (scrubs, bedding, curtains, wound care)
- Military/tactical gear (uniforms, socks, base layers)
- Workwear/industrial uniforms (anti-odor, hygiene)
- Home textiles & bedding (sheets, pillows, mattress covers)
- Intimate apparel & socks (odor control)
- Denim & casualwear (odor resistance)
- Childrenswear (hygiene)
- Luxury fashion (performance fabrics)
- Textile mills / fabric manufacturers that supply these brands

FUZE does NOT work with:
- Pure footwear companies (shoes only, no textile products)
- Wedding dress / bridal only
- Jewelry / accessories only
- Pure leather goods (no fabric)
- Chemical companies / raw material suppliers
- Retail stores that don't make their own products
- Completely unrelated industries (tech, food, construction, etc.)
- Companies that no longer exist

IMPORTANT: Many brands cross categories. A "shoe company" that also makes socks, apparel, or athletic wear IS relevant. Nike makes shoes AND apparel — that's relevant. A company that makes ONLY shoes with no textile products is NOT relevant.

Respond ONLY with valid JSON matching this schema:
{
  "company_name": "string — corrected/official company name",
  "company_status": "active | closed | acquired | unknown",
  "is_real_company": true/false,
  "description": "string — 1-2 sentence description of what the company does",
  "website": "string or null — company website URL if known",
  "makes_textiles": true/false,
  "textile_products": ["array of textile product types they make"],
  "textile_category": "string — primary category: apparel, home_textiles, workwear, medical, military, hospitality, intimate, denim, childrenswear, luxury, textile_mill, multi_category, or none",
  "fuze_relevance": "high | medium | low | none",
  "fuze_relevance_reason": "string — why FUZE would or wouldn't be relevant",
  "validation_status": "verified | irrelevant | dead | unknown",
  "reason": "string — clear explanation of the classification",
  "confidence": "high | medium | low"
}

Classification rules:
- "verified" = Real textile company, still active, FUZE could be relevant
- "irrelevant" = Real company but doesn't make textiles, or textiles where antimicrobial adds no value
- "dead" = Company is closed, acquired and dissolved, or doesn't seem to exist
- "unknown" = Can't determine with confidence — needs manual review`;

function buildValidationPrompt(brand: {
  name: string;
  website: string | null;
  backgroundInfo: string | null;
  customerType: string | null;
}): string {
  let prompt = `Validate this brand for FUZE antimicrobial textile treatment relevance:\n\nBrand name: "${brand.name}"`;

  if (brand.website) {
    prompt += `\nKnown website: ${brand.website}`;
  }
  if (brand.backgroundInfo) {
    prompt += `\nExisting info: ${brand.backgroundInfo.slice(0, 500)}`;
  }
  if (brand.customerType) {
    prompt += `\nCategory: ${brand.customerType}`;
  }

  prompt += `\n\nUse your training knowledge to determine what this company does and whether they make textile products where antimicrobial treatment would add value. Respond with JSON only.`;

  return prompt;
}

// ──────────────────────────────────────────────
// STATS
// ──────────────────────────────────────────────

async function getValidationStats() {
  const total = await prisma.brand.count();
  const validated = await prisma.brand.count({ where: { validationStatus: { not: null } } });
  const unvalidated = total - validated;

  const byStatus = await prisma.brand.groupBy({
    by: ["validationStatus"],
    _count: true,
  });

  const byRelevance = await prisma.brand.groupBy({
    by: ["fuzeRelevance"],
    _count: true,
    where: { fuzeRelevance: { not: null } },
  });

  const byCategory = await prisma.brand.groupBy({
    by: ["textileCategory"],
    _count: true,
    where: { textileCategory: { not: null } },
  });

  return {
    ok: true,
    stats: {
      total,
      validated,
      unvalidated,
      percentComplete: Math.round((validated / total) * 100),
      byStatus: Object.fromEntries(byStatus.map((s) => [s.validationStatus || "null", s._count])),
      byRelevance: Object.fromEntries(byRelevance.map((r) => [r.fuzeRelevance || "null", r._count])),
      byCategory: Object.fromEntries(byCategory.map((c) => [c.textileCategory || "null", c._count])),
    },
  };
}

// ──────────────────────────────────────────────
// CLEANUP
// ──────────────────────────────────────────────

async function executeCleanup(body: any) {
  const action = body.action as "archive_irrelevant" | "delete_dead" | "preview";

  if (action === "preview" || !action) {
    const irrelevant = await prisma.brand.findMany({
      where: { validationStatus: "irrelevant" },
      select: { id: true, name: true, validationReason: true, fuzeRelevance: true },
    });
    const dead = await prisma.brand.findMany({
      where: { validationStatus: "dead" },
      select: { id: true, name: true, validationReason: true },
    });
    return {
      ok: true,
      preview: true,
      irrelevant: { count: irrelevant.length, brands: irrelevant },
      dead: { count: dead.length, brands: dead },
      message: `Found ${irrelevant.length} irrelevant + ${dead.length} dead brands. Use action: "archive_irrelevant" or "delete_dead" to clean up.`,
    };
  }

  if (action === "archive_irrelevant") {
    const result = await prisma.brand.updateMany({
      where: {
        validationStatus: "irrelevant",
        pipelineStage: "LEAD", // Only archive LEADs — don't touch active customers
      },
      data: { pipelineStage: "ARCHIVE" },
    });
    return { ok: true, archived: result.count, message: `Archived ${result.count} irrelevant brands` };
  }

  if (action === "delete_dead") {
    // Safety: only delete brands with zero activity
    const deadBrands = await prisma.brand.findMany({
      where: { validationStatus: "dead", pipelineStage: "LEAD" },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            submissions: true,
            fabrics: true,
            testRequests: true,
            sows: true,
            invoices: true,
            fuzeOrders: true,
          },
        },
      },
    });

    const safeToDelete = deadBrands.filter(
      (b) =>
        b._count.submissions === 0 &&
        b._count.fabrics === 0 &&
        b._count.testRequests === 0 &&
        b._count.sows === 0 &&
        b._count.invoices === 0 &&
        b._count.fuzeOrders === 0
    );

    const ids = safeToDelete.map((b) => b.id);

    if (ids.length > 0) {
      // Clean up related records first
      await prisma.contact.deleteMany({ where: { brandId: { in: ids } } });
      await prisma.note.deleteMany({ where: { brandId: { in: ids } } });
      await prisma.sourceRecord.deleteMany({ where: { brandId: { in: ids } } });
      await prisma.brand.deleteMany({ where: { id: { in: ids } } });
    }

    return {
      ok: true,
      deleted: ids.length,
      blocked: deadBrands.length - ids.length,
      message: `Deleted ${ids.length} dead brands. ${deadBrands.length - ids.length} had activity and were skipped.`,
    };
  }

  return { ok: false, error: "Invalid action. Use: preview, archive_irrelevant, delete_dead" };
}
