// @ts-nocheck
/**
 * POST /api/lab-portal/wizard/start — Phase 10C.
 *
 * Auto-fills a LabFormTemplate using everything Atlas knows about
 * the target fabric / brand / factory. Returns:
 *   {
 *     ok, fields: { key: value }, confidence: { key: 0..1 },
 *     notes: ["I couldn't fill X because…"]
 *   }
 *
 * If ANTHROPIC_API_KEY isn't set, the route still returns —
 * just with rule-based fills (no AI augmentation) and a single
 * note explaining the AI fall-through. Lab user reviews + edits
 * in /lab-portal/wizard/[formTemplateId].
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { aiFetch } from "@/lib/ai-fetch";

const LAB_ROLES = ["LAB_USER", "LAB_MANAGER", "ADMIN", "EMPLOYEE"];

interface FormField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!LAB_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.formTemplateId) {
    return NextResponse.json({ ok: false, error: "formTemplateId required" }, { status: 400 });
  }

  const template = await prisma.labFormTemplate.findUnique({
    where: { id: body.formTemplateId },
  });
  if (!template) {
    return NextResponse.json({ ok: false, error: "Template not found" }, { status: 404 });
  }

  const fields: FormField[] = Array.isArray(template.fields) ? template.fields : [];

  // Gather context
  const [fabric, brand, factory, lab] = await Promise.all([
    body.fabricId
      ? prisma.fabric.findUnique({
          where: { id: body.fabricId },
          select: {
            id: true,
            fuzeNumber: true,
            customerCode: true,
            factoryCode: true,
            construction: true,
            weightGsm: true,
            width: true,
            yarnType: true,
            fabricCategory: true,
            color: true,
            note: true,
          },
        })
      : null,
    body.brandId
      ? prisma.brand.findUnique({
          where: { id: body.brandId },
          select: {
            id: true,
            name: true,
            requiredFuzeTier: true,
            icpCadenceEveryNBatches: true,
            icpCadenceEveryLitersConsumed: true,
            protocolDocUrl: true,
            textileCategory: true,
            country: true,
          },
        })
      : null,
    body.factoryId
      ? prisma.factory.findUnique({
          where: { id: body.factoryId },
          select: {
            id: true,
            name: true,
            country: true,
            city: true,
            email: true,
            phone: true,
          },
        })
      : null,
    body.labId || user.labId
      ? prisma.lab.findUnique({
          where: { id: body.labId || user.labId },
          select: { id: true, name: true, country: true, timezone: true },
        })
      : null,
  ]);

  // Rule-based heuristics first — these are always correct so we
  // start the confidence map at 1.0 for these fields.
  const filled: Record<string, any> = {};
  const confidence: Record<string, number> = {};
  const notes: string[] = [];

  for (const f of fields) {
    const k = f.key.toLowerCase();
    if (k.includes("fabric") && k.includes("number") && fabric?.fuzeNumber) {
      filled[f.key] = `FUZE-${fabric.fuzeNumber}`;
      confidence[f.key] = 1.0;
    } else if (k.includes("customer") && k.includes("code") && fabric?.customerCode) {
      filled[f.key] = fabric.customerCode;
      confidence[f.key] = 1.0;
    } else if ((k === "construction" || k.includes("construction")) && fabric?.construction) {
      filled[f.key] = fabric.construction;
      confidence[f.key] = 1.0;
    } else if (k.includes("gsm") && fabric?.weightGsm) {
      filled[f.key] = fabric.weightGsm;
      confidence[f.key] = 1.0;
    } else if (k.includes("width") && fabric?.width) {
      filled[f.key] = fabric.width;
      confidence[f.key] = 1.0;
    } else if (k.includes("color") && fabric?.color) {
      filled[f.key] = fabric.color;
      confidence[f.key] = 1.0;
    } else if (k.includes("brand") && k.includes("name") && brand?.name) {
      filled[f.key] = brand.name;
      confidence[f.key] = 1.0;
    } else if (k.includes("factory") && k.includes("name") && factory?.name) {
      filled[f.key] = factory.name;
      confidence[f.key] = 1.0;
    } else if (k.includes("tier") && brand?.requiredFuzeTier) {
      filled[f.key] = brand.requiredFuzeTier;
      confidence[f.key] = 1.0;
    } else if (k === "country" && (factory?.country || brand?.country)) {
      filled[f.key] = factory?.country || brand?.country;
      confidence[f.key] = 0.9;
    } else if (k.includes("category") && (fabric?.fabricCategory || brand?.textileCategory)) {
      filled[f.key] = fabric?.fabricCategory || brand?.textileCategory;
      confidence[f.key] = 0.85;
    }
  }

  // AI augmentation for unfilled fields.
  const unfilled = fields.filter((f) => !(f.key in filled));
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && unfilled.length > 0) {
    const systemPrompt = `You are filling a lab intake form for FUZE Biotech, an antimicrobial textile treatment company. Use the canonical FUZE voice — never write "silver", "silver-ion", "nano", or "nanoparticle" in customer-facing fields. Use FUZE / metamaterial vocabulary.

Fields you can use:
- F1 Full Spectrum (1.0 mg/kg, 100 washes), F2 Advanced (0.75, 75), F3 Core (0.5, 50), F4 Foundation (0.25, 25)
- ASTM E2149 is the primary antimicrobial test (24h incubation, Mueller Hinton low-sulfur broth, UV sterilization)
- AATCC 100, AATCC 30 (antifungal), ISO 18184 (antiviral), ISO 20743

Return JSON only. For each unfilled field, suggest a value with a confidence 0..1, or null if you genuinely don't have enough info to fill it. Output shape:
{
  "fields": { "<key>": <value or null>, ... },
  "confidence": { "<key>": <0..1>, ... },
  "notes": ["<reason if anything is null>"]
}`;
    const userMsg = JSON.stringify(
      {
        unfilledFields: unfilled,
        fabric,
        brand,
        factory,
        lab,
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
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2000,
            system: systemPrompt,
            messages: [{ role: "user", content: userMsg }],
          }),
        },
        { provider: "anthropic", callerRoute: "lab-wizard-start", userId: user.id },
      );
      if (response.ok) {
        const data = await response.json();
        const text = data.content?.[0]?.text || "";
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          for (const [k, v] of Object.entries(parsed.fields || {})) {
            if (v != null && !(k in filled)) {
              filled[k] = v;
              confidence[k] = parsed.confidence?.[k] ?? 0.6;
            }
          }
          if (Array.isArray(parsed.notes)) {
            for (const n of parsed.notes) notes.push(String(n));
          }
        }
      } else {
        notes.push(`AI fallback unavailable (Claude returned ${response.status}); only rule-based fills applied.`);
      }
    } catch (err: any) {
      notes.push(`AI fallback failed: ${err?.message || String(err)}`);
    }
  } else if (!anthropicKey && unfilled.length > 0) {
    notes.push(
      `ANTHROPIC_API_KEY not set on this server — only rule-based fills applied. ${unfilled.length} field(s) left blank.`,
    );
  }

  return NextResponse.json({
    ok: true,
    template: { id: template.id, name: template.name, fields },
    fields: filled,
    confidence,
    notes,
    context: { fabric, brand, factory, lab },
  });
}
