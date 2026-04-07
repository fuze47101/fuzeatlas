// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { aiFetch, getUserIdFromHeaders } from "@/lib/ai-fetch";

const prisma = new PrismaClient();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROK_API_KEY = process.env.GROK_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// ─── THE PROMPT ─────────────────────────────────────────
// This is the core research prompt shared by both AI models.
// It's specifically tuned for FUZE Technologies' B2B sales motion.

const RESEARCH_PROMPT = `You are FUZE Atlas Intelligence — an elite B2B sales research agent for FUZE Technologies, a company that sells antimicrobial textile treatment technology (high density allotrope, applied at the mill/factory level) to brands and manufacturers worldwide.

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
- Which of their product lines are the BEST fit for FUZE antimicrobial technology? Name exact product lines
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

async function callAnthropic(userMessage: string, userId?: string): Promise<any> {
  const { response } = await aiFetch(
    "https://api.anthropic.com/v1/messages",
    {
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
    },
    { provider: "anthropic", callerRoute: "research", userId }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Anthropic API error:", errText);
    return null;
  }

  const result = await response.json();
  const text = result.content?.[0]?.text || "";
  return parseAIJson(text, "Anthropic");
}

async function callOpenAI(userMessage: string, userId?: string): Promise<any> {
  const { response } = await aiFetch(
    "https://api.openai.com/v1/chat/completions",
    {
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
    },
    { provider: "openai", callerRoute: "research", userId }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenAI API error:", errText);
    return null;
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  return parseAIJson(text, "OpenAI");
}

async function callGrok(userMessage: string, userId?: string): Promise<any> {
  // Grok uses the OpenAI-compatible API at api.x.ai
  const { response } = await aiFetch(
    "https://api.x.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-3-latest",
        max_tokens: 8000,
        messages: [
          { role: "system", content: RESEARCH_PROMPT + "\n\nIMPORTANT: You have real-time access to X/Twitter and current news. Prioritize finding RECENT information (last 6 months): executive changes, new product launches, sustainability announcements, funding rounds, M&A activity. Cross-reference social media posts from company accounts and key executives." },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
      }),
    },
    { provider: "openai" as any, callerRoute: "research-grok", userId }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Grok API error:", errText);
    return null;
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  return parseAIJson(text, "Grok");
}

async function callPerplexity(userMessage: string, userId?: string): Promise<any> {
  if (!PERPLEXITY_API_KEY) return null;

  const { response } = await aiFetch(
    "https://api.perplexity.ai/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        max_tokens: 8000,
        messages: [
          { role: "system", content: RESEARCH_PROMPT + "\n\nIMPORTANT: You search the web in real-time. CITE ALL SOURCES. Every factual claim must come from a verifiable web source. Focus on: LinkedIn profiles (verify they exist), company websites, press releases, SEC filings, industry databases. Flag anything you cannot verify with a source." },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
      }),
    },
    { provider: "openai" as any, callerRoute: "research-perplexity", userId }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Perplexity API error:", errText);
    return null;
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";
  return parseAIJson(text, "Perplexity");
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
// Takes results from all AIs and merges them intelligently

function mergeResearch(anthropic: any, openai: any, grok?: any, perplexity?: any): any {
  const results = [
    { data: anthropic, name: "Anthropic" },
    { data: openai, name: "OpenAI" },
    { data: grok, name: "Grok" },
    { data: perplexity, name: "Perplexity" },
  ].filter(r => r.data);

  if (results.length === 0) return null;
  if (results.length === 1) return { ...results[0].data, _sources: [results[0].name] };

  // Multiple succeeded — merge intelligently
  const merged: any = { _sources: results.map(r => r.name) };

  // Company: merge all sources — first non-null wins for each field
  const companies = results.map(r => r.data.company || {});
  const pick = (field: string) => {
    for (const c of companies) { if (c[field]) return c[field]; }
    return null;
  };
  merged.company = {
    name: pick("name"),
    legalName: pick("legalName"),
    website: pick("website"),
    linkedin: pick("linkedin"),
    headquarters: pick("headquarters"),
    founded: pick("founded"),
    employeeCount: pick("employeeCount"),
    revenue: pick("revenue"),
    ticker: pick("ticker"),
    description: pick("description"),
    parentCompany: pick("parentCompany"),
    industry: pick("industry"),
    keyMarkets: uniqueMerge(...companies.map((c: any) => c.keyMarkets)),
  };

  // Contacts: merge and deduplicate by name from ALL sources
  const contactMap = new Map<string, any>();
  for (const r of results) {
  for (const c of (r.data.contacts || [])) {
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
  }
  merged.contacts = Array.from(contactMap.values()).sort((a, b) => (a.priority || 99) - (b.priority || 99));

  // Products: merge arrays from all sources
  const products = results.map(r => r.data.products || {});
  merged.products = {
    categories: uniqueMerge(...products.map((p: any) => p.categories)),
    keyBrands: uniqueMerge(...products.map((p: any) => p.keyBrands)),
    targetMarkets: uniqueMerge(...products.map((p: any) => p.targetMarkets)),
    knownSuppliers: uniqueMerge(...products.map((p: any) => p.knownSuppliers)),
    sustainability: uniqueMerge(...products.map((p: any) => p.sustainability)),
    materialsStrategy: uniqueMerge(...products.map((p: any) => p.materialsStrategy)),
    recentLaunches: uniqueMerge(...products.map((p: any) => p.recentLaunches)),
  };

  // Opportunity: prefer Anthropic's analysis but merge arrays from all
  const opportunities = results.map(r => r.data.opportunity || {});
  const pickOpp = (field: string) => {
    // Pick the longest/most detailed string value
    let best: any = null;
    for (const o of opportunities) {
      if (o[field] && (!best || String(o[field]).length > String(best).length)) best = o[field];
    }
    return best;
  };
  merged.opportunity = {
    fitScore: pickOpp("fitScore"),
    fitReason: pickOpp("fitReason"),
    bestProductLines: uniqueMerge(...opportunities.map((o: any) => o.bestProductLines)),
    estimatedScale: pickOpp("estimatedScale"),
    currentAntimicrobial: pickOpp("currentAntimicrobial"),
    competitors: uniqueMerge(...opportunities.map((o: any) => o.competitors)),
    displacementAngle: pickOpp("displacementAngle"),
    objections: mergeObjections(...opportunities.map((o: any) => o.objections)),
    suggestedApproach: pickOpp("suggestedApproach"),
    openingMessage: pickOpp("openingMessage"),
  };

  // News: merge and deduplicate from all sources
  const newsMap = new Map<string, any>();
  for (const r of results) {
    for (const n of (r.data.news || [])) {
      const key = (n.headline || "").toLowerCase().substring(0, 40);
      if (!key || newsMap.has(key)) continue;
      newsMap.set(key, n);
    }
  }
  merged.news = Array.from(newsMap.values());

  // Confidence: take the highest across all sources
  const confRank: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  let bestConf = "LOW";
  for (const r of results) {
    if ((confRank[r.data.confidence] || 0) > (confRank[bestConf] || 0)) {
      bestConf = r.data.confidence;
    }
  }
  merged.confidence = bestConf;

  // Research notes: combine all
  const notes = [
    ...results.map(r => r.data.researchNotes ? `[${r.name}] ${r.data.researchNotes}` : null),
    `Results merged from ${results.length}-AI research (${results.map(r => r.name).join(" + ")}) for maximum coverage and hallucination reduction.`,
  ].filter(Boolean).join(" | ");
  merged.researchNotes = notes;

  return merged;
}

function uniqueMerge(...arrays: (string[] | undefined)[]): string[] {
  const set = new Set<string>();
  for (const arr of arrays) {
    for (const item of (arr || [])) {
      if (item) set.add(item);
    }
  }
  return Array.from(set);
}

function mergeObjections(...arrays: (any[] | undefined)[]): any[] {
  const map = new Map<string, any>();
  for (const arr of arrays) {
    for (const obj of (arr || [])) {
      const key = (obj?.objection || "").toLowerCase().substring(0, 30);
      if (!key || map.has(key)) continue;
      map.set(key, obj);
    }
  }
  return Array.from(map.values()).slice(0, 5);
}

// ─── GET: Load saved research ───────────────────────────

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const brand = await prisma.brand.findUnique({
      where: { id: params.id },
      select: { researchData: true, researchDate: true },
    });

    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }

    if (!brand.researchData) {
      return NextResponse.json({ ok: true, research: null });
    }

    return NextResponse.json({
      ok: true,
      research: brand.researchData,
      researchDate: brand.researchDate,
      sources: (brand.researchData as any)?._sources || [],
    });
  } catch (e: any) {
    console.error("Load research error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// ─── POST: Run new research ─────────────────────────────

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json().catch(() => ({}));

    const hasAnthropic = !!ANTHROPIC_API_KEY;
    const hasOpenAI = !!OPENAI_API_KEY;
    const hasGrok = !!GROK_API_KEY;
    const hasPerplexity = !!PERPLEXITY_API_KEY;

    if (!hasAnthropic && !hasOpenAI && !hasGrok) {
      return NextResponse.json(
        { ok: false, error: "No AI API keys configured. Add ANTHROPIC_API_KEY, OPENAI_API_KEY, and/or GROK_API_KEY to your .env file." },
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

    // Extract user ID for audit logging
    const userId = getUserIdFromHeaders(req.headers);

    // Fire ALL AIs in parallel — Anthropic + OpenAI + Grok + Perplexity
    const [anthropicResult, openaiResult, grokResult, perplexityResult] = await Promise.all([
      hasAnthropic ? callAnthropic(userMessage, userId) : Promise.resolve(null),
      hasOpenAI ? callOpenAI(userMessage, userId) : Promise.resolve(null),
      hasGrok ? callGrok(userMessage, userId) : Promise.resolve(null),
      hasPerplexity ? callPerplexity(userMessage, userId) : Promise.resolve(null),
    ]);

    // Merge results from all sources
    const research = mergeResearch(anthropicResult, openaiResult, grokResult, perplexityResult);

    if (!research) {
      return NextResponse.json({
        ok: false,
        error: "All AI models failed to return valid results. Check API keys and try again.",
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

    // Save research results to brand
    await prisma.brand.update({
      where: { id: params.id },
      data: {
        researchData: research,
        researchDate: new Date(),
      },
    });

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
