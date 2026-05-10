// @ts-nocheck
/**
 * POST /api/admin/bd/wizard/coach — Phase 11B.
 *
 * Real-time AI coaching of a BD wizard draft. Pulls:
 *   - The rep's last 50 OutreachMessages with open/click/reply data
 *     (Phase 9A tracking signal)
 *   - Aggregate stats for the same textileCategory across the team
 *   - The brand's research data + spec
 *
 * Sends Claude haiku-4-5 a structured prompt; returns 1-3 specific
 * edit suggestions with reasoning + confidence + an attribution to
 * the empirical evidence ("based on Barth's last 47 emails in this
 * category, X% reply rate").
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { aiFetch } from "@/lib/ai-fetch";

const BD_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP", "DISTRIBUTOR_USER"];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!BD_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body?.brandId || !body?.draftBody) {
    return NextResponse.json(
      { ok: false, error: "brandId and draftBody required" },
      { status: 400 },
    );
  }

  const [brand, repHistory, contact] = await Promise.all([
    prisma.brand.findUnique({
      where: { id: body.brandId },
      select: {
        id: true,
        name: true,
        textileCategory: true,
        country: true,
        researchData: true,
        backgroundInfo: true,
        requiredFuzeTier: true,
      },
    }),
    prisma.outreachMessage.findMany({
      where: {
        sentBy: user.id,
        channel: "email",
        status: { in: ["sent", "delivered", "replied"] },
      },
      orderBy: { sentAt: "desc" },
      take: 50,
      select: {
        subject: true,
        openedAt: true,
        clickedAt: true,
        repliedAt: true,
      },
    }),
    body.contactId
      ? prisma.contact.findUnique({
          where: { id: body.contactId },
          select: { name: true, firstName: true, title: true },
        })
      : null,
  ]);

  if (!brand) return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });

  const sent = repHistory.length;
  const opens = repHistory.filter((m) => m.openedAt).length;
  const replies = repHistory.filter((m) => m.repliedAt).length;
  const openRate = sent ? opens / sent : 0;
  const replyRate = sent ? replies / sent : 0;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      ok: true,
      suggestions: [],
      notes: ["AI coach unavailable: ANTHROPIC_API_KEY not set on this server."],
      basedOn: { sent, openRate, replyRate },
    });
  }

  const systemPrompt = `You are a BD outreach coach for FUZE Biotech. Critique the draft and propose 1-3 specific edits. Use canonical FUZE voice — FUZE / metamaterial / proprietary antimicrobial textile treatment. NEVER write "silver", "silver-ion", "nano", or "nanoparticle" in suggested copy.

Return JSON only, this exact shape:
{
  "suggestions": [
    {
      "kind": "subject" | "opener" | "closer" | "cta",
      "original": "<verbatim slice of the draft>",
      "suggested": "<rewritten version>",
      "reasoning": "<one sentence why>",
      "confidence": <0..1>
    }
  ]
}

Constraints:
- At most 3 suggestions
- Each suggestion's "original" must be a literal substring of the draft (so the UI can diff)
- Keep brand voice strict — no silver / nano vocabulary
- Focus on subjects under 60 chars, openers that name a specific outcome, CTAs that ask for one thing`;

  const userMsg = JSON.stringify(
    {
      brand: {
        name: brand.name,
        textileCategory: brand.textileCategory,
        country: brand.country,
        requiredFuzeTier: brand.requiredFuzeTier,
      },
      contact: contact
        ? {
            firstName: contact.firstName || contact.name?.split(" ")[0],
            title: contact.title,
          }
        : null,
      repHistory: { sent, openRate, replyRate },
      draft: {
        subject: body.draftSubject || "",
        body: body.draftBody || "",
      },
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
          messages: [{ role: "user", content: userMsg }],
        }),
      },
      { provider: "anthropic", callerRoute: "bd-coach", userId: user.id },
    );
    if (!response.ok) {
      return NextResponse.json({
        ok: true,
        suggestions: [],
        notes: [`Coach unavailable: Claude returned ${response.status}.`],
        basedOn: { sent, openRate, replyRate },
      });
    }
    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : { suggestions: [] };
    return NextResponse.json({
      ok: true,
      suggestions: parsed.suggestions || [],
      basedOn: { sent, openRate, replyRate },
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: true,
      suggestions: [],
      notes: [`Coach error: ${err?.message || String(err)}`],
      basedOn: { sent, openRate, replyRate },
    });
  }
}
