// @ts-nocheck
/**
 * ═══════════════════════════════════════════════════════════════════════
 * Brand research AI callers — shared between `/api/brands/[id]/research`
 * (the V1 wizard entry-point) and `/api/admin/bd/enrich-brand/[id]` (the
 * ticket-3 Enrich button with cross-model validation).
 *
 * Five providers, one prompt, one JSON shape. Each caller returns either:
 *   - a parsed research object (company + contacts + products + opportunity + news)
 *   - or null (API key missing, network error, non-JSON response)
 *
 * Providers all fan out in parallel; the consumer decides whether to merge
 * (V1) or cross-validate (V2 Enrich). We deliberately do NOT hit Gemini —
 * Andrew's call 2026-04-23: "skip Gemini, the other four are enough coverage
 * and Gemini's email hallucination rate was the worst of the bunch."
 * ═══════════════════════════════════════════════════════════════════════
 */

import { aiFetch } from "@/lib/ai-fetch";

export const RESEARCH_PROMPT = `You are FUZE Atlas Intelligence — an elite B2B sales research agent for FUZE Technologies, a company that sells antimicrobial textile treatment technology (high density allotrope, applied at the mill/factory level) to brands and manufacturers worldwide.

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
- LinkedIn profile URL — ONLY provide if you have reasonably high confidence it's the real URL for this person. If uncertain, return null.
- Email — ONLY provide if you can cite a source OR infer with high confidence from the company's known email pattern. If uncertain, return null. DO NOT fabricate.
- Phone (if publicly available)
- WHY they matter to FUZE — be specific

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
- What products do they make/sell?
- Key product lines or sub-brands they own
- Target market segments
- Known fabric suppliers, mills, or manufacturing partners
- Any sustainability commitments, certifications, or pledges
- Recent product launches or innovations (last 18 months)
- Known materials strategy

### 4. FUZE OPPORTUNITY ANALYSIS — BE RUTHLESSLY SPECIFIC
- Why would this brand want antimicrobial treatment?
- Which of their product lines are the BEST fit?
- Estimated deal scale
- Are they ALREADY using antimicrobial tech? From whom?
- If they use a competitor, what's FUZE's angle to displace them?
- Top 3 objections + exact counters
- The SINGLE BEST opening angle
- A draft cold email opening paragraph (2-3 sentences)

### 5. RECENT NEWS & SALES TRIGGERS
- Recent news, press releases (last 12 months)
- Leadership changes
- Expansion plans
- Sustainability announcements
- Partnership or acquisition announcements
- Earnings highlights
- Any mention of antimicrobial, odor control, hygiene, freshness in their marketing
- Product recalls or quality issues

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
    "employeeCount": "string",
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
      "relevance": "string",
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
    "suggestedApproach": "string",
    "openingMessage": "string"
  },
  "news": [
    {
      "headline": "string",
      "date": "string",
      "summary": "string",
      "relevance": "string"
    }
  ],
  "confidence": "HIGH|MEDIUM|LOW",
  "researchNotes": "string"
}

## CRITICAL RULES
1. The Enrich flow cross-validates email + linkedin across all 5 sources. NEVER fabricate — if you don't know, return null. A null that another model fills in is worth infinitely more than a hallucinated string four models disagree with.
2. ALWAYS provide at least 3 contacts. If you can't find specific people, identify likely ROLES (leave name/email null, describe the role in "relevance").
3. The opportunity analysis must reference THEIR ACTUAL products — never be generic.
4. The opening message MUST reference something specific about their business.
5. Rate confidence honestly: HIGH = solid verified info, MEDIUM = good inference + some verified, LOW = mostly inference
6. Return ONLY the JSON object — no markdown fences, no explanation, no preamble, no trailing text`;

export function parseAIJson(text: string, source: string): any {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON found in ${source} response`);
    const parsed = JSON.parse(jsonMatch[0]);
    parsed._source = source;
    return parsed;
  } catch (e) {
    console.error(`[brand-research-callers] Failed to parse ${source} response:`, text.substring(0, 500));
    return null;
  }
}

export async function callAnthropic(userMessage: string, userId?: string, callerRoute = "research"): Promise<any> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const { response } = await aiFetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          system: RESEARCH_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      },
      { provider: "anthropic", callerRoute, userId }
    );
    if (!response.ok) {
      console.error("[brand-research-callers] Anthropic error:", await response.text());
      return null;
    }
    const result = await response.json();
    return parseAIJson(result.content?.[0]?.text || "", "Anthropic");
  } catch (e: any) {
    console.error("[brand-research-callers] Anthropic exception:", e.message);
    return null;
  }
}

export async function callOpenAI(userMessage: string, userId?: string, callerRoute = "research"): Promise<any> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const { response } = await aiFetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
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
      { provider: "openai", callerRoute, userId }
    );
    if (!response.ok) {
      console.error("[brand-research-callers] OpenAI error:", await response.text());
      return null;
    }
    const result = await response.json();
    return parseAIJson(result.choices?.[0]?.message?.content || "", "OpenAI");
  } catch (e: any) {
    console.error("[brand-research-callers] OpenAI exception:", e.message);
    return null;
  }
}

export async function callGrok(userMessage: string, userId?: string, callerRoute = "research-grok"): Promise<any> {
  const key = process.env.GROK_API_KEY;
  if (!key) return null;
  try {
    const { response } = await aiFetch(
      "https://api.x.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "grok-3-latest",
          max_tokens: 8000,
          messages: [
            {
              role: "system",
              content:
                RESEARCH_PROMPT +
                "\n\nIMPORTANT: You have real-time access to X/Twitter and current news. Prioritize finding RECENT information (last 6 months): executive changes, product launches, sustainability announcements, funding rounds, M&A activity. Cross-reference social media posts from company accounts and executives.",
            },
            { role: "user", content: userMessage },
          ],
          temperature: 0.3,
        }),
      },
      { provider: "openai" as any, callerRoute, userId }
    );
    if (!response.ok) {
      console.error("[brand-research-callers] Grok error:", await response.text());
      return null;
    }
    const result = await response.json();
    return parseAIJson(result.choices?.[0]?.message?.content || "", "Grok");
  } catch (e: any) {
    console.error("[brand-research-callers] Grok exception:", e.message);
    return null;
  }
}

export async function callPerplexity(userMessage: string, userId?: string, callerRoute = "research-perplexity"): Promise<any> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return null;
  try {
    const { response } = await aiFetch(
      "https://api.perplexity.ai/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "sonar-pro",
          max_tokens: 8000,
          messages: [
            {
              role: "system",
              content:
                RESEARCH_PROMPT +
                "\n\nIMPORTANT: You search the web in real-time. CITE ALL SOURCES. Every factual claim must come from a verifiable web source. Focus on: LinkedIn profiles (verify they exist), company websites, press releases, SEC filings, industry databases. Flag anything you cannot verify with a source.",
            },
            { role: "user", content: userMessage },
          ],
          temperature: 0.2,
        }),
      },
      { provider: "openai" as any, callerRoute, userId }
    );
    if (!response.ok) {
      console.error("[brand-research-callers] Perplexity error:", await response.text());
      return null;
    }
    const result = await response.json();
    return parseAIJson(result.choices?.[0]?.message?.content || "", "Perplexity");
  } catch (e: any) {
    console.error("[brand-research-callers] Perplexity exception:", e.message);
    return null;
  }
}
