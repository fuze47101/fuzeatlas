// @ts-nocheck
/**
 * GET /api/admin/inter-lab-variance — Phase 10H.
 *
 * Surfaces fabrics that have been tested by ≥2 labs and computes
 * the variance per metric (log reduction for AB, ICP Ag value for
 * ICP). Returns the per-fabric pair AND a per-lab summary so the
 * dashboard can show "ITS Taiwan typically runs low on AATCC 100"
 * vs "BV is the gold standard."
 *
 * Known calibration patterns (from Andrew, May 2026) annotated
 * inline in the response so the UI can label expected drift.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ADMIN_ROLES = ["ADMIN", "EMPLOYEE", "TESTING_MANAGER", "SALES_MANAGER"];

const LAB_CALIBRATION_NOTES: Record<string, Record<string, string>> = {
  "ITS Taiwan": {
    AATCC_100: "Andrew's experience: runs typically lower than other labs on AATCC 100.",
    ASTM_E2149: "Andrew's experience: runs typically higher than other labs on ASTM E2149.",
  },
  BV: {
    AATCC_100: "Andrew's experience: gold-standard performer on AATCC 100.",
  },
};

function meanStd(arr: number[]) {
  if (arr.length === 0) return { mean: null, std: null };
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length;
  return { mean: m, std: Math.sqrt(v) };
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") || "180", 10);
  const since = new Date(Date.now() - days * 86400_000);

  const runs = await prisma.testRun.findMany({
    where: { testDate: { gte: since } },
    select: {
      id: true,
      testType: true,
      testMethodStd: true,
      testDate: true,
      labId: true,
      lab: { select: { name: true } },
      icpResult: { select: { agValue: true } },
      abResult: { select: { result1: true, result2: true } },
      submission: {
        select: {
          fuzeFabricNumber: true,
          fabric: { select: { id: true, fuzeNumber: true } },
        },
      },
    },
  });

  // Group by (fabric, testType, testMethodStd-normalized) → per-lab
  // result map.
  type Group = {
    key: string;
    fuzeNumber: number | null;
    testType: string;
    method: string;
    labResults: { labId: string; labName: string; value: number; runId: string }[];
  };
  const groups = new Map<string, Group>();

  for (const r of runs) {
    const fuzeNum = r.submission?.fuzeFabricNumber || r.submission?.fabric?.fuzeNumber || null;
    if (!fuzeNum) continue;
    const method = (r.testMethodStd || "").toUpperCase().replace(/\s|-/g, "_");
    if (!method) continue;
    const value =
      r.testType === "ICP" && r.icpResult?.agValue != null
        ? r.icpResult.agValue
        : r.testType === "ANTIBACTERIAL" && r.abResult?.result1 != null
          ? r.abResult.result1
          : null;
    if (value == null) continue;
    const key = `${fuzeNum}|${r.testType}|${method}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        fuzeNumber: fuzeNum,
        testType: r.testType!,
        method,
        labResults: [],
      };
      groups.set(key, g);
    }
    g.labResults.push({
      labId: r.labId!,
      labName: r.lab?.name || "—",
      value,
      runId: r.id,
    });
  }

  // Only keep groups with ≥2 distinct labs.
  const multiLabGroups = Array.from(groups.values())
    .filter((g) => new Set(g.labResults.map((l) => l.labId)).size >= 2)
    .map((g) => {
      const values = g.labResults.map((r) => r.value);
      const stats = meanStd(values);
      const min = Math.min(...values);
      const max = Math.max(...values);
      return {
        fabricKey: g.key,
        fuzeNumber: g.fuzeNumber,
        testType: g.testType,
        method: g.method,
        results: g.labResults,
        mean: stats.mean,
        std: stats.std,
        range: max - min,
      };
    })
    .sort((a, b) => (b.range || 0) - (a.range || 0));

  // Per-lab summary across all multi-lab fabrics: for each (lab,
  // testMethod) compute how that lab's results compare to the
  // group mean of every fabric it touched.
  type Bias = { runs: number; biasSum: number };
  const biasMap = new Map<string, Bias>();
  for (const g of multiLabGroups) {
    if (g.mean == null) continue;
    for (const r of g.results) {
      const k = `${r.labName}|${g.method}`;
      const b = biasMap.get(k) || { runs: 0, biasSum: 0 };
      b.runs++;
      b.biasSum += r.value - g.mean;
      biasMap.set(k, b);
    }
  }
  const perLab = Array.from(biasMap.entries()).map(([k, v]) => {
    const [labName, method] = k.split("|");
    const note = LAB_CALIBRATION_NOTES[labName]?.[method] || null;
    return {
      labName,
      method,
      sampleCount: v.runs,
      avgBias: v.runs ? v.biasSum / v.runs : 0,
      expectedAnnotation: note,
    };
  });

  return NextResponse.json({
    ok: true,
    windowDays: days,
    multiLabGroups,
    perLab,
    knownCalibration: LAB_CALIBRATION_NOTES,
  });
}
