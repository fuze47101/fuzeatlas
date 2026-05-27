// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/projects/[id]/grid
 *
 * Phase 52 T3 — sample-grid matrix for a project.
 *
 *   Rows: every Fabric tested in this project, expanded per washCount
 *         when multiple wash counts exist (using TestRequestLine.washCount).
 *   Columns: distinct (testType, testMethod, organisms) across all
 *            TestRequestLines on the project's TestRequests.
 *   Cells: status badge + best-known result value + click-through testRunId.
 *
 * Status precedence (when multiple lines/runs match a cell):
 *   PASS or FAIL on any attached TestRun beats line.status, beats default NOT_TESTED.
 *
 * ACL:
 *   ADMIN, EMPLOYEE, TESTING_MANAGER, SALES_MANAGER → all projects
 *   BRAND_USER, BRAND_MANAGER                       → only their brand's
 *   FACTORY_*                                        → only when project.factoryId matches
 *   anyone else                                      → 403
 */

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE", "TESTING_MANAGER", "SALES_MANAGER"]);
const BRAND_ROLES = new Set(["BRAND_USER", "BRAND_MANAGER"]);
const FACTORY_ROLES = new Set(["FACTORY_USER", "FACTORY_LEAD", "FACTORY_MANAGER"]);

function colKey(testType: string, testMethod: string | null, organisms: string | null): string {
  return `${testType}|${testMethod || ""}|${organisms || ""}`;
}
function colLabel(testType: string, testMethod: string | null, organisms: string | null): string {
  const parts = [testType];
  if (testMethod) parts.push(testMethod);
  if (organisms) parts.push(organisms);
  return parts.join(" · ");
}

function deriveStatus(run: any, lineStatus: string | null): string {
  if (!run) return lineStatus && lineStatus !== "PENDING" ? lineStatus : "NOT_TESTED";
  // ICP — agValue present → PASS
  if (run.icpResult?.agValue != null) return "PASS";
  // AB — explicit pass flag or percentReduction
  if (run.abResult) {
    if (run.abResult.pass === true) return "PASS";
    if (run.abResult.pass === false) return "FAIL";
    if (typeof run.abResult.percentReduction === "number") {
      return run.abResult.percentReduction >= 99 ? "PASS" : "IN_PROGRESS";
    }
  }
  // Fungal
  if (run.fungalResult?.pass === true) return "PASS";
  if (run.fungalResult?.pass === false) return "FAIL";
  // Odor
  if (run.odorResult?.pass === true) return "PASS";
  if (run.odorResult?.pass === false) return "FAIL";
  return lineStatus && lineStatus !== "PENDING" ? lineStatus : "IN_PROGRESS";
}

function deriveValue(run: any): string | null {
  if (!run) return null;
  if (run.icpResult?.agValue != null) return `${run.icpResult.agValue.toFixed(2)} mg/kg`;
  if (typeof run.abResult?.percentReduction === "number") {
    return `${run.abResult.percentReduction.toFixed(1)}%`;
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      brand: { select: { id: true, name: true } },
      factory: { select: { id: true, name: true } },
    },
  });
  if (!project) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });

  // ACL
  let allowed = false;
  if (ADMIN_ROLES.has(user.role)) allowed = true;
  else if (BRAND_ROLES.has(user.role) && user.brandId && project.brandId === user.brandId) allowed = true;
  else if (FACTORY_ROLES.has(user.role) && user.factoryId && project.factoryId === user.factoryId) allowed = true;
  if (!allowed) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const testRequests = await prisma.testRequest.findMany({
    where: { projectId: id },
    select: {
      id: true,
      poNumber: true,
      fabricId: true,
      fabric: {
        select: {
          id: true,
          fuzeNumber: true,
          customerCode: true,
          factoryCode: true,
        },
      },
      lines: {
        select: {
          id: true,
          testType: true,
          testMethod: true,
          organisms: true,
          washCount: true,
          status: true,
          testRunId: true,
          testRun: {
            select: {
              id: true,
              testDate: true,
              brandVisible: true,
              icpResult: { select: { agValue: true } },
              abResult: { select: { pass: true, percentReduction: true } },
              fungalResult: { select: { pass: true } },
              odorResult: { select: { pass: true } },
            },
          },
        },
      },
    },
  });

  // Build column set + per-(fabric × washCount) row aggregation.
  const colMap = new Map<string, { key: string; label: string; testType: string; testMethod: string | null; organisms: string | null }>();
  const rowMap = new Map<string, any>();

  for (const tr of testRequests) {
    if (!tr.fabric) continue;
    for (const line of tr.lines) {
      const wash = line.washCount ?? null;
      const rowKey = `${tr.fabric.id}::${wash ?? "—"}`;
      if (!rowMap.has(rowKey)) {
        rowMap.set(rowKey, {
          fabricId: tr.fabric.id,
          fuzeNumber: tr.fabric.fuzeNumber,
          customerCode: tr.fabric.customerCode,
          factoryCode: tr.fabric.factoryCode,
          washCount: wash,
          cells: {} as Record<string, any>,
        });
      }
      const row = rowMap.get(rowKey);

      const ck = colKey(line.testType, line.testMethod, line.organisms);
      if (!colMap.has(ck)) {
        colMap.set(ck, {
          key: ck,
          label: colLabel(line.testType, line.testMethod, line.organisms),
          testType: line.testType,
          testMethod: line.testMethod,
          organisms: line.organisms,
        });
      }

      const status = deriveStatus(line.testRun, line.status);
      const value = deriveValue(line.testRun);
      // If a cell already has data, prefer terminal PASS/FAIL over in-progress.
      const existingCell = row.cells[ck];
      if (
        !existingCell ||
        (existingCell.status !== "PASS" && existingCell.status !== "FAIL" &&
          (status === "PASS" || status === "FAIL"))
      ) {
        row.cells[ck] = {
          status,
          value,
          testRunId: line.testRunId,
          poNumber: tr.poNumber,
        };
      }
    }
  }

  const columns = Array.from(colMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  const samples = Array.from(rowMap.values()).sort((a, b) => {
    const cmp = (a.fuzeNumber ?? 0) - (b.fuzeNumber ?? 0);
    if (cmp !== 0) return cmp;
    return (a.washCount ?? -1) - (b.washCount ?? -1);
  });

  return NextResponse.json({
    ok: true,
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      brandId: project.brandId,
      brandName: project.brand?.name || null,
      factoryId: project.factoryId,
      factoryName: project.factory?.name || null,
      stage: project.stage,
      fuzeTier: project.fuzeTier,
      projectedValue: project.projectedValue,
      annualVolumeMeters: project.annualVolumeMeters,
      expectedProductionDate: project.expectedProductionDate,
    },
    columns,
    samples,
  });
}
