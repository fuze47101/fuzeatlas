// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const RESEARCH_PROMPT = `You are FUZE Atlas Intelligence — an elite B2B sales research agent for FUZE Technologies, a company that sells antimicrobial textile treatment technology (silver-based, applied at the mill/factory level) to brands and manufacturers worldwide.

Your mission: Given a brand/company name, produce a comprehensive, actionable intelligence brief that a FUZE sales team member can use to immediately begin outreach and close a deal.

## YOUR RESEARCH TARGETS

For the brand provided, you must find and return ALL of the following:

### 1. COMPANY OVERVIEW
- Full legal company name and any DBA/trade names
- Headquarters location (city, state/province, country)
- Company website URL
- LinkedIn company page URL
- Year founded
- Company size (employee count range)
- Annual revenue estimate (if publicly available)
- Stock ticker (if public)
- Brief description of what they do (2-3 sentences max)
- Parent company (if subsidiary)

### 2. KEY DECISION MAKERS (find 3-6 people)
For EACH person, provide:
- Full name
- Title/Position
- LinkedIn profile URL (construct as https://linkedin.com/in/[slug] if you know the slug)
- Email (if publicly available, or construct likely format like first.last@domain.com)
- Phone (if publicly available)
- Why they matter to FUZE (e.g. "Controls fabric sourcing decisions", "Oversees sustainability initiatives")

PRIORITY TARGETS (in order):
1. VP/Director of Product Development or Innovation
2. VP/Director of Materials/Textiles/Sourcing
3. VP/Director of Sustainability/ESG
4. Chief Product Officer / CTO
5. VP/Director of Supply Chain
6. C-Suite (CEO, COO) — especially at smaller companies
7. Buying/Merchandising leads
8. Quality Assurance / Compliance leads

### 3. PRODUCT & MARKET INTELLIGENCE
- What products do they make/sell? (apparel categories, textile types, etc.)
- Key product lines or brands they own
- Target market segments (athletic, outdoor, luxury, workwear, military, medical, etc.)
- Known fabric suppliers or manufacturing partners
- Any sustainability commitments or certifications (bluesign, OEKO-TEX, etc.)
- Recent product launches or innovations mentioned in press

### 4. FUZE OPPORTUNITY ANALYSIS
- Why would this brand want antimicrobial treatment? (odor control, hygiene, performance, etc.)
- Which of their product lines are the best fit for FUZE technology?
- What's the estimated scale opportunity? (Small: <$25K, Medium: $25K-$100K, Large: $100K-$500K, Enterprise: $500K+)
- Competitive landscape: Are they already using antimicrobial tech? From whom? (Polygiene, HeiQ, Microban, etc.)
- Key objections they might have and how to counter them
- Suggested opening approach / angle for first outreach

### 5. RECENT NEWS & TRIGGERS
- Any recent news, press releases, or announcements (last 12 months)
- Leadership changes
- Expansion plans or new factory openings
- Sustainability announcements
- Partnership announcements
- Earnings highlights (if public)

## OUTPUT FORMAT

You MUST return valid JSON with this exact structure:

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
    "industry": "string"
  },
  "contacts": [
    {
      "name": "string",
      "title": "string",
      "linkedin": "string or null",
      "email": "string or null",
      "phone": "string or null",
      "relevance": "string (why this person matters to FUZE)",
      "priority": 1
    }
  ],
  "products": {
    "categories": ["string"],
    "keyBrands": ["string"],
    "targetMarkets": ["string"],
    "knownSuppliers": ["string"],
    "sustainability": ["string"],
    "recentLaunches": ["string"]
  },
  "opportunity": {
    "fitScore": 1-10,
    "fitReason": "string",
    "bestProductLines": ["string"],
    "estimatedScale": "Small|Medium|Large|Enterprise",
    "currentAntimicrobial": "string or null",
    "competitors": ["string"],
    "objections": [{"objection": "string", "counter": "string"}],
    "suggestedApproach": "string",
    "openingMessage": "string (a draft cold email opening paragraph)"
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
  "researchNotes": "string (any caveats, uncertainties, or suggestions for manual follow-up)"
}

## CRITICAL RULES
1. Be AGGRESSIVE in your research — the sales team needs actionable intel, not hedged guesses
2. If you can't find a specific person's email, construct the most likely format (firstname@company.com, first.last@company.com, finitial.last@company.com) and note it as "estimated"
3. Always provide at least 3 contacts. If you can't find specific people, identify the ROLES that exist and suggest searching for them
4. The opportunity analysis should be sharp and specific — not generic. Reference their actual products and market position
5. The opening message should be personalized to THIS brand, referencing something specific about their business
6. Rate your confidence honestly — HIGH means you found solid info, LOW means this is mostly inference
7. Return ONLY the JSON object — no markdown, no explanation, no preamble`;

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "ANTHROPIC_API_KEY not configured. Add it to your .env file." },
        { status: 500 }
      );
    }

    // Get the brand info
    const brand = await prisma.brand.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        website: true,
        linkedInProfile: true,
        backgroundInfo: true,
        customerType: true,
        projectType: true,
        projectDescription: true,
        pipelineStage: true,
      },
    });

    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }

    // Build the user message with context
    let userMessage = `Research this brand/company: "${brand.name}"`;
    if (brand.website) userMessage += `\nKnown website: ${brand.website}`;
    if (brand.linkedInProfile) userMessage += `\nKnown LinkedIn: ${brand.linkedInProfile}`;
    if (brand.backgroundInfo) userMessage += `\nExisting notes: ${brand.backgroundInfo}`;
    if (brand.customerType) userMessage += `\nCustomer type: ${brand.customerType}`;
    if (brand.projectType) userMessage += `\nProject type: ${brand.projectType}`;
    if (brand.projectDescription) userMessage += `\nProject description: ${brand.projectDescription}`;
    userMessage += `\n\nReturn the full JSON intelligence brief. Be thorough and aggressive.`;

    // Call Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
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
      return NextResponse.json(
        { ok: false, error: `AI research failed: ${response.status}` },
        { status: 500 }
      );
    }

    const result = await response.json();
    const aiText = result.content?.[0]?.text || "";

    // Parse the JSON response
    let research;
    try {
      // Extract JSON from the response (handle potential markdown wrapping)
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in AI response");
      research = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", aiText.substring(0, 500));
      return NextResponse.json({
        ok: false,
        error: "AI returned unparseable response",
        raw: aiText.substring(0, 2000),
      }, { status: 500 });
    }

    // Optionally auto-save contacts to the brand
    const body = await req.json().catch(() => ({}));
    if (body.autoSaveContacts && research.contacts?.length > 0) {
      for (const contact of research.contacts) {
        const nameParts = (contact.name || "").split(" ");
        const firstName = nameParts[0] || null;
        const lastName = nameParts.slice(1).join(" ") || null;

        // Check if contact already exists (by email or name)
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

    // Auto-update brand background info if empty
    if (!brand.backgroundInfo && research.company?.description) {
      await prisma.brand.update({
        where: { id: params.id },
        data: { backgroundInfo: research.company.description },
      });
    }

    // Auto-update website if empty
    if (!brand.website && research.company?.website) {
      await prisma.brand.update({
        where: { id: params.id },
        data: { website: research.company.website },
      });
    }

    // Auto-update LinkedIn if empty
    if (!brand.linkedInProfile && research.company?.linkedin) {
      await prisma.brand.update({
        where: { id: params.id },
        data: { linkedInProfile: research.company.linkedin },
      });
    }

    return NextResponse.json({ ok: true, research });
  } catch (e: any) {
    console.error("Brand research error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
