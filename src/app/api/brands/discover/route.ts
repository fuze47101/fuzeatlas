// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiFetch, getUserIdFromHeaders } from "@/lib/ai-fetch";
import {
  extractDomain,
  searchApolloByDomain,
  apolloPersonToContactData,
} from "@/lib/apollo-people-search";

/**
 * POST /api/brands/discover
 *
 * Automated worldwide textile brand discovery engine.
 * Uses multiple AI models to discover brands by category/region,
 * validates across models, and auto-creates Brand records.
 *
 * Body: {
 *   category: string,       // e.g. "activewear", "hospitality", "medical textiles"
 *   region?: string,         // e.g. "North America", "Europe", "Asia Pacific"
 *   count?: number,          // target number of brands to find (default 20)
 *   excludeExisting?: bool,  // skip brands already in DB (default true)
 * }
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROK_API_KEY = process.env.GROK_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const DISCOVERY_PROMPT = `You are FUZE Atlas Brand Discovery — an elite market intelligence agent for FUZE Biotech, which sells antimicrobial textile treatment technology to brands and manufacturers worldwide.

YOUR MISSION: Discover real textile/apparel brands that are potential customers for FUZE antimicrobial treatment. These brands either manufacture or source textiles that would benefit from antimicrobial protection: activewear, athleisure, outdoor, workwear, military, medical textiles, hospitality (hotel linens/towels), home textiles, intimate apparel, socks/hosiery, denim, performance fabrics, artificial turf, etc.

For EACH brand you discover, provide:
- Company name (EXACT legal or commonly-known name)
- Website URL (MUST be real and verifiable)
- Headquarters city, country
- Industry segment (activewear, outdoor, workwear, medical, hospitality, home, etc.)
- Estimated employee count range
- Estimated annual revenue (if known)
- WHY they are a good FUZE prospect (1-2 sentences)
- Current antimicrobial usage if known (Polygiene, HeiQ, Microban, Sanitized, etc.)
- Key product categories that would benefit from FUZE treatment

CRITICAL RULES:
1. ONLY list REAL companies that actually exist — no made-up brands
2. Include the company website — if you can't provide a real URL, skip that brand
3. Focus on brands that actually use or would use textile treatments, not just any apparel brand
4. Mix of sizes: include enterprise (Nike, Adidas), mid-market ($50M-$1B), and emerging brands ($5M-$50M)
5. Prioritize brands with known sustainability commitments (they align with FUZE's zero-binder, zero-curing advantage)
6. Include global brands AND regional leaders

Return valid JSON array:
[
  {
    "name": "string",
    "website": "string",
    "headquarters": "string (City, Country)",
    "segment": "string",
    "employeeCount": "string (range)",
    "revenue": "string or null",
    "fuzeRelevance": "string (why they're a good prospect)",
    "currentAntimicrobial": "string or null",
    "productCategories": ["string"],
    "sustainabilityScore": "HIGH|MEDIUM|LOW|UNKNOWN",
    "priorityTier": "A|B|C"
  }
]

Return ONLY the JSON array — no markdown, no explanation.`;

// ─── AI DISCOVERY CALLS ────────────────────────────────

async function discoverWithOpenAI(prompt: string, userId?: string): Promise<any[]> {
  if (!OPENAI_API_KEY) return [];
  const { response } = await aiFetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 8000,
        messages: [
          { role: "system", content: DISCOVERY_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
    },
    { provider: "openai", callerRoute: "brand-discover", userId }
  );
  if (!response.ok) return [];
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  return parseJsonArray(text, "OpenAI");
}

async function discoverWithGrok(prompt: string, userId?: string): Promise<any[]> {
  if (!GROK_API_KEY) return [];
  const { response } = await aiFetch(
    "https://api.x.ai/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROK_API_KEY}` },
      body: JSON.stringify({
        model: "grok-3-latest",
        max_tokens: 8000,
        messages: [
          { role: "system", content: DISCOVERY_PROMPT + "\n\nLeverage your real-time X/Twitter data to find brands actively posting about sustainability, antimicrobial, odor-control, or performance textiles." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
    },
    { provider: "openai" as any, callerRoute: "brand-discover-grok", userId }
  );
  if (!response.ok) return [];
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  return parseJsonArray(text, "Grok");
}

async function discoverWithAnthropic(prompt: string, userId?: string): Promise<any[]> {
  if (!ANTHROPIC_API_KEY) return [];
  const { response } = await aiFetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: DISCOVERY_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    { provider: "anthropic", callerRoute: "brand-discover", userId }
  );
  if (!response.ok) return [];
  const result = await response.json();
  const text = result.content?.[0]?.text || "";
  return parseJsonArray(text, "Anthropic");
}

function parseJsonArray(text: string, source: string): any[] {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error(`No JSON array in ${source}`);
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed.map(b => ({ ...b, _source: source })) : [];
  } catch {
    console.error(`Failed to parse ${source} discovery:`, text.substring(0, 300));
    return [];
  }
}

// ─── DEDUPLICATION & VALIDATION ────────────────────────

function deduplicateAndValidate(allBrands: any[]): any[] {
  const seen = new Map<string, any>();

  for (const brand of allBrands) {
    if (!brand.name || !brand.website) continue;

    const key = brand.name.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const existing = seen.get(key);

    if (!existing) {
      // Track how many AI sources found this brand
      seen.set(key, { ...brand, _validationCount: 1, _sources: [brand._source] });
    } else {
      // Brand found by multiple AIs — increase confidence
      existing._validationCount++;
      if (!existing._sources.includes(brand._source)) {
        existing._sources.push(brand._source);
      }
      // Fill in any missing fields from the new source
      if (!existing.revenue && brand.revenue) existing.revenue = brand.revenue;
      if (!existing.currentAntimicrobial && brand.currentAntimicrobial) existing.currentAntimicrobial = brand.currentAntimicrobial;
      if (brand.productCategories?.length > (existing.productCategories?.length || 0)) {
        existing.productCategories = brand.productCategories;
      }
    }
  }

  // Sort: brands found by multiple AIs first, then by priority tier
  const tierOrder: Record<string, number> = { A: 1, B: 2, C: 3 };
  return Array.from(seen.values())
    .sort((a, b) => {
      if (b._validationCount !== a._validationCount) return b._validationCount - a._validationCount;
      return (tierOrder[a.priorityTier] || 3) - (tierOrder[b.priorityTier] || 3);
    });
}

// ─── MAIN HANDLER ──────────────────────────────────────

export async function POST(req: Request) {
  try {
    // Allow cron jobs via secret header
    const cronSecret = req.headers.get("x-cron-secret");
    const isCron = cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

    if (!isCron) {
      const user = await import("@/lib/auth").then(m => m.getCurrentUser());
      if (!user || (user.role !== "ADMIN" && user.role !== "EMPLOYEE")) {
        return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
      }
    }

    const body = await req.json();
    const { category, region, count = 20, excludeExisting = true } = body;

    if (!category) {
      return NextResponse.json({ ok: false, error: "Category is required" }, { status: 400 });
    }

    const userId = getUserIdFromHeaders(req.headers);

    // Build discovery prompt
    let prompt = `Find ${count} textile/apparel brands in the "${category}" segment that would be potential customers for FUZE antimicrobial textile treatment.`;
    if (region) prompt += ` Focus on the ${region} region.`;
    prompt += `\n\nInclude a mix of enterprise, mid-market, and emerging brands. Prioritize brands with sustainability commitments or known antimicrobial usage.`;

    // Get existing brand names to exclude
    let existingNames: Set<string> = new Set();
    if (excludeExisting) {
      const existing = await prisma.brand.findMany({ select: { name: true } });
      existingNames = new Set(existing.map(b => b.name.toLowerCase().trim()));
      if (existingNames.size > 0) {
        prompt += `\n\nEXCLUDE these brands (already in our database): ${Array.from(existingNames).slice(0, 100).join(", ")}`;
      }
    }

    // Fire all AIs in parallel
    const [openaiResults, grokResults, anthropicResults] = await Promise.all([
      discoverWithOpenAI(prompt, userId),
      discoverWithGrok(prompt, userId),
      discoverWithAnthropic(prompt, userId),
    ]);

    // Merge and deduplicate
    const allBrands = [...openaiResults, ...grokResults, ...anthropicResults];
    let validated = deduplicateAndValidate(allBrands);

    // Filter out existing brands
    if (excludeExisting && existingNames.size > 0) {
      validated = validated.filter(b => !existingNames.has(b.name.toLowerCase().trim()));
    }

    // Auto-create Brand records
    let created = 0;
    let skipped = 0;
    const createdBrands: any[] = [];

    for (const brand of validated) {
      // Double-check not already in DB
      const exists = await prisma.brand.findFirst({
        where: { name: { equals: brand.name, mode: "insensitive" } },
      });

      if (exists) {
        skipped++;
        continue;
      }

      try {
        const newBrand = await prisma.brand.create({
          data: {
            name: brand.name,
            website: brand.website || null,
            customerType: brand.segment || category,
            backgroundInfo: brand.fuzeRelevance || null,
            pipelineStage: "LEAD",
            researchData: {
              discoveredBy: brand._sources,
              validationCount: brand._validationCount,
              category,
              region: region || "Global",
              headquarters: brand.headquarters,
              employeeCount: brand.employeeCount,
              revenue: brand.revenue,
              currentAntimicrobial: brand.currentAntimicrobial,
              productCategories: brand.productCategories,
              sustainabilityScore: brand.sustainabilityScore,
              priorityTier: brand.priorityTier,
              discoveredAt: new Date().toISOString(),
            },
            researchDate: new Date(),
          },
        });

        // ─── AUTO-ENRICH — Apollo people-search by domain ───────────
        // Without this, discovery creates empty Brand rows that the
        // BD Wizard skips (its filter is `contacts: { some: {} }`).
        // That's how Ryan ended up "out of contacts" with 1083 LEAD
        // brands and zero attached people. Now we hit Apollo as soon
        // as the brand is created and write up to 8 senior contacts
        // (founder / c_suite / vp / head / director) ranked toward
        // FUZE buyer-persona keywords.
        //
        // Fire-and-forget on the contact write — if Apollo is rate-
        // limited, the API key is missing, or the domain is junk, the
        // brand still lands in the pipeline; the next run of
        // bulk-enrich-empty-brands.ts will pick it up. Discovery must
        // never be blocked on enrichment.
        let enrichedContactCount = 0;
        try {
          const domain = extractDomain(brand.website);
          if (domain) {
            const people = await searchApolloByDomain(domain);
            for (const p of people) {
              try {
                await prisma.contact.create({
                  data: {
                    brandId: newBrand.id,
                    ...apolloPersonToContactData(p, "apollo_discover"),
                  },
                });
                enrichedContactCount++;
              } catch (contactErr: any) {
                // Duplicate apolloId / unique constraint / etc — skip.
                console.warn(
                  `  Contact create failed for ${brand.name}: ${contactErr.message}`,
                );
              }
            }
          }
        } catch (enrichErr: any) {
          // Apollo failure shouldn't block the whole batch.
          console.warn(
            `  Auto-enrich failed for ${brand.name}: ${enrichErr.message}`,
          );
        }

        createdBrands.push({
          id: newBrand.id,
          name: newBrand.name,
          website: brand.website,
          segment: brand.segment,
          priorityTier: brand.priorityTier,
          validationCount: brand._validationCount,
          sources: brand._sources,
          enrichedContactCount,
        });
        created++;
      } catch (createErr: any) {
        console.error(`Failed to create brand "${brand.name}":`, createErr.message);
        skipped++;
      }
    }

    return NextResponse.json({
      ok: true,
      summary: {
        category,
        region: region || "Global",
        aiSourcesUsed: [
          OPENAI_API_KEY ? "OpenAI" : null,
          GROK_API_KEY ? "Grok" : null,
          ANTHROPIC_API_KEY ? "Anthropic" : null,
        ].filter(Boolean),
        totalDiscovered: allBrands.length,
        afterDedup: validated.length,
        created,
        skipped,
      },
      brands: createdBrands,
    });
  } catch (e: any) {
    console.error("Brand discovery error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/**
 * GET /api/brands/discover
 * Returns available discovery categories and stats
 */
export async function GET() {
  const totalBrands = await prisma.brand.count();
  const byStage = await prisma.brand.groupBy({
    by: ["pipelineStage"],
    _count: true,
  });
  const recent = await prisma.brand.findMany({
    where: { researchDate: { not: null } },
    orderBy: { researchDate: "desc" },
    take: 10,
    select: { id: true, name: true, customerType: true, pipelineStage: true, researchDate: true },
  });

  return NextResponse.json({
    ok: true,
    stats: { total: totalBrands, byStage },
    recentResearch: recent,
    categories: [
      "Activewear & Athleisure",
      "Outdoor & Performance",
      "Workwear & Uniforms",
      "Military & Defense",
      "Medical Textiles",
      "Hospitality (Hotels/Restaurants)",
      "Home Textiles & Bedding",
      "Intimate Apparel & Socks",
      "Denim & Casualwear",
      "Luxury & Fashion",
      "Childrenswear",
      "Artificial Turf",
      "Automotive Textiles",
      "Industrial & Technical Textiles",
    ],
    regions: [
      "North America",
      "Europe",
      "Asia Pacific",
      "Latin America",
      "Middle East & Africa",
      "Global",
    ],
  });
}
