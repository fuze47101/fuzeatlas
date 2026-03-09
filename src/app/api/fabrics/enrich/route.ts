// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ------------------------------------------------------------------ *
 *  FUZE INPUT (FI) Data Enrichment Engine
 *
 *  Scans all fabrics and fills missing structured fields by:
 *  1. Mining the `raw` JSON blob (original CSV row data)
 *  2. Cross-referencing FabricContent rows
 *  3. Looking up statistical averages from similar fabrics in the DB
 *  4. Applying textile-industry heuristics
 *
 *  Every value set by this engine is tagged with "[FI]" prefix in the
 *  note field so it can be reviewed by humans.
 * ------------------------------------------------------------------ */

// ── Textile heuristic tables ──────────────────────────────────────

const CONSTRUCTION_FROM_CONTENT: Record<string, string> = {
  "Cotton":                "Single Jersey Knit",
  "Polyester":             "Interlock Knit",
  "Polyamide (Nylon)":     "Warp Knit Tricot",
  "Elastane (Spandex)":    "Single Jersey Knit",
  "Viscose/Rayon":         "Plain Weave",
  "Wool":                  "Twill Weave",
  "Silk":                  "Satin Weave",
  "Linen":                 "Plain Weave",
};

const CONSTRUCTION_FROM_ENDUSE: Record<string, string> = {
  "t-shirt":       "Single Jersey Knit",
  "athletic":      "Interlock Knit",
  "activewear":    "Interlock Knit",
  "bedding":       "Percale Plain Weave",
  "sheets":        "Percale Plain Weave",
  "towel":         "Terry Loop Weave",
  "denim":         "Twill Weave",
  "outerwear":     "Ripstop Weave",
  "medical":       "Plain Weave",
  "sock":          "Knit Terry Loop",
  "underwear":     "Rib Knit",
};

const YARN_FROM_CONTENT: Record<string, string> = {
  "Cotton":            "Ring Spun",
  "Polyester":         "Filament",
  "Polyamide (Nylon)": "Filament",
  "Viscose/Rayon":     "Filament",
  "Wool":              "Worsted Spun",
  "Linen":             "Long Staple",
  "Silk":              "Filament",
};

const WEIGHT_RANGES: Record<string, { min: number; avg: number; max: number }> = {
  "Single Jersey Knit":  { min: 120, avg: 160, max: 220 },
  "Interlock Knit":      { min: 160, avg: 200, max: 280 },
  "Rib Knit":            { min: 180, avg: 220, max: 300 },
  "Warp Knit Tricot":    { min: 100, avg: 150, max: 200 },
  "Plain Weave":         { min: 80,  avg: 130, max: 200 },
  "Twill Weave":         { min: 150, avg: 220, max: 350 },
  "Satin Weave":         { min: 100, avg: 140, max: 180 },
  "Percale Plain Weave": { min: 100, avg: 120, max: 150 },
  "Terry Loop Weave":    { min: 300, avg: 450, max: 700 },
  "Ripstop Weave":       { min: 80,  avg: 120, max: 180 },
  "Knit Terry Loop":     { min: 200, avg: 280, max: 380 },
};

const WIDTH_DEFAULTS: Record<string, number> = {
  "Single Jersey Knit": 60,
  "Interlock Knit": 60,
  "Rib Knit": 48,
  "Plain Weave": 58,
  "Twill Weave": 58,
  "Percale Plain Weave": 110,
  "Terry Loop Weave": 60,
};

// ── Raw CSV field mining ──────────────────────────────────────────

function mineRaw(raw: any): Record<string, string | null> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string | null> = {};

  // Try to extract construction from multiple possible CSV column names
  for (const key of Object.keys(raw)) {
    const k = key.toLowerCase().trim();
    const v = typeof raw[key] === "string" ? raw[key].trim() : String(raw[key] || "").trim();
    if (!v || v === "null" || v === "undefined" || v === "N/A" || v === "n/a") continue;

    if (/fabric.*construction|construction.*desc/i.test(k)) out.construction = v;
    if (/^color$|fabric.*color|colour/i.test(k)) out.color = v;
    if (/weight.*gsm|\bgsm\b|^weight$/i.test(k) && !out.weightGsm) out.weightGsm = v;
    if (/full.*width|width.*inch/i.test(k)) out.widthInches = v;
    if (/yarn|filament/i.test(k)) out.yarnType = v;
    if (/finish/i.test(k) && !/url/i.test(k)) out.finishNote = v;
    if (/content.*#?1|fabric.*content.*1/i.test(k)) out.content1 = v;
    if (/%.*content.*1|content.*1.*%/i.test(k)) out.percent1 = v;
    if (/content.*#?2|fabric.*content.*2/i.test(k)) out.content2 = v;
    if (/%.*content.*2|content.*2.*%/i.test(k)) out.percent2 = v;
    if (/content.*#?3|fabric.*content.*3/i.test(k)) out.content3 = v;
    if (/category/i.test(k)) out.category = v;
    if (/program/i.test(k)) out.program = v;
    if (/application.*method/i.test(k)) out.applicationMethod = v;
    if (/brand/i.test(k) && !/url/i.test(k)) out.brand = v;
  }
  return out;
}

function parseNumeric(s: string | null | undefined): number | null {
  if (!s) return null;
  const cleaned = String(s).replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ── Canonical material names ──────────────────────────────────────

function canonicalize(raw: string): string {
  const s = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (/spandex|elastane|lycra/i.test(s)) return "Elastane (Spandex)";
  if (/nylon|polyamide|^pa\d/i.test(s)) return "Polyamide (Nylon)";
  if (/polyester|^pet$|^pes$/i.test(s)) return "Polyester";
  if (/cotton|^co$/i.test(s)) return "Cotton";
  if (/viscose|rayon/i.test(s)) return "Viscose/Rayon";
  if (/wool/i.test(s)) return "Wool";
  if (/silk/i.test(s)) return "Silk";
  if (/linen|flax/i.test(s)) return "Linen";
  // Return title-cased original
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

// ── Main enrichment logic ─────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // default to dry run for safety
    const limit = body.limit || 0; // 0 = all

    // Fetch all fabrics with their contents
    const fabrics = await prisma.fabric.findMany({
      include: { contents: true, submissions: { select: { id: true }, take: 1 } },
      ...(limit > 0 ? { take: limit } : {}),
      orderBy: { fuzeNumber: "asc" },
    });

    // Compute global averages from fabrics that DO have data
    const weightsByConstruction: Record<string, number[]> = {};
    const widthsByConstruction: Record<string, number[]> = {};
    for (const f of fabrics) {
      if (f.construction && f.weightGsm) {
        (weightsByConstruction[f.construction] ??= []).push(f.weightGsm);
      }
      if (f.construction && f.widthInches) {
        (widthsByConstruction[f.construction] ??= []).push(f.widthInches);
      }
    }

    const avgWeights: Record<string, number> = {};
    for (const [c, vals] of Object.entries(weightsByConstruction)) {
      avgWeights[c] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    const avgWidths: Record<string, number> = {};
    for (const [c, vals] of Object.entries(widthsByConstruction)) {
      avgWidths[c] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10;
    }

    // Process each fabric
    const results: any[] = [];
    let enrichedCount = 0;
    let skippedCount = 0;
    const updates: { id: string; data: any; contentOps?: any[] }[] = [];

    for (const fabric of fabrics) {
      const rawMined = mineRaw(fabric.raw);
      const changes: Record<string, any> = {};
      const reasons: string[] = [];
      const contentCreates: { material: string; percent: number | null; rawText: string }[] = [];

      // Dominant material from existing contents or raw
      let dominantMaterial: string | null = null;
      if (fabric.contents.length > 0) {
        const sorted = [...fabric.contents].sort((a, b) => (b.percent || 0) - (a.percent || 0));
        dominantMaterial = sorted[0].material;
      } else if (rawMined.content1) {
        dominantMaterial = canonicalize(rawMined.content1);
      }

      // ── CONSTRUCTION ──
      if (!fabric.construction) {
        if (rawMined.construction) {
          changes.construction = rawMined.construction;
          reasons.push("construction from raw CSV data");
        } else if (fabric.endUse) {
          const eu = fabric.endUse.toLowerCase();
          for (const [pattern, constr] of Object.entries(CONSTRUCTION_FROM_ENDUSE)) {
            if (eu.includes(pattern)) { changes.construction = constr; reasons.push(`construction inferred from end-use "${fabric.endUse}"`); break; }
          }
        }
        if (!changes.construction && dominantMaterial && CONSTRUCTION_FROM_CONTENT[dominantMaterial]) {
          changes.construction = CONSTRUCTION_FROM_CONTENT[dominantMaterial];
          reasons.push(`construction inferred from dominant fiber "${dominantMaterial}"`);
        }
      }

      // ── COLOR ──
      if (!fabric.color && rawMined.color) {
        changes.color = rawMined.color;
        reasons.push("color from raw CSV data");
      }

      // ── WEIGHT ──
      if (!fabric.weightGsm) {
        const rawWeight = parseNumeric(rawMined.weightGsm);
        if (rawWeight && rawWeight > 10 && rawWeight < 2000) {
          changes.weightGsm = rawWeight;
          reasons.push("weight from raw CSV data");
        } else {
          const constr = changes.construction || fabric.construction;
          if (constr && avgWeights[constr]) {
            changes.weightGsm = avgWeights[constr];
            reasons.push(`weight from DB average for "${constr}" (${avgWeights[constr]}g/m²)`);
          } else if (constr && WEIGHT_RANGES[constr]) {
            changes.weightGsm = WEIGHT_RANGES[constr].avg;
            reasons.push(`weight from industry average for "${constr}" (${WEIGHT_RANGES[constr].avg}g/m²)`);
          }
        }
      }

      // ── WIDTH ──
      if (!fabric.widthInches) {
        const rawWidth = parseNumeric(rawMined.widthInches);
        if (rawWidth && rawWidth > 10 && rawWidth < 200) {
          changes.widthInches = rawWidth;
          reasons.push("width from raw CSV data");
        } else {
          const constr = changes.construction || fabric.construction;
          if (constr && avgWidths[constr]) {
            changes.widthInches = avgWidths[constr];
            reasons.push(`width from DB average for "${constr}"`);
          } else if (constr && WIDTH_DEFAULTS[constr]) {
            changes.widthInches = WIDTH_DEFAULTS[constr];
            reasons.push(`width from industry default for "${constr}"`);
          }
        }
      }

      // ── YARN TYPE ──
      if (!fabric.yarnType) {
        if (rawMined.yarnType) {
          changes.yarnType = rawMined.yarnType;
          reasons.push("yarn type from raw CSV data");
        } else if (dominantMaterial && YARN_FROM_CONTENT[dominantMaterial]) {
          changes.yarnType = YARN_FROM_CONTENT[dominantMaterial];
          reasons.push(`yarn type inferred from "${dominantMaterial}"`);
        }
      }

      // ── FABRIC CATEGORY ──
      if (!fabric.fabricCategory) {
        const constr = (changes.construction || fabric.construction || "").toLowerCase();
        if (/knit|jersey|rib|interlock|tricot/i.test(constr)) {
          changes.fabricCategory = "knit";
          reasons.push("category inferred as 'knit' from construction");
        } else if (/weave|woven|plain|twill|satin|percale|ripstop|poplin|oxford|canvas|denim/i.test(constr)) {
          changes.fabricCategory = "woven";
          reasons.push("category inferred as 'woven' from construction");
        } else if (/nonwoven|felt|needle.*punch/i.test(constr)) {
          changes.fabricCategory = "nonwoven";
          reasons.push("category inferred as 'nonwoven' from construction");
        }
      }

      // ── FIBER CONTENT (from raw CSV if no content rows exist) ──
      if (fabric.contents.length === 0) {
        if (rawMined.content1) {
          const mat = canonicalize(rawMined.content1);
          const pct = parseNumeric(rawMined.percent1);
          contentCreates.push({ material: mat, percent: pct, rawText: `[FI] ${rawMined.content1}` });
          reasons.push(`fiber content 1 from raw CSV: ${mat} ${pct ? pct + "%" : ""}`);
        }
        if (rawMined.content2) {
          const mat = canonicalize(rawMined.content2);
          const pct = parseNumeric(rawMined.percent2);
          contentCreates.push({ material: mat, percent: pct, rawText: `[FI] ${rawMined.content2}` });
          reasons.push(`fiber content 2 from raw CSV: ${mat} ${pct ? pct + "%" : ""}`);
        }
        if (rawMined.content3) {
          const mat = canonicalize(rawMined.content3);
          const pct = parseNumeric(rawMined.percent3);
          contentCreates.push({ material: mat, percent: pct, rawText: `[FI] ${rawMined.content3}` });
        }
      }

      // If we have changes, prepare the update
      if (Object.keys(changes).length > 0 || contentCreates.length > 0) {
        // Tag the note with [FI] marker
        const fiNote = `[FI] Auto-enriched: ${reasons.join("; ")}`;
        const existingNote = fabric.note || "";
        if (!existingNote.includes("[FI]")) {
          changes.note = existingNote ? `${existingNote}\n${fiNote}` : fiNote;
        } else {
          // Already has FI tag — append new reasons
          changes.note = `${existingNote}\n${fiNote}`;
        }

        enrichedCount++;
        results.push({
          id: fabric.id,
          fuzeNumber: fabric.fuzeNumber,
          fieldsEnriched: Object.keys(changes).filter(k => k !== "note"),
          contentAdded: contentCreates.length,
          reasons,
          preview: changes,
        });

        if (!dryRun) {
          updates.push({
            id: fabric.id,
            data: changes,
            contentOps: contentCreates.length > 0 ? contentCreates : undefined,
          });
        }
      } else {
        skippedCount++;
      }
    }

    // Apply updates if not dry run
    if (!dryRun && updates.length > 0) {
      for (const u of updates) {
        await prisma.fabric.update({ where: { id: u.id }, data: u.data });
        if (u.contentOps) {
          for (const c of u.contentOps) {
            await prisma.fabricContent.create({
              data: { fabricId: u.id, material: c.material, percent: c.percent, rawText: c.rawText },
            });
          }
        }
      }
    }

    // Compute summary stats
    const fieldCounts: Record<string, number> = {};
    for (const r of results) {
      for (const f of r.fieldsEnriched) {
        fieldCounts[f] = (fieldCounts[f] || 0) + 1;
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      totalFabrics: fabrics.length,
      enriched: enrichedCount,
      skipped: skippedCount,
      alreadyComplete: fabrics.length - enrichedCount - skippedCount,
      fieldBreakdown: fieldCounts,
      results: results.slice(0, 50), // Preview first 50
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// GET: Quick data completeness scan (no modifications)
export async function GET() {
  try {
    const total = await prisma.fabric.count();
    const withConstruction = await prisma.fabric.count({ where: { construction: { not: null } } });
    const withWeight = await prisma.fabric.count({ where: { weightGsm: { not: null } } });
    const withWidth = await prisma.fabric.count({ where: { widthInches: { not: null } } });
    const withColor = await prisma.fabric.count({ where: { color: { not: null } } });
    const withYarn = await prisma.fabric.count({ where: { yarnType: { not: null } } });
    const withCategory = await prisma.fabric.count({ where: { fabricCategory: { not: null } } });
    const withContent = await prisma.fabric.count({ where: { contents: { some: {} } } });
    const withEndUse = await prisma.fabric.count({ where: { endUse: { not: null } } });
    const withRaw = await prisma.fabric.count({ where: { raw: { not: null as any } } });
    const withSubmissions = await prisma.fabric.count({ where: { submissions: { some: {} } } });

    return NextResponse.json({
      ok: true,
      total,
      completeness: {
        construction:  { count: withConstruction, pct: Math.round(withConstruction / total * 100) },
        weightGsm:     { count: withWeight, pct: Math.round(withWeight / total * 100) },
        widthInches:    { count: withWidth, pct: Math.round(withWidth / total * 100) },
        color:          { count: withColor, pct: Math.round(withColor / total * 100) },
        yarnType:       { count: withYarn, pct: Math.round(withYarn / total * 100) },
        fabricCategory: { count: withCategory, pct: Math.round(withCategory / total * 100) },
        fiberContent:   { count: withContent, pct: Math.round(withContent / total * 100) },
        endUse:         { count: withEndUse, pct: Math.round(withEndUse / total * 100) },
        rawCsvData:     { count: withRaw, pct: Math.round(withRaw / total * 100) },
        submissions:    { count: withSubmissions, pct: Math.round(withSubmissions / total * 100) },
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
