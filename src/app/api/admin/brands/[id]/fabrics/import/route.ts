// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseFabricCsv } from "@/lib/fabric-csv-import";

/**
 * Phase 18 — Brand Fabric Portfolio CSV importer.
 *
 *   GET    /api/admin/brands/[id]/fabrics/import
 *     Optional ?template=1 returns the canonical CSV template as a
 *     text/csv download. Useful as a single source of truth so the
 *     UI doesn't drift from the parser.
 *
 *   POST   /api/admin/brands/[id]/fabrics/import?dryRun=true
 *     Parses the uploaded CSV (multipart/form-data; field "file")
 *     and returns the ParseResult — rows / errors / warnings /
 *     mill resolution status. No DB writes.
 *
 *   POST   /api/admin/brands/[id]/fabrics/import?dryRun=false
 *     Same parse + factory-alias resolution, then writes:
 *       Fabric upsert, BrandFactory + SupplyChainLink junctions,
 *       FabricSubmission ensure (status=COMPLETE if trial done),
 *       ICP TestRun if hasIcpResult, AM TestRun if hasAmResult,
 *       BrandFactoryAlias remembered for the next import.
 *
 *   Body supports a JSON `aliasResolutions: { [csvName]: factoryId }`
 *   map (sent from the UI after the user resolves unknown mills).
 *   Either via multipart form field `aliasResolutions` (stringified
 *   JSON) or a separate POST body — the UI defaults to multipart.
 *
 *   Auth: ADMIN | EMPLOYEE | SALES_MANAGER | SALES_REP.
 */

const BD_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"]);

const CANONICAL_TEMPLATE = `Mill,Mill Fabric #,Type,Content,Weight (gsm),Brand Article #,Customer Code,Fabric Trial Completed (Y/N),ICP Result Available (Y/N),Antimicrobial Result Available (Y/N),ICP Value (mg/kg),ICP Notes,Report Date (YYYY-MM-DD),Workflow Status,Notes
,,,,,,,,,,,,,NEW,Example row — delete before sending to brand
"Wuxi Paradise Textile","PT-WX-EXAMPLE","DEVELOPMENT","100% Polyester",190,"BRAND-001","FA27K001",Y,Y,N,0.85,"single result from BV","2026-03-15","BULK_PRODUCTION",""
`;

async function nextFuzeNumber() {
  const last = await prisma.fabric.findFirst({
    where: { fuzeNumber: { not: null } },
    orderBy: { fuzeNumber: "desc" },
    select: { fuzeNumber: true },
  });
  return (last?.fuzeNumber || 0) + 1;
}

async function ensureBrandFactoryLink(brandId: string, factoryId: string, log: string[]) {
  try {
    const bfExisting = await prisma.brandFactory.findUnique({
      where: { brandId_factoryId: { brandId, factoryId } },
      select: { id: true },
    });
    if (!bfExisting) {
      await prisma.brandFactory.create({
        data: { brandId, factoryId, note: "Auto-linked from fabric CSV import (phase 18)" },
      });
      log.push(`+ BrandFactory link (${brandId} → ${factoryId})`);
    }
  } catch (e: any) {
    log.push(`⚠ BrandFactory link failed: ${e?.message}`);
  }
  try {
    const sclExisting = await prisma.supplyChainLink.findUnique({
      where: {
        supply_chain_link_unique: {
          fromType: "BRAND",
          fromId: brandId,
          toType: "FACTORY",
          toId: factoryId,
          relation: "SUPPLIES",
        },
      },
      select: { id: true },
    });
    if (!sclExisting) {
      await prisma.supplyChainLink.create({
        data: {
          fromType: "BRAND",
          fromId: brandId,
          toType: "FACTORY",
          toId: factoryId,
          relation: "SUPPLIES",
          active: true,
          notes: "Auto-linked from fabric CSV import (phase 18)",
        },
      });
      log.push(`+ SupplyChainLink (${brandId} → ${factoryId})`);
    }
  } catch (e: any) {
    log.push(`⚠ SupplyChainLink failed: ${e?.message}`);
  }
}

async function ensureSubmission(brandId: string, factoryId: string, fabricId: string, trialDone: boolean) {
  const existing = await prisma.fabricSubmission.findFirst({
    where: { brandId, factoryId, fabricId },
  });
  const status = trialDone ? "COMPLETE" : "SUBMITTED";
  if (existing) {
    if (existing.status !== status) {
      await prisma.fabricSubmission.update({ where: { id: existing.id }, data: { status } });
    }
    return existing;
  }
  return prisma.fabricSubmission.create({ data: { brandId, factoryId, fabricId, status } });
}

async function ensureIcpTestRun(submissionId: string, row: any) {
  if (!row.hasIcpResult || row.icpValue == null) return null;
  const existing = await prisma.testRun.findFirst({
    where: { submissionId, testType: "ICP" },
    include: { icpResult: true },
  });
  if (existing) {
    if (existing.icpResult) {
      await prisma.icpResult.update({
        where: { testRunId: existing.id },
        data: { agValue: row.icpValue, unit: "ppm" },
      });
    } else {
      await prisma.icpResult.create({
        data: { testRunId: existing.id, agValue: row.icpValue, unit: "ppm" },
      });
    }
    return existing;
  }
  return prisma.testRun.create({
    data: {
      submissionId,
      testType: "ICP",
      testDate: row.reportDate ? new Date(row.reportDate) : null,
      brandVisible: false,
      icpResult: { create: { agValue: row.icpValue, unit: "ppm" } },
    },
  });
}

async function ensureAmTestRun(submissionId: string, row: any) {
  if (!row.hasAmResult) return null;
  const existing = await prisma.testRun.findFirst({
    where: { submissionId, testType: "ANTIBACTERIAL" },
  });
  if (existing) return existing;
  return prisma.testRun.create({
    data: {
      submissionId,
      testType: "ANTIBACTERIAL",
      testDate: row.reportDate ? new Date(row.reportDate) : null,
      brandVisible: false,
      abResult: { create: { pass: null } },
    },
  });
}

async function upsertFabric(brandId: string, factoryId: string, row: any) {
  const existing = await prisma.fabric.findFirst({
    where: { brandId, factoryCode: row.millFabricNumber },
  });
  const noteParts: string[] = [];
  if (row.icpNotes) noteParts.push(row.icpNotes);
  if (row.notes) noteParts.push(row.notes);
  if (Object.keys(row.unmappedColumns || {}).length > 0) {
    for (const [k, v] of Object.entries(row.unmappedColumns)) {
      noteParts.push(`[${k}: ${v}]`);
    }
  }
  const data: any = {
    brandId,
    factoryId,
    factoryCode: row.millFabricNumber,
    customerCode: row.customerCode || null,
    customerReference: row.brandArticleNumber || null,
    construction: row.content || null,
    weightGsm: row.weightGsm,
    quantityType: row.type,
    developmentStatus: row.workflowStatus,
    note: noteParts.length ? noteParts.join(" · ") : null,
  };
  if (existing) {
    const updateData: any = { ...data };
    if (existing.fuzeNumber == null) {
      updateData.fuzeNumber = await nextFuzeNumber();
    }
    const updated = await prisma.fabric.update({ where: { id: existing.id }, data: updateData });
    return { fabric: updated, created: false };
  }
  const created = await prisma.fabric.create({
    data: { ...data, fuzeNumber: await nextFuzeNumber() },
  });
  return { fabric: created, created: true };
}

/**
 * Resolve every distinct mill in the CSV against:
 *   1. BrandFactoryAlias (brandId, csvName) — fastest, learned mapping
 *   2. Factory.findFirst({ name: <mill> }) — exact name match
 *   3. aliasResolutions from request body — UI-provided override
 *   4. Otherwise: unresolved (caller must POST again with resolution)
 */
async function resolveMills(
  brandId: string,
  millNames: string[],
  aliasResolutions: Record<string, string>,
): Promise<{
  resolved: Map<string, string>;
  unresolved: string[];
  newAliases: Array<{ csvName: string; factoryId: string }>;
}> {
  const resolved = new Map<string, string>();
  const unresolved: string[] = [];
  const newAliases: Array<{ csvName: string; factoryId: string }> = [];

  for (const mill of millNames) {
    if (aliasResolutions[mill]) {
      resolved.set(mill, aliasResolutions[mill]);
      newAliases.push({ csvName: mill, factoryId: aliasResolutions[mill] });
      continue;
    }
    const learned = await prisma.brandFactoryAlias.findUnique({
      where: { brandId_csvName: { brandId, csvName: mill } },
    });
    if (learned) {
      resolved.set(mill, learned.factoryId);
      continue;
    }
    const exact = await prisma.factory.findFirst({ where: { name: mill } });
    if (exact) {
      resolved.set(mill, exact.id);
      newAliases.push({ csvName: mill, factoryId: exact.id });
      continue;
    }
    unresolved.push(mill);
  }

  return { resolved, unresolved, newAliases };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(req.url);
  if (url.searchParams.get("template") === "1") {
    return new NextResponse(CANONICAL_TEMPLATE, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="Brand_Fabric_Portfolio_Template.csv"',
      },
    });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!BD_ROLES.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const brand = await prisma.brand.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!brand) return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
  return NextResponse.json({ ok: true, brand });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!BD_ROLES.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id: brandId } = await params;
  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "true";

  // Accept multipart/form-data with a `file` field (the CSV) and optional
  // `aliasResolutions` JSON string. Also accept raw text/csv body.
  let csvText = "";
  let aliasResolutions: Record<string, string> = {};

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (file && typeof file !== "string") {
      csvText = await (file as File).text();
    } else {
      const csvField = form.get("csv");
      if (typeof csvField === "string") csvText = csvField;
    }
    const aliasField = form.get("aliasResolutions");
    if (typeof aliasField === "string" && aliasField) {
      try {
        aliasResolutions = JSON.parse(aliasField);
      } catch {
        return NextResponse.json(
          { ok: false, error: "aliasResolutions must be valid JSON" },
          { status: 400 },
        );
      }
    }
  } else if (contentType.includes("application/json")) {
    const body = await req.json();
    csvText = body?.csv || "";
    aliasResolutions = body?.aliasResolutions || {};
  } else {
    csvText = await req.text();
  }

  if (!csvText || !csvText.trim()) {
    return NextResponse.json({ ok: false, error: "Empty CSV body" }, { status: 400 });
  }

  const parsed = parseFabricCsv(csvText, brandId);

  // Resolve mill names
  const millResolution = await resolveMills(brandId, parsed.millNames, aliasResolutions);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      brand: { id: brand.id, name: brand.name },
      summary: parsed.summary,
      errors: parsed.errors,
      warnings: parsed.warnings,
      headerMap: parsed.headerMap,
      unknownHeaders: parsed.unknownHeaders,
      millNames: parsed.millNames,
      millResolution: {
        resolved: Object.fromEntries(millResolution.resolved),
        unresolved: millResolution.unresolved,
        newAliasesPlanned: millResolution.newAliases.length,
      },
      rowsPreview: parsed.rows.slice(0, 5),
    });
  }

  // Commit path — bail on any validation error or unresolved mill.
  if (parsed.errors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Validation errors must be resolved before committing",
        errors: parsed.errors,
        summary: parsed.summary,
      },
      { status: 400 },
    );
  }
  if (millResolution.unresolved.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Some mill names did not resolve to an existing factory",
        requiresFactoryAlias: millResolution.unresolved,
        millNames: parsed.millNames,
      },
      { status: 409 },
    );
  }

  // Begin writes
  const log: string[] = [];
  let fabricsCreated = 0;
  let fabricsUpdated = 0;
  let icpRowsCreated = 0;
  let amRowsCreated = 0;
  let aliasesCreated = 0;

  // Persist any new aliases we learned this run
  for (const alias of millResolution.newAliases) {
    try {
      await prisma.brandFactoryAlias.upsert({
        where: { brandId_csvName: { brandId, csvName: alias.csvName } },
        create: { brandId, csvName: alias.csvName, factoryId: alias.factoryId },
        update: { factoryId: alias.factoryId },
      });
      aliasesCreated++;
    } catch (e: any) {
      log.push(`⚠ alias save failed for ${alias.csvName}: ${e?.message}`);
    }
  }

  for (const row of parsed.rows) {
    const factoryId = millResolution.resolved.get(row.mill);
    if (!factoryId) {
      log.push(`row ${row.rowNumber}: factoryId missing — skipping`);
      continue;
    }
    try {
      const { fabric, created } = await upsertFabric(brandId, factoryId, row);
      if (created) fabricsCreated++;
      else fabricsUpdated++;
      await ensureBrandFactoryLink(brandId, factoryId, log);
      const submission = await ensureSubmission(
        brandId,
        factoryId,
        fabric.id,
        row.fabricTrialCompleted,
      );
      const icp = await ensureIcpTestRun(submission.id, row);
      if (icp) icpRowsCreated++;
      const am = await ensureAmTestRun(submission.id, row);
      if (am) amRowsCreated++;
    } catch (e: any) {
      log.push(`row ${row.rowNumber}: ${e?.message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    brand: { id: brand.id, name: brand.name },
    summary: {
      ...parsed.summary,
      fabricsCreated,
      fabricsUpdated,
      icpRowsCreated,
      amRowsCreated,
      aliasesCreated,
    },
    warnings: parsed.warnings,
    log,
    viewUrl: `/admin/brands/${brand.id}/fabrics`,
  });
}
