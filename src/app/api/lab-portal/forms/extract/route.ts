// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { aiFetch } from "@/lib/ai-fetch";

/**
 * POST /api/lab-portal/forms/extract
 *
 * Phase 52 T4 — drag-and-drop PDF → AI-extracted field schema.
 *
 * Accepts multipart/form-data { file: PDF }. Extracts text with pdf-parse,
 * sends to Claude Sonnet with a strict JSON-shape prompt, returns the
 * suggested template the lab user can review before saving.
 *
 * Response: { ok, suggested: { templateName, fields: [...] }, sourceText }
 *
 * Brand-voice guard: any extracted field label containing "silver",
 * "nano", or "Ag" gets substituted with "FUZE" / "metamaterial" before
 * returning. Lab forms sometimes have legacy ion-leaching chemistry
 * labels we don't want propagating into Atlas templates.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";
const ALLOWED_TYPES = new Set(["text", "number", "date", "select", "checkbox", "textarea"]);

const BANNED_TOKENS = [
  { re: /\bsilver\b/gi, replace: "FUZE" },
  { re: /\bnano\b/gi, replace: "metamaterial" },
  { re: /\bAg\b/g, replace: "FUZE" },
];

function scrubBrandVoice(s: string | null | undefined): string {
  if (!s) return "";
  let out = String(s);
  for (const ban of BANNED_TOKENS) out = out.replace(ban.re, ban.replace);
  return out;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.labId && !["ADMIN", "EMPLOYEE"].includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden — lab account required" }, { status: 403 });
  }
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: "multipart/form-data required" }, { status: 400 });
  }
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ ok: false, error: "file field required" }, { status: 400 });
  }
  const blob = file as File;
  const buffer = Buffer.from(await blob.arrayBuffer());

  // Lazy-load pdf-parse — it's CJS and has a side-effect-y init.
  let pdfText = "";
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    pdfText = String(parsed.text || "").trim();
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `PDF parse failed: ${e?.message || "unknown"}` },
      { status: 400 },
    );
  }
  if (!pdfText) {
    return NextResponse.json(
      { ok: false, error: "PDF had no extractable text (image-only PDF?)" },
      { status: 422 },
    );
  }

  const systemPrompt = `You are extracting form fields from a laboratory test intake form (PDF).
The form will be filled out by a customer requesting a test from this lab. Extract every fillable field and return as JSON ONLY (no prose around it):

{
  "templateName": "...",
  "fields": [
    {
      "key": "snake_case_id",
      "label": "Display label shown to user",
      "type": "text" | "number" | "date" | "select" | "checkbox" | "textarea",
      "required": true | false,
      "options": ["option1", "option2"],
      "hint": "optional helper text"
    }
  ]
}

Rules:
- Don't include fields the lab fills in itself (lab number, accession #, date received). Only fields the CUSTOMER must provide.
- For check-the-applicable-test-method fields, use type=select with options as listed in the PDF.
- Number-only fields → type="number" with a hint about units.
- Multi-line description fields → type="textarea".
- Preserve original field labels from the PDF — don't paraphrase.
- Never use "silver", "nano", or "Ag" in field labels — FUZE Atlas brand voice is "FUZE" + "metamaterial".`;

  async function callClaude(retry = false): Promise<any> {
    const userContent = retry
      ? `Re-extract the same form. The previous response was not valid JSON. Return JSON ONLY:\n\n${pdfText.slice(0, 20000)}`
      : `Extract the form fields from this lab intake form PDF:\n\n${pdfText.slice(0, 20000)}`;

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
          model: MODEL,
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        }),
      },
      { provider: "anthropic", callerRoute: "lab-forms-extract", userId: user.id },
    );

    if (!response.ok) {
      throw new Error(`Claude error ${response.status}`);
    }
    const data = await response.json();
    const text = data?.content?.[0]?.text || "";
    // Tolerate a fenced block.
    const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      return JSON.parse(stripped);
    } catch {
      return null;
    }
  }

  let parsed = await callClaude(false);
  if (!parsed || !Array.isArray(parsed?.fields)) {
    parsed = await callClaude(true);
  }
  if (!parsed || !Array.isArray(parsed?.fields)) {
    return NextResponse.json(
      { ok: false, error: "Claude returned a non-JSON response after retry" },
      { status: 502 },
    );
  }

  // Sanitize + validate + brand-voice scrub.
  const fields = parsed.fields
    .map((f: any) => {
      const type = ALLOWED_TYPES.has(String(f?.type)) ? String(f.type) : "text";
      const key = String(f?.key || "")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 64);
      if (!key) return null;
      return {
        key,
        label: scrubBrandVoice(f?.label) || key,
        type,
        required: Boolean(f?.required),
        options: Array.isArray(f?.options)
          ? f.options.map((o: any) => scrubBrandVoice(String(o)))
          : undefined,
        hint: f?.hint ? scrubBrandVoice(String(f.hint)) : undefined,
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    ok: true,
    suggested: {
      templateName: scrubBrandVoice(parsed.templateName) || "Lab Intake Form",
      fields,
    },
    sourceTextChars: pdfText.length,
  });
}

export const maxDuration = 60;
