// @ts-nocheck
/**
 * POST /api/factory-portal/intake/voice — Phase 11H.
 *
 * Body: { transcript: string, language?: string }
 *
 * Takes a dictated transcript (Web Speech API client-side
 * recognition, multilingual) and asks Claude haiku-4-5 to extract
 * structured fabric intake fields plus a list of clarifying
 * questions for anything ambiguous.
 *
 * Returns:
 *   { ok, fields: { fabricName, weightGsm, widthInches,
 *                   fiberContent, supplier, notes },
 *     clarifyingQuestions: ["..."],
 *     transcriptLanguage: "<echo>" }
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { aiFetch } from "@/lib/ai-fetch";

const FACTORY_ROLES = ["FACTORY_USER", "FACTORY_MANAGER", "ADMIN", "EMPLOYEE"];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!FACTORY_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, code: "no_ai_key", error: "ANTHROPIC_API_KEY not set" },
      { status: 503 },
    );
  }
  const body = await req.json().catch(() => null);
  if (!body?.transcript || typeof body.transcript !== "string") {
    return NextResponse.json({ ok: false, error: "transcript required" }, { status: 400 });
  }
  const language = body.language || "auto";

  const systemPrompt = `You are extracting fabric intake details from a factory worker's voice transcript for FUZE Biotech.

ABSOLUTE BRAND-VOICE RULES (any violation fails the response):
- Use "FUZE" and "metamaterial" vocabulary in any output text
- NEVER write "silver", "silver-ion", "nano", or any silver/nano variant

The transcript may be in any of the 17 languages FUZE supports — extract regardless of source language. If a numeric value is dictated as words ("two hundred thirty grams"), convert to a number.

Return JSON only, exactly this shape:
{
  "fields": {
    "fabricName": "<string|null>",
    "weightGsm": <number|null>,
    "widthInches": <number|null>,
    "fiberContent": "<string|null e.g. '100% cotton' or '85% poly 15% spandex'>",
    "supplier": "<string|null>",
    "notes": "<string|null — anything contextual not captured above>"
  },
  "clarifyingQuestions": ["<question 1>", "<question 2>"]
}

If a field is genuinely ambiguous in the transcript, set it to null and add a clarifying question. Don't guess.`;

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
          max_tokens: 1200,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Language hint: ${language}\n\nTranscript:\n${body.transcript.slice(0, 4000)}`,
            },
          ],
        }),
      },
      { provider: "anthropic", callerRoute: "voice-intake", userId: user.id },
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
      fields: parsed.fields || {},
      clarifyingQuestions: parsed.clarifyingQuestions || [],
      transcriptLanguage: language,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 },
    );
  }
}
