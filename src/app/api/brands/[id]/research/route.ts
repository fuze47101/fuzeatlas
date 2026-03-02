// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ─── THE PROMPT ─────────────────────────────────────────
// This is the core research prompt shared by both AI models.
// It's specifically tuned for FUZE Technologies' B2B sales motion.

const RESEARCH_PROMPT = `You are FUZE Atlas Intelligence — an elite B2B sales research agent for FUZE Technologies, a company that sells antimicrobial textile treatment technology (silver-based, applied at the mill/factory level) to brands and manufacturers worldwide.

FUZE sells to apparel brands, textile mills, outdoor/athletic companies, workwear manufacturers, military/defense textile suppliers, medical textile producers, home textile companies, and artificial turf manufacturers. The treatment is applied during the textile finishing process at the factory level. It provides permanent antimicrobial protection (kills bacteria, prevents odor, resists fungal growth) that survives 50+ industrial washes.

Your mission: Given a brand/company name, produce a comprehensive, actionable intelligence brief that a FUZE sales team member can use to IMMEDIATELY begin outreach and close a deal. Do NOT hold back — this is a sales weapon, not an academic report.

## YOUR RESEARCH TARGETS

### 1. COMPANY OVERVIEW
- Full legal company name and any DBA/trade names
- Headquarters location (city, state/province, country)
- Company website URL (verify it's real)
- LinkedIn company page URL
- Year founded
- Company size (employee count range)
- Annual revenue estimate (if publicly available or inferrable)
- Stock ticker (if public)
- Brief description of what they do (2-3 sentences max, focused on textile/product relevance)
- Parent company or key subsidiaries
- Key geographic markets they operate in

### 2. KEY DECISION MAKERS (find 3-6 people minimum)
For EACH person, provide:
- Full name
- Exact title/position
- LinkedIn profile URL (construct as https://linkedin.com/in/[likely-slug] based on name patterns)
- Email (construct the most likely format: first.last@domain.com, flast@domain.com, first@domain.com — note which format the company typically uses)
- Phone (if publicly available)
- WHY they matter to FUZE — be specific (e.g. "Owns fabric sourcing budget for performance apparel division", "Launched sustainability initiative in 2024 that aligns with antimicrobial tech positioning")

PRIORITY TARGETS (in order — find at LEAST the top 3):
1. VP/Director of Product Development, Innovation, or R&D
2. VP/Director of Materials, Textiles, or Sourcing
3. VP/Director of Sustainability, ESG, or Corporate Responsibility
4. Chief Product Officer / CTO / Chief Innovation Officer
5. VP/Director of Supply Chain or Procurement
6. C-Suite (CEO, COO, CFO) — especially at companies under 500 employees
7. Buying/Merchandising/Category leads
8. Quality Assurance / Compliance / Testing leads
9. Marketing leads (if antimicrobial is a consumer-facing selling point)

### 3. PRODUCT & MARKET INTELLIGENCE
- What products do they make/sell? List specific categories (performance tees, yoga pants, military uniforms, hospital gowns, turf systems, etc.)
- Key product lines or sub-brands they own
- Target market segments (athletic, outdoor, luxury, workwear, military, medical, home textiles, etc.)
- Known fabric suppliers, mills, or manufacturing partners
- Any sustainability commitments, certifications, or pledges (bluesign, OEKO-TEX, SBTi, ZDHC, etc.)
- Recent product launches or innovations (last 18 months)
- Known materials strategy (organic cotton, recycled polyester, natural fibers, synthetics focus, etc.)

### 4. FUZE OPPORTUNITY ANALYSIS — BE RUTHLESSLY SPECIFIC
- Why would this brand want antimicrobial treatment? Map to THEIR specific products and positioning
- Which of their product lines are the BEST fit for FUZE silver-based antimicrobial technology? Name exact product lines
- Estimated deal scale: Small (<$25K/yr), Medium ($25K-$100K/yr), Large ($100K-$500K/yr), Enterprise ($500K+/yr)
- Are they ALREADY using antimicrobial tech? From whom? (Polygiene, HeiQ, Microban, Sanitized, Agion, VariPure, SILVADUR, etc.)
- If they use a competitor, what's FUZE's angle to displace them?
- Top 3 objections they will raise and exactly how to counter each one
- The SINGLE BEST opening angle for first outreach — be creative and specific
- A draft cold email opening paragraph (2-3 sentences) that references something specific about their business and creates curiosity about FUZE

### 5. RECENT NEWS & SALES TRIGGERS
- Recent news, press releases, or announcements (last 12 months)
- Leadership changes (new hires are warm leads)
- Expansion plans, new factory openings, new market entries
- Sustainability announcements or commitments
- Partnership or acquisition announcements
- Earnings highlights, growth trajectory
- Any mention of antimicrobial, odor control, hygiene, freshness, or performance finish in their marketing
- Product recalls or quality issues (opportunity to position FUZE as quality differentiator)

## OUTPUT FORMAT

Return valid JSON with this EXACT structure:

{
  "company": {
    "name": "string",
    "legalName": "string or null",
    "website": "string or null",
    "linkedin": "string or null",
    "headquarters": "string",
    "founded": "string or null",
    "employeeCount": "string (range like '1,000-5,000')",
    "revenue": "string or null",
    "ticker": "string or null",
    "description": "string",
    "parentCompany": "string or null",
    "industry": "string",
    "keyMarkets": ["string"]
  },
  "contacts": [
    {
      "name": "string",
      "title": "string",
      "linkedin": "string or null",
      "email": "string or null",
      "emailConfidence": "verified|likely|estimated",
      "phone": "string or null",
      "relevance": "string (why this person matters to FUZE — be specific)",
      "priority": 1
    }
  ],
  "products": {
    "categories": ["string"],
    "keyBrands": ["string"],
    "targetMarkets": ["string"],
    "knownSuppliers": ["string"],
    "sustainability": ["string"],
    "materialsStrategy": ["string"],
    "recentLaunches": ["string"]
  },
  "opportunity": {
    "fitScore": "number 1-10",
    "fitReason": "string",
    "bestProductLines": ["string"],
    "estimatedScale": "Small|Medium|Large|Enterprise",
    "currentAntimicrobial": "string or null",
    "competitors": ["string"],
    "displacementAngle": "string or null",
    "objections": [{"objection": "string", "counter": "string"}],
    "suggestedApproach": "string (the single best angle)",
    "openingMessage": "string (draft cold email opening — 2-3 sentences, personalized)"
  },
  "news": [
    {
      "headline": "string",
      "date": "string",
      "summary": "string",
      "relevance": "string (why this matters for FUZE sales)"
    }
  ],
  "confidence": "HIGH|MEDIUM|LOW",
  "researchNotes": "string (caveats, uncertainties, suggestions for manual follow-up)"
}

## CRITICAL RULES
1. Be AGGRESSIVE — the sales team needs actionable intel, not hedged academic analysis
2. ALWAYS construct email addresses using the most likely format for the company domain. Mark confidence level
3. ALWAYS provide at least 3 contacts. If you can't find specific people, identify likely ROLES and suggest LinkedIn Sales Navigator searches
4. The opportunity analysis must reference THEIR ACTUAL products — never be generic
5. The opening message MUST reference something specific about their business (a recent launch, a sustainability pledge, a product line)
6. Rate confidence honestly: HIGH = solid verified info, MEDIUM = good inference + some verified, LOW = mostly inference
7. Return ONLY the JSON object — no markdown fences, no explanation, no preamble, no trailing text`;

// ─── AI CALLER FUNCTIONS ────────────────────────────────

async function callAnthropic(userMessage: string): Promise<any> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: RESEARCH_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Anthropic API error:", errText);
    return null;
  }

  const result = await response.json();
  const text = result.content?.[0]?.text || "";
  return parseAIJson(text, "Anthropic");
}

async function callOpenAI(userMessage: string): Promise<any> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 8000,
      messages: [
        { role: "system", content: RESEARCH_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenAI API error:", errText);
    return null;
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  return parseAIJson(text, "OpenAI");
}

function parseAIJson(text: string, source: string): any {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON found in ${source} response`);
    const parsed = JSON.parse(jsonMatch[0]);
    parsed._source = source;
    return parsed;
  } catch (e) {
    console.error(`Failed to parse ${source} response:`, text.substring(0, 500));
    return null;
  }
}

// ─── MERGE FUNCTION ─────────────────────────────────────
// Takes results from both AIs and merges them intelligently

function mergeResearch(anthropic: any, openai: any): any {
  // If only one succeeded, use it
  if (!anthropic && !openai) return null;
  if (!anthropic) return { ...openai, _sources: ["OpenAI"] };
  if (!openai) return { ...anthropic, _sources: ["Anthropic"] };

  // Both succeeded — merge intelligently
  const merged: any = { _sources: ["Anthropic", "OpenAI"] };

  // Company: prefer whichever has more complete data
  const ac = anthropic.company || {};
  const oc = openai.company || {};
  merged.company = {
    name: ac.name || oc.name,
    legalName: ac.legalName || oc.legalName,
    website: ac.website || oc.website,
    linkedin: ac.linkedin || oc.linkedin,
    headquarters: ac.headquarters || oc.headquarters,
    founded: ac.founded || oc.founded,
    employeeCount: ac.employeeCount || oc.employeeCount,
    revenue: ac.revenue || oc.revenue,
    ticker: ac.ticker || oc.ticker,
    description: ac.description || oc.description,
    parentCompany: ac.parentCompany || oc.parentCompany,
    industry: ac.industry || oc.industry,
    keyMarkets: uniqueMerge(ac.keyMarkets, oc.keyMarkets),
  };

  // Contacts: merge and deduplicate by name
  const contactMap = new Map<string, any>();
  for (const c of [...(anthropic.contacts || []), ...(openai.contacts || [])]) {
    const key = (c.name || "").toLowerCase().trim();
    if (!key) continue;
    const existing = contactMap.get(key);
    if (!existing) {
      contactMap.set(key, c);
    } else {
      // Merge: prefer non-null fields, keep lower (better) priority
      contactMap.set(key, {
        name: existing.name || c.name,
        title: existing.title || c.title,
        linkedin: existing.linkedin || c.linkedin,
        email: existing.email || c.email,
        emailConfidence: existing.emailConfidence || c.emailConfidence,
        phone: existing.phone || c.phone,
        relevance: (existing.relevance?.length || 0) > (c.relevance?.length || 0) ? existing.relevance : c.relevance,
        priority: Math.min(existing.priority || 99, c.priority || 99),
      });
    }
  }
  merged.contacts = Array.from(contactMap.values()).sort((a, b) => (a.priority || 99) - (b.priority || 99));

  // Products: merge arrays
  const ap = anthropic.products || {};
  const op = openai.products || {};
  merged.products = {
    categories: uniqueMerge(ap.categories, op.categories),
    keyBrands: uniqueMerge(ap.keyBrands, op.keyBrands),
    targetMarkets: uniqueMerge(ap.targetMarkets, op.targetMarkets),
    knownSuppliers: uniqueMerge(ap.knownSuppliers, op.knownSuppliers),
    sustainability: uniqueMerge(ap.sustainability, op.sustainability),
    materialsStrategy: uniqueMerge(ap.materialsStrategy, op.materialsStrategy),
    recentLaunches: uniqueMerge(ap.recentLaunches, op.recentLaunches),
  };

  // Opportunity: prefer Anthropic's analysis (tends to be sharper) but merge arrays
  const ao = anthropic.opportunity || {};
  const oo = openai.opportunity || {};
  merged.opportunity = {
    fitScore: ao.fitScore || oo.fitScore,
    fitReason: (ao.fitReason?.length || 0) > (oo.fitReason?.length || 0) ? ao.fitReason : oo.fitReason,
    bestProductLines: uniqueMerge(ao.bestProductLines, oo.bestProductLines),
    estimatedScale: ao.estimatedScale || oo.estimatedScale,
    currentAntimicrobial: ao.currentAntimicrobial || oo.currentAntimicrobial,
    competitors: uniqueMerge(ao.competitors, oo.competitors),
    displacementAngle: ao.displacementAngle || oo.displacementAngle,
    objections: mergeObjections(ao.objections, oo.objections),
    suggestedApproach: ao.suggestedApproach || oo.suggestedApproach,
    openingMessage: ao.openingMessage || oo.openingMessage,
  };

  // News: merge and deduplicate by headline similarity
  const newsMap = new Map<string, any>();
  for (const n of [...(anthropic.news || []), ...(openai.news || [])]) {
    const key = (n.headline || "").toLowerCase().substring(0, 40);
    if (!key || newsMap.has(key)) continue;
    newsMap.set(key, n);
  }
  merged.news = Array.from(newsMap.values());

  // Confidence: take the higher confidence
  const confRank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const ac_conf = confRank[anthropic.confidence] || 1;
  const oc_conf = confRank[openai.confidence] || 1;
  merged.confidence = ac_conf >= oc_conf ? anthropic.confidence : openai.confidence;

  // Research notes: combine both
  const notes = [
    anthropic.researchNotes && `[Anthropic] ${anthropic.researchNotes}`,
    openai.researchNotes && `[OpenAI] ${openai.researchNotes}`,
    "Results merged from dual-AI research (Anthropic Claude + OpenAI GPT-4o) for maximum coverage.",
  ].filter(Boolean).join(" | ");
  merged.researchNotes = notes;

  return merged;
}

function uniqueMerge(a: string[] | undefined, b: string[] | undefined): string[] {
  const set = new Set<string>();
  for (const item of [...(a || []), ...(b || [])]) {
    if (item) set.add(item);
  }
  return Array.from(set);
}

function mergeObjections(a: any[] | undefined, b: any[] | undefined): any[] {
  const map = new Map<string, any>();
  for (const obj of [...(a || []), ...(b || [])]) {
    const key = (obj.objection || "").toLowerCase().substring(0, 30);
    if (!key || map.has(key)) continue;
    map.set(key, obj);
  }
  return Array.from(map.values()).slice(0, 5);
}

// ─── MAIN ENDPOINT ──────────────────────────────────────

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json().catch(() => ({}));

    const hasAnthropic = !!ANTHROPIC_API_KEY;
    const hasOpenAI = !!OPENAI_API_KEY;

    if (!hasAnthropic && !hasOpenAI) {
      return NextResponse.json(
        { ok: false, error: "No AI API keys configured. Add ANTHROPIC_API_KEY and/or OPENAI_API_KEY to your .env file." },
        { status: 500 }
      );
    }

    // Get brand info
    const brand = await prisma.brand.findUnique({
      where: { id: params.id },
      select: {
        id: true, name: true, website: true, linkedInProfile: true,
        backgroundInfo: true, customerType: true, projectType: true,
        projectDescription: true, pipelineStage: true,
      },
    });

    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }

    // Build the user message
    let userMessage = `Research this brand/company for FUZE Technologies sales outreach: "${brand.name}"`;
    if (brand.website) userMessage += `\nKnown website: ${brand.website}`;
    if (brand.linkedInProfile) userMessage += `\nKnown LinkedIn: ${brand.linkedInProfile}`;
    if (brand.backgroundInfo) userMessage += `\nExisting notes: ${brand.backgroundInfo}`;
    if (brand.customerType) userMessage += `\nCustomer type: ${brand.customerType}`;
    if (brand.projectType) userMessage += `\nProject type: ${brand.projectType}`;
    if (brand.projectDescription) userMessage += `\nProject description: ${brand.projectDescription}`;
    userMessage += `\n\nReturn the FULL JSON intelligence brief. Be thorough, aggressive, and specific. The sales team is depending on this to close deals.`;

    // Fire both AIs in parallel
    const promises: Promise<any>[] = [];
    if (hasAnthropic) promises.push(callAnthropic(userMessage));
    else promises.push(Promise.resolve(null));

    if (hasOpenAI) promises.push(callOpenAI(userMessage));
    else promises.push(Promise.resolve(null));

    const [anthropicResult, openaiResult] = await Promise.all(promises);

    // Merge results
    const research = mergeResearch(anthropicResult, openaiResult);

    if (!research) {
      return NextResponse.json({
        ok: false,
        error: "Both AI models failed to return valid results. Check API keys and try again.",
      }, { status: 500 });
    }

    // Auto-save contacts if requested
    if (body.autoSaveContacts && research.contacts?.length > 0) {
      for (const contact of research.contacts) {
        const nameParts = (contact.name || "").split(" ");
        const firstName = nameParts[0] || null;
        const lastName = nameParts.slice(1).join(" ") || null;

        const existing = contact.email
          ? await prisma.contact.findFirst({ where: { brandId: params.id, email: contact.email } })
          : await prisma.contact.findFirst({ where: { brandId: params.id, firstName, lastName } });

        if (!existing) {
          await prisma.contact.create({
            data: {
              brandId: params.id,
              firstName,
              lastName,
              name: contact.name,
              title: contact.title || null,
              email: contact.email || null,
              phone: contact.phone || null,
            },
          });
        }
      }
    }

    // Auto-fill empty brand fields
    if (!brand.backgroundInfo && research.company?.description) {
      await prisma.brand.update({
        where: { id: params.id },
        data: { backgroundInfo: research.company.description },
      });
    }
    if (!brand.website && research.company?.website) {
      await prisma.brand.update({
        where: { id: params.id },
        data: { website: research.company.website },
      });
    }
    if (!brand.linkedInProfile && research.company?.linkedin) {
      await prisma.brand.update({
        where: { id: params.id },
        data: { linkedInProfile: research.company.linkedin },
      });
    }

    return NextResponse.json({
      ok: true,
      research,
      sources: research._sources || [],
    });
  } catch (e: any) {
    console.error("Brand research error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
